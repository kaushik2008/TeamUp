// ============================================================================
// matching.js — the scoring algorithm behind "Suggested hackers" and "Ranked for you".
//
// Both directions use the same score, computed by scoreHackerForTeam():
//   +3 for each of the team's needed roles that the hacker covers   (biggest factor)
//   +1 for each language the hacker shares with the team's stack
//   +1 if the hacker's level is within one step of the team's average level
//
// rankHackers() scores every available hacker for one team (team detail page).
// rankTeams()   scores every open team for one hacker (teams page, suggestions).
// ============================================================================
import { LEVELS } from './models.js';

// beginner -> 0, intermediate -> 1, advanced -> 2. Lets us average and compare levels as numbers.
const levelIndex = (level) => Math.max(0, LEVELS.indexOf(level));

// Case-insensitive comparison so "python" in a team's stack matches "Python" from GitHub.
const norm = (s) => String(s).trim().toLowerCase();

/** The language names on a user. Mongoose gives us a Map; plain JSON gives an object. */
export function skillNames(user) {
  const skills = user.skills instanceof Map ? Object.fromEntries(user.skills) : user.skills || {};
  return Object.keys(skills);
}

/**
 * Score one hacker for one team.
 * `members` are the team's current member documents, used only for the level average.
 * Returns the score plus the reasons, so the UI can explain *why* ("Covers backend · Shares Python").
 */
export function scoreHackerForTeam(hacker, team, members = []) {
  // Which of the team's needed roles does this hacker have?
  const needed = new Set((team.neededRoles || []).map(norm));
  const covers = (hacker.roles || []).filter((r) => needed.has(norm(r)));

  // Which of the team's stack languages does this hacker know?
  // The Map goes from normalized name -> original spelling so the reasons show the team's spelling.
  const stack = new Map((team.stack || []).map((s) => [norm(s), s]));
  const shares = skillNames(hacker)
    .filter((lang) => stack.has(norm(lang)))
    .map((lang) => stack.get(norm(lang)));

  // Is the hacker's level close to the team's average? (Only meaningful if the team has members.)
  let similarLevel = false;
  if (members.length) {
    const avg = members.reduce((sum, m) => sum + levelIndex(m.level), 0) / members.length;
    similarLevel = Math.abs(levelIndex(hacker.level) - avg) <= 1;
  }

  const score = covers.length * 3 + shares.length + (similarLevel ? 1 : 0);
  return { score, reasons: { covers, shares, similarLevel } };
}

/** A hacker can be suggested only if they're looking and not already on a team. */
export function isAvailable(hacker) {
  return hacker.lookingForTeam !== false && !hacker.teamId;
}

// A level match alone isn't a reason to suggest someone: require a covered role or a shared language.
const hasRealOverlap = (s) => s.reasons.covers.length > 0 || s.reasons.shares.length > 0;

/** Ranked hackers for a team, best first. Ties are broken alphabetically so the order is stable. */
export function rankHackers(team, members, hackers) {
  const memberIds = new Set(members.map((m) => String(m._id)));
  return hackers
    .filter((h) => isAvailable(h) && !memberIds.has(String(h._id)))
    .map((h) => ({ hacker: h, ...scoreHackerForTeam(h, team, members) }))
    .filter(hasRealOverlap)
    .sort((a, b) => b.score - a.score || a.hacker.name.localeCompare(b.hacker.name));
}

/**
 * Ranked open teams for a hacker, best first.
 * `membersByTeam` maps teamId -> member documents (loaded once by the route so we don't
 * query the database inside a loop).
 */
export function rankTeams(hacker, teams, membersByTeam) {
  return teams
    .filter((t) => t.isOpen && String(t._id) !== String(hacker.teamId))
    .map((t) => ({ team: t, ...scoreHackerForTeam(hacker, t, membersByTeam.get(String(t._id)) || []) }))
    .filter(hasRealOverlap)
    .sort((a, b) => b.score - a.score || a.team.name.localeCompare(b.team.name));
}
