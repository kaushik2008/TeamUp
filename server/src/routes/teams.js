// ============================================================================
// routes/teams.js — teams looking for members.
//
//   POST /api/teams                   post a team (the creator becomes captain)
//   GET  /api/teams                   browse teams (filters: role, track, includeClosed, forUser)
//   GET  /api/teams/:id               one team with its members
//   GET  /api/teams/:id/suggestions   available hackers ranked for this team's gaps
//   POST /api/teams/:id/leave         a member leaves (frees the seat, may pass captaincy or delete the team)
// ============================================================================
import { Router } from 'express';
import { Team, User, Request } from '../models.js';
import { rankHackers, scoreHackerForTeam } from '../matching.js';
import { asyncHandler, assertId, HttpError, toList } from '../helpers.js';

const router = Router();

// The user fields we send along with a team's members (not the whole profile).
const MEMBER_FIELDS = 'name roles level githubVerified skills';

// POST /api/teams — create a team. The owner is added as the first member and marked as
// no longer looking, since a hacker can be on only one team at a time.
router.post(
  '/teams',
  asyncHandler(async (req, res) => {
    const { ownerId, name, idea, track, neededRoles, stack, maxSize } = req.body;
    assertId(ownerId, 'ownerId');
    const owner = await User.findById(ownerId);
    if (!owner) throw new HttpError(404, 'Create a profile before posting a team');
    if (owner.teamId) throw new HttpError(409, "You're already on a team");

    const team = await Team.create({
      name,
      idea,
      track,
      ownerId,
      memberIds: [ownerId],
      neededRoles: toList(neededRoles),
      stack: toList(stack),
      maxSize: maxSize || 4,
    });
    owner.teamId = team._id;
    owner.lookingForTeam = false;
    await owner.save();
    res.status(201).json(team);
  })
);

// GET /api/teams?role=&track=&includeClosed=1&forUser=<id>
// Lists teams. With `forUser`, each open team also carries that hacker's match score and
// reasons, and the list is sorted best-match-first. This is what powers "Ranked for you".
router.get(
  '/teams',
  asyncHandler(async (req, res) => {
    const { role, track, includeClosed, forUser } = req.query;
    const filter = {};
    if (!includeClosed) filter.isOpen = true;
    if (role) filter.neededRoles = { $in: toList(role) }; // any of the selected roles
    if (track) filter.track = track;

    // populate() replaces each member id with the member's document (limited to MEMBER_FIELDS).
    const teams = await Team.find(filter).sort({ isOpen: -1, createdAt: -1 }).populate('memberIds', MEMBER_FIELDS);

    let viewer = null;
    if (forUser) {
      assertId(forUser, 'forUser');
      viewer = await User.findById(forUser);
    }

    // Reshape for the client: `members` holds the populated docs, `memberIds` goes back to plain ids.
    const out = teams.map((t) => {
      const json = t.toJSON();
      json.members = json.memberIds;
      json.memberIds = t.memberIds.map((m) => m._id);
      // Only score for viewers who could actually join (not already on a team).
      if (viewer && t.isOpen && !viewer.teamId) json.match = scoreHackerForTeam(viewer, t, t.memberIds);
      return json;
    });

    // Rank for the viewer: best match first, closed teams always last.
    if (viewer) out.sort((a, b) => b.isOpen - a.isOpen || (b.match?.score ?? -1) - (a.match?.score ?? -1));
    res.json(out);
  })
);

// GET /api/teams/:id — team detail with members (the team page).
router.get(
  '/teams/:id',
  asyncHandler(async (req, res) => {
    assertId(req.params.id);
    const team = await Team.findById(req.params.id).populate('memberIds', MEMBER_FIELDS + ' githubUsername');
    if (!team) throw new HttpError(404, 'Team not found');
    const json = team.toJSON();
    json.members = json.memberIds;
    json.memberIds = team.memberIds.map((m) => m._id);
    res.json(json);
  })
);

// GET /api/teams/:id/suggestions?limit=10 — hackers who fill this team's gaps, best first.
router.get(
  '/teams/:id/suggestions',
  asyncHandler(async (req, res) => {
    assertId(req.params.id);
    const team = await Team.findById(req.params.id);
    if (!team) throw new HttpError(404, 'Team not found');
    if (!team.isOpen) return res.json([]); // a full team isn't looking for anyone

    const members = await User.find({ _id: { $in: team.memberIds } });
    const hackers = await User.find({ lookingForTeam: true, teamId: null }); // only available people
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    res.json(rankHackers(team, members, hackers).slice(0, limit).map(({ hacker, score, reasons }) => ({ hacker, score, reasons })));
  })
);

// POST /api/teams/:id/leave — a member leaves the team. Body: { userId }.
//   1. The leaver is marked as looking again, so they can request to join another team.
//   2. Their seat frees up: a full team reopens, and roles only they covered go back on neededRoles.
//   3. If the captain leaves, the longest-standing remaining member becomes captain and inherits
//      the pending join requests.
//   4. If the last member leaves, the team and its requests are deleted.
router.post(
  '/teams/:id/leave',
  asyncHandler(async (req, res) => {
    assertId(req.params.id);
    const { userId } = req.body;
    assertId(userId, 'userId');
    const [team, user] = await Promise.all([Team.findById(req.params.id), User.findById(userId)]);
    if (!team) throw new HttpError(404, 'Team not found');
    if (!user) throw new HttpError(404, 'Hacker not found');
    if (!team.memberIds.some((m) => m.equals(user._id))) throw new HttpError(409, `You're not on ${team.name}`);

    // 1. Free the leaver.
    user.teamId = null;
    user.lookingForTeam = true;
    await user.save();

    // Invites this person sent on the team's behalf no longer make sense.
    await Request.updateMany({ teamId: team._id, type: 'invite', fromUserId: user._id, status: 'pending' }, { status: 'declined' });

    team.memberIds = team.memberIds.filter((m) => !m.equals(user._id));

    // 4. Nobody left: remove the team and everything that pointed at it.
    if (team.memberIds.length === 0) {
      await Promise.all([Request.deleteMany({ teamId: team._id }), team.deleteOne()]);
      return res.json({ deleted: true });
    }

    // 2. Reopen the seat. Roles nobody remaining covers become needed again.
    const remaining = await User.find({ _id: { $in: team.memberIds } });
    for (const role of user.roles) {
      if (!remaining.some((m) => m.roles.includes(role)) && !team.neededRoles.includes(role)) team.neededRoles.push(role);
    }
    team.isOpen = team.memberIds.length < team.maxSize;

    // 3. Pass the captaincy, and move pending join requests to the new captain's inbox.
    if (team.ownerId.equals(user._id)) {
      team.ownerId = team.memberIds[0];
      await Request.updateMany({ teamId: team._id, type: 'join', status: 'pending' }, { toUserId: team.ownerId });
    }

    await team.save();
    res.json(team);
  })
);

export default router;
