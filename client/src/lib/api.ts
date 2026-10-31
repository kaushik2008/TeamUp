// api.ts — the one Axios instance every page uses, plus the TypeScript shapes of what the
// API returns. These interfaces mirror the Mongoose schemas in server/src/models.js.
import axios, { AxiosError } from 'axios'

// In development Vite proxies /api to Express. In production set VITE_API_URL,
// e.g. https://teamup-api.onrender.com, so the browser calls the API over HTTPS.
export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL ?? ''}/api`,
  timeout: 10_000,
})

// ---- Types ---------------------------------------------------------------
export type Role = 'frontend' | 'backend' | 'design' | 'ml' | 'hardware' | 'pm'
export type Level = 'beginner' | 'intermediate' | 'advanced'

export interface Repo {
  name: string
  description: string
  language: string
  url?: string
}

/** A hacker's profile. `teamId` is a plain id, or an object when the server populated it. */
export interface User {
  _id: string
  name: string
  email: string
  bio: string
  roles: Role[]
  level: Level
  githubUsername?: string
  skills: Record<string, number>
  githubVerified: boolean
  githubSyncedAt?: string
  githubRepoCount?: number
  recentRepos?: Repo[]
  lookingForTeam: boolean
  teamId: string | null | { _id: string; name: string; track: string }
}

/** Why a hacker matched a team. Computed in server/src/matching.js. */
export interface MatchReasons {
  covers: Role[]
  shares: string[]
  similarLevel: boolean
}

export interface Match {
  score: number
  reasons: MatchReasons
}

/** A team. `members` and `match` are only present on some endpoints. */
export interface Team {
  _id: string
  name: string
  ownerId: string
  memberIds: string[]
  members?: User[]
  idea: string
  track: string
  neededRoles: Role[]
  stack: string[]
  maxSize: number
  isOpen: boolean
  createdAt: string
  match?: Match
}

/** A join request or invite as the inbox receives it, with the people and team populated. */
export interface TeamRequest {
  _id: string
  type: 'join' | 'invite'
  status: 'pending' | 'accepted' | 'declined'
  message: string
  createdAt: string
  fromUserId: Pick<User, '_id' | 'name' | 'roles' | 'level' | 'githubVerified'>
  toUserId: Pick<User, '_id' | 'name' | 'roles' | 'level' | 'githubVerified'>
  teamId: Pick<Team, '_id' | 'name' | 'neededRoles' | 'isOpen' | 'maxSize' | 'memberIds' | 'ownerId'>
}

/** What GET /api/github/:username returns during onboarding. */
export interface GitHubPreview {
  username: string
  skills: Record<string, number>
  repoCount: number
  recentRepos: Repo[]
}

// ---- Helpers -------------------------------------------------------------

/** The team id a user is on, whether `teamId` came back populated or not. */
export const teamIdOf = (u?: User | null) =>
  !u?.teamId ? null : typeof u.teamId === 'string' ? u.teamId : u.teamId._id

/** The user's team as { _id, name, track }, or null. Only GET /api/users/:id populates it, which is what the session uses. */
export const teamOf = (u?: User | null) => (u?.teamId && typeof u.teamId === 'object' ? u.teamId : null)

/** Pull the server's error message out of an Axios error. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Try again.') {
  if (err instanceof AxiosError) {
    if (err.response?.data?.error) return String(err.response.data.error)
    if (err.code === 'ERR_NETWORK') return 'Can’t reach the TeamUp server. Is the API running?'
  }
  return fallback
}
