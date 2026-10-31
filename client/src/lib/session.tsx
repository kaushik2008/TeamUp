// ============================================================================
// session.tsx — "who is using the app right now", shared with every page via React Context.
//
// v1 has no login (auth is a stretch goal). Instead:
//   - when you create a profile, the browser remembers its id in localStorage
//   - the demo switcher in the footer can set that id to any seeded hacker
//
// Exports:
//   <SessionProvider>  wraps the whole app (see App.tsx) and loads the current user
//   useSession()       any component can read `me`, `loading`, `pendingCount`, or sign in/out
//   useMyRequests()    the current user's sent/received requests, for "Requested ✓" buttons
// ============================================================================
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, type User, type TeamRequest } from './api'

const STORAGE_KEY = 'teamup:userId'

interface Session {
  me: User | null // the signed-in hacker, or null when nobody is signed in
  loading: boolean // true while we fetch `me` on first load
  pendingCount: number // unanswered requests in the inbox, shown as a badge in the nav bar
  signIn: (userId: string) => void
  signOut: () => void
  refresh: () => Promise<void> // re-fetch `me` after something changed (joined a team, edited skills)
}

const SessionContext = createContext<Session | null>(null)

// localStorage can throw in private browsing, so every access is wrapped in try/catch.
function readStoredId() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(readStoredId)
  const [me, setMe] = useState<User | null>(null)
  const [loading, setLoading] = useState(Boolean(userId))
  const [pendingCount, setPendingCount] = useState(0)

  // Load the user's profile and inbox count. Runs on mount and whenever userId changes.
  const refresh = useCallback(async () => {
    if (!userId) {
      setMe(null)
      setPendingCount(0)
      setLoading(false)
      return
    }
    try {
      const [{ data: user }, { data: inbox }] = await Promise.all([
        api.get<User>(`/users/${userId}`),
        api.get<{ received: TeamRequest[] }>('/requests', { params: { userId } }),
      ])
      setMe(user)
      setPendingCount(inbox.received.filter((r) => r.status === 'pending').length)
    } catch {
      // The stored profile no longer exists (e.g. the database was re-seeded). Act signed out.
      setMe(null)
      setPendingCount(0)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const signIn = useCallback((id: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* storage can be unavailable in private mode; the session still works in memory */
    }
    setLoading(true)
    setUserId(id) // triggers refresh() through the effect above
  }, [])

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    setUserId(null)
  }, [])

  return (
    <SessionContext.Provider value={{ me, loading, pendingCount, signIn, signOut, refresh }}>
      {children}
    </SessionContext.Provider>
  )
}

/** Read the session from any component. Throws if used outside <SessionProvider>, which is a bug. */
// eslint-disable-next-line react-refresh/only-export-components
export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}

/**
 * The signed-in hacker's sent and received requests.
 * Pages use this to show "Requested ✓" / "Invited ✓" instead of a button when a request
 * is already pending, and call `reload()` right after sending a new one.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useMyRequests() {
  const { me } = useSession()
  const [sent, setSent] = useState<TeamRequest[]>([])
  const [received, setReceived] = useState<TeamRequest[]>([])

  const reload = useCallback(async () => {
    if (!me) {
      setSent([])
      setReceived([])
      return
    }
    try {
      const { data } = await api.get<{ sent: TeamRequest[]; received: TeamRequest[] }>('/requests', { params: { userId: me._id } })
      setSent(data.sent)
      setReceived(data.received)
    } catch {
      /* non-critical: buttons just won't show the pending state */
    }
  }, [me])

  useEffect(() => {
    reload()
  }, [reload])

  return { sent, received, reload }
}
