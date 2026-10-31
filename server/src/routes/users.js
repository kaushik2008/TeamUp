// ============================================================================
// routes/users.js — hacker profiles and GitHub sync.
//
//   GET   /api/github/:username        preview languages while onboarding (saves nothing)
//   POST  /api/users                   create a profile
//   GET   /api/users                   browse hackers (filters: role, lang, level, q, all)
//   GET   /api/users/:id               one profile
//   PATCH /api/users/:id               edit a profile or its skills
//   POST  /api/users/:id/sync-github   re-pull languages from GitHub (once per hour)
//   GET   /api/users/:id/suggestions   open teams ranked for this hacker
// ============================================================================
import { Router } from 'express';
import { User, Team } from '../models.js';
import { fetchGitHubSkills } from '../github.js';
import { rankTeams } from '../matching.js';
import { asyncHandler, assertId, HttpError, toList } from '../helpers.js';

const router = Router();
const ONE_HOUR = 60 * 60 * 1000;

/** Manually entered languages get equal shares, e.g. ["Python","JS"] -> { Python: 0.5, JS: 0.5 }. */
function sharesFromList(langs) {
  const unique = [...new Set(langs)];
  return Object.fromEntries(unique.map((l) => [l, Math.round((1 / unique.length) * 100) / 100]));
}

/** When a user edits their skills by hand (as percentages), rescale them so the shares add up to 1. */
function normalizeSkills(skills) {
  const entries = Object.entries(skills || {}).filter(([k, v]) => k.trim() && Number(v) > 0);
  const total = entries.reduce((s, [, v]) => s + Number(v), 0);
  return Object.fromEntries(entries.map(([k, v]) => [k.trim(), Math.round((Number(v) / total) * 100) / 100]));
}

/** Pull from GitHub and copy the result onto the user document (caller saves it). */
async function applyGitHub(user) {
  const gh = await fetchGitHubSkills(user.githubUsername);
  user.skills = gh.skills;
  user.githubVerified = true;
  user.githubSyncedAt = new Date();
  user.githubRepoCount = gh.repoCount;
  user.recentRepos = gh.recentRepos;
}

// GET /api/github/:username — the onboarding form calls this when you press "Sync",
// so you can see your languages before the profile exists.
router.get(
  '/github/:username',
  asyncHandler(async (req, res) => {
    res.json(await fetchGitHubSkills(req.params.username));
  })
);

// POST /api/users — create a profile.
// If a GitHub username is given we try to sync it right away, but a failed sync does NOT
// block signup: the profile is still created and the warning is returned for the UI to show.
router.post(
  '/users',
  asyncHandler(async (req, res) => {
    const { name, email, bio, roles, level, githubUsername, languages } = req.body;
    const user = new User({ name, email, bio, roles: toList(roles), level });
    let githubWarning = null;

    if (githubUsername?.trim()) {
      user.githubUsername = githubUsername.trim().replace(/^@/, ''); // allow "@handle"
      try {
        await applyGitHub(user);
      } catch (err) {
        githubWarning = err.message; // profile still gets created; roles drive matching
      }
    }
    // No GitHub (or it failed) but they typed languages by hand? Use those instead.
    if (!user.githubVerified && toList(languages).length) user.skills = sharesFromList(toList(languages));

    await user.save(); // runs the schema validation in models.js
    res.status(201).json({ user, githubWarning });
  })
);

// GET /api/users?role=&lang=&level=&q=&all=1 — browse hackers.
// By default only people who are looking AND not on a team are returned (the "Hackers" page).
// `all=1` returns everyone (used by the demo switcher in the footer).
router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const { role, lang, level, q, all } = req.query;
    const filter = {};
    if (!all) Object.assign(filter, { lookingForTeam: true, teamId: null });
    if (role) filter.roles = role; // matches if the roles array contains this value
    if (level) filter.level = level;
    // Name search: escape regex special characters so "C++" doesn't break the query.
    if (q) filter.name = { $regex: String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

    // Verified profiles first, then alphabetical.
    let users = await User.find(filter).sort({ githubVerified: -1, name: 1 });

    // Language filter is done in JS because skills is a Map keyed by arbitrary names,
    // and we want a case-insensitive match ("python" == "Python").
    if (lang) {
      const want = String(lang).toLowerCase();
      users = users.filter((u) => [...u.skills.keys()].some((k) => k.toLowerCase() === want));
    }
    res.json(users);
  })
);

// GET /api/users/:id — one profile. `populate` swaps the teamId for { _id, name, track }
// so the profile page can link to the team without a second request.
router.get(
  '/users/:id',
  asyncHandler(async (req, res) => {
    assertId(req.params.id);
    const user = await User.findById(req.params.id).populate('teamId', 'name track');
    if (!user) throw new HttpError(404, 'Hacker not found');
    res.json(user);
  })
);

// PATCH /api/users/:id — edit a profile. Only the fields present in the body are changed.
router.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    assertId(req.params.id);
    const user = await User.findById(req.params.id);
    if (!user) throw new HttpError(404, 'Hacker not found');

    for (const key of ['name', 'bio', 'level', 'lookingForTeam']) {
      if (req.body[key] !== undefined) user[key] = req.body[key];
    }
    if (req.body.roles !== undefined) user.roles = toList(req.body.roles);

    // Changing the GitHub handle un-verifies the profile until the next sync.
    if (req.body.githubUsername !== undefined) {
      const next = String(req.body.githubUsername).trim().replace(/^@/, '');
      if (next !== (user.githubUsername || '')) {
        user.githubUsername = next || undefined;
        user.githubVerified = false;
        user.githubSyncedAt = undefined;
      }
    }
    if (req.body.skills !== undefined) user.skills = normalizeSkills(req.body.skills);

    await user.save();
    res.json(user);
  })
);

// POST /api/users/:id/sync-github — re-pull languages. Limited to once an hour per user
// so one person can't exhaust the GitHub rate limit by clicking "Sync" repeatedly.
router.post(
  '/users/:id/sync-github',
  asyncHandler(async (req, res) => {
    assertId(req.params.id);
    const user = await User.findById(req.params.id);
    if (!user) throw new HttpError(404, 'Hacker not found');
    if (!user.githubUsername) throw new HttpError(400, 'Add a GitHub username first');
    if (user.githubSyncedAt && Date.now() - user.githubSyncedAt.getTime() < ONE_HOUR) {
      const mins = Math.ceil((ONE_HOUR - (Date.now() - user.githubSyncedAt.getTime())) / 60000);
      throw new HttpError(429, `Synced recently. You can sync again in ${mins} min.`);
    }
    await applyGitHub(user);
    await user.save();
    res.json(user);
  })
);

// GET /api/users/:id/suggestions — open teams ranked for this hacker, with reasons.
router.get(
  '/users/:id/suggestions',
  asyncHandler(async (req, res) => {
    assertId(req.params.id);
    const hacker = await User.findById(req.params.id);
    if (!hacker) throw new HttpError(404, 'Hacker not found');

    // Load every open team and all of their members in two queries (not one per team),
    // then build a teamId -> members lookup for the level-average part of the score.
    const teams = await Team.find({ isOpen: true });
    const members = await User.find({ _id: { $in: teams.flatMap((t) => t.memberIds) } });
    const byId = new Map(members.map((m) => [String(m._id), m]));
    const membersByTeam = new Map(teams.map((t) => [String(t._id), t.memberIds.map((id) => byId.get(String(id))).filter(Boolean)]));

    res.json(
      rankTeams(hacker, teams, membersByTeam).map(({ team, score, reasons }) => ({
        team: { ...team.toJSON(), memberCount: team.memberIds.length },
        score,
        reasons,
      }))
    );
  })
);

export default router;
