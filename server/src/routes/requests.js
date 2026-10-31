// ============================================================================
// routes/requests.js — join requests and invites (the inbox).
//
//   POST  /api/requests          send a join request (hacker -> team) or an invite (team -> hacker)
//   GET   /api/requests?userId=  a user's inbox: requests they received and ones they sent
//   PATCH /api/requests/:id      accept or decline. Accepting is where a hacker actually joins a team.
// ============================================================================
import { Router } from 'express';
import { Request, Team, User } from '../models.js';
import { asyncHandler, assertId, HttpError } from '../helpers.js';

const router = Router();

// The fields we attach when returning a request, so the inbox can render names and links
// without extra requests.
const USER_FIELDS = 'name roles level githubVerified';
const TEAM_FIELDS = 'name neededRoles isOpen maxSize memberIds ownerId';
const populate = (q) => q.populate('fromUserId', USER_FIELDS).populate('toUserId', USER_FIELDS).populate('teamId', TEAM_FIELDS);

// POST /api/requests — create a request. Checks that the sender is allowed to, then makes
// sure there isn't already a pending request between this hacker and this team.
router.post(
  '/requests',
  asyncHandler(async (req, res) => {
    const { fromUserId, toUserId, teamId, type, message = '' } = req.body;
    assertId(fromUserId, 'fromUserId');
    assertId(teamId, 'teamId');
    if (!['join', 'invite'].includes(type)) throw new HttpError(400, 'type must be "join" or "invite"');

    const [from, team] = await Promise.all([User.findById(fromUserId), Team.findById(teamId)]);
    if (!from) throw new HttpError(404, 'Sender not found');
    if (!team) throw new HttpError(404, 'Team not found');
    if (!team.isOpen) throw new HttpError(409, `${team.name} is full`);

    // Work out who receives the request (`to`).
    let to;
    if (type === 'join') {
      // A hacker asks to join: it goes to the team's captain.
      if (from.teamId) throw new HttpError(409, "You're already on a team");
      to = await User.findById(team.ownerId);
    } else {
      // A team member invites a hacker: it goes to that hacker.
      if (!team.memberIds.some((id) => id.equals(from._id))) throw new HttpError(403, 'Only team members can invite');
      assertId(toUserId, 'toUserId');
      to = await User.findById(toUserId);
      if (!to) throw new HttpError(404, 'Hacker not found');
      if (to.teamId) throw new HttpError(409, `${to.name} is already on a team`);
    }

    // No duplicates: one pending request per (hacker, team) pair, in either direction.
    const hacker = type === 'join' ? from._id : to._id;
    const dup = await Request.findOne({
      teamId,
      status: 'pending',
      $or: [
        { type: 'join', fromUserId: hacker },
        { type: 'invite', toUserId: hacker },
      ],
    });
    if (dup) throw new HttpError(409, 'There is already a pending request between this hacker and team');

    const request = await Request.create({ fromUserId, toUserId: to._id, teamId, type, message });
    res.status(201).json(await populate(Request.findById(request._id)));
  })
);

// GET /api/requests?userId= — the inbox. Pending items first, then newest first.
router.get(
  '/requests',
  asyncHandler(async (req, res) => {
    const { userId } = req.query;
    assertId(userId, 'userId');
    const [received, sent] = await Promise.all([
      populate(Request.find({ toUserId: userId }).sort({ status: -1, createdAt: -1 })),
      populate(Request.find({ fromUserId: userId }).sort({ createdAt: -1 })),
    ]);
    // "pending" sorts after "declined"/"accepted" alphabetically, so put pending first explicitly.
    const pendingFirst = (a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || b.createdAt - a.createdAt;
    res.json({ received: received.sort(pendingFirst), sent: sent.sort(pendingFirst) });
  })
);

// PATCH /api/requests/:id — answer a request.
// Declining just flips the status. Accepting does the real work:
//   1. add the hacker to the team and remove the needed roles they cover
//   2. close the team if it's now full
//   3. mark the hacker as on a team and no longer looking
//   4. auto-decline the hacker's other pending requests (and everything pending for a full team)
router.patch(
  '/requests/:id',
  asyncHandler(async (req, res) => {
    assertId(req.params.id);
    const { status, actingUserId } = req.body;
    if (!['accepted', 'declined'].includes(status)) throw new HttpError(400, 'status must be "accepted" or "declined"');

    const request = await Request.findById(req.params.id);
    if (!request) throw new HttpError(404, 'Request not found');
    // v1 has no login, so the client sends who is acting; only the recipient may answer.
    if (actingUserId && String(request.toUserId) !== String(actingUserId))
      throw new HttpError(403, 'Only the person who received this request can answer it');
    if (request.status !== 'pending') throw new HttpError(409, `This request was already ${request.status}`);

    if (status === 'declined') {
      request.status = 'declined';
      await request.save();
      return res.json(await populate(Request.findById(request._id)));
    }

    // ---- Accept ----
    // The person joining is the sender of a join request, or the recipient of an invite.
    const team = await Team.findById(request.teamId);
    const joinerId = request.type === 'join' ? request.fromUserId : request.toUserId;
    const joiner = await User.findById(joinerId);
    if (!team || !joiner) throw new HttpError(404, 'Team or hacker no longer exists');
    if (!team.isOpen || team.memberIds.length >= team.maxSize) throw new HttpError(409, `${team.name} is already full`);
    if (joiner.teamId) throw new HttpError(409, `${joiner.name} is already on a team`);

    // 1 & 2. Add the member, drop the needed roles they now cover, close the team if full.
    team.memberIds.push(joiner._id);
    team.neededRoles = team.neededRoles.filter((r) => !joiner.roles.includes(r));
    if (team.memberIds.length >= team.maxSize) team.isOpen = false;
    await team.save();

    // 3. The hacker is now on a team.
    joiner.teamId = team._id;
    joiner.lookingForTeam = false;
    await joiner.save();

    request.status = 'accepted';
    await request.save();

    // 4. Clean up requests that no longer make sense.
    const stale = [
      { _id: { $ne: request._id }, status: 'pending', type: 'join', fromUserId: joiner._id },
      { _id: { $ne: request._id }, status: 'pending', type: 'invite', toUserId: joiner._id },
    ];
    if (!team.isOpen) stale.push({ _id: { $ne: request._id }, status: 'pending', teamId: team._id });
    await Request.updateMany({ $or: stale }, { status: 'declined' });

    res.json(await populate(Request.findById(request._id)));
  })
);

export default router;
