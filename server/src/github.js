// ============================================================================
// github.js — the external API call. Turns a GitHub username into language shares.
//
// This is the project's "external HTTPS API" (the course requirement). The browser never
// talks to GitHub directly: the React app asks our Express server, and the server asks
// GitHub with Axios. That keeps the optional GITHUB_TOKEN out of the browser.
//
// One request per user:  GET https://api.github.com/users/{username}/repos?per_page=100&sort=pushed
// Results are cached in memory for an hour so repeated syncs don't burn the rate limit
// (60 requests/hour without a token, 5,000 with one).
// ============================================================================
import axios from 'axios';

const ONE_HOUR = 60 * 60 * 1000;
const cache = new Map(); // username (lowercase) -> { at: timestamp, result }

// A preconfigured Axios instance. Every call made with `github.get(...)` uses these settings.
const github = axios.create({
  baseURL: 'https://api.github.com',
  timeout: 2800, // the PRD wants a sync to finish in under 3 seconds
  headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'TeamUp-HowToHackathon' },
});

// Attach the token (if there is one) right before each request. We read process.env here
// rather than at import time so the value from .env is definitely loaded by then.
github.interceptors.request.use((config) => {
  if (process.env.GITHUB_TOKEN) config.headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return config;
});

/** Like HttpError in helpers.js, but for problems talking to GitHub. Defaults to 502 Bad Gateway. */
export class GitHubError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

/**
 * Turn a list of repos into language shares, e.g. { Python: 0.6, TypeScript: 0.4 }.
 *
 * - Forks are skipped (they're someone else's code).
 * - Each repo's language is weighted toward recent activity: a repo pushed today counts 1,
 *   one pushed six months ago counts 0.5, one pushed a year ago about 0.33.
 * - The weights are then normalized so all shares add up to 1, and sorted biggest first.
 *
 * Pure function (no network), so it's easy to test with fake repo data.
 */
export function languageShares(repos, now = Date.now()) {
  const weights = {};
  for (const repo of repos) {
    if (repo.fork || !repo.language) continue;
    const monthsAgo = Math.max(0, (now - new Date(repo.pushed_at).getTime()) / (30 * 24 * 3600 * 1000));
    weights[repo.language] = (weights[repo.language] || 0) + 1 / (1 + monthsAgo / 6);
  }
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (!total) return {};
  return Object.fromEntries(
    Object.entries(weights)
      .sort((a, b) => b[1] - a[1])
      .map(([lang, w]) => [lang, Math.round((w / total) * 100) / 100])
  );
}

/**
 * Fetch a user's public repos and summarize them: language shares, repo count, three most
 * recently pushed repos. Throws a GitHubError with a friendly message on any failure.
 */
export async function fetchGitHubSkills(username) {
  // 1. Serve from cache if we fetched this user in the last hour.
  const key = username.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ONE_HOUR) return { ...hit.result, cached: true };

  // 2. Call GitHub. Translate the common failure modes into clear messages for the UI.
  let repos;
  try {
    const res = await github.get(`/users/${encodeURIComponent(username)}/repos`, {
      params: { per_page: 100, sort: 'pushed' },
    });
    repos = res.data;
  } catch (err) {
    if (err.response?.status === 404) throw new GitHubError(`No GitHub user named "${username}"`, 404);
    if (err.response?.status === 403 || err.response?.status === 429)
      throw new GitHubError('GitHub rate limit reached. Add GITHUB_TOKEN to server/.env or try again later.', 429);
    if (err.code === 'ECONNABORTED') throw new GitHubError('GitHub took too long to respond. Try again.', 504);
    throw new GitHubError('Could not reach GitHub right now.');
  }

  // 3. Summarize. `repos` is already sorted by last push (newest first), so slice(0, 3) is "recent".
  const own = repos.filter((r) => !r.fork);
  const result = {
    username,
    skills: languageShares(repos),
    repoCount: own.length,
    recentRepos: own.slice(0, 3).map((r) => ({
      name: r.name,
      description: r.description || '',
      language: r.language || '',
      url: r.html_url,
    })),
  };

  // 4. Remember it for an hour.
  cache.set(key, { at: Date.now(), result });
  return { ...result, cached: false };
}
