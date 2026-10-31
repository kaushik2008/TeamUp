// Layout.tsx — the frame around every page: nav bar on top, demo switcher in the footer.
// React Router renders the current page where <Outlet /> is.
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api, teamOf, type User } from '../lib/api'
import { useSession } from '../lib/session'
import { Avatar, btn, cx } from './ui'

/** Top bar: logo, Teams / Hackers / Inbox links (with a pending-count badge), and your avatar. */
function NavBar() {
  const { me, pendingCount } = useSession()
  const { pathname } = useLocation()
  const onLanding = pathname === '/'
  const myTeam = teamOf(me) // null unless the signed-in hacker is on a team

  // NavLink passes isActive so the current section can be underlined.
  const link = ({ isActive }: { isActive: boolean }) =>
    cx(
      'relative py-1 text-sm transition-colors sm:text-[15px]',
      isActive ? 'font-semibold text-white after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:bg-indigo-400' : 'text-gray-300 hover:text-white'
    )

  return (
    <header className="border-b border-gray-700">
      <div className="mx-auto flex h-[64px] max-w-[1280px] items-center gap-3 px-4 sm:h-[89px] sm:px-10 lg:px-16">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-display text-xl font-semibold tracking-tight sm:text-2xl">TeamUp</span>
          {onLanding && <span className="hidden text-sm text-gray-400 italic sm:inline">for HowToHackathon</span>}
        </Link>
        <nav className="ml-auto flex items-center gap-4 sm:gap-10">
          <NavLink to="/teams" className={link} end={false}>
            Teams
          </NavLink>
          <NavLink to="/hackers" className={link}>
            Hackers
          </NavLink>
          <NavLink to="/inbox" className={link}>
            <span className="inline-flex items-center gap-1.5 sm:gap-2">
              Inbox
              {pendingCount > 0 && (
                <span className="rounded-full bg-indigo-600 px-2 text-xs leading-5 font-semibold text-white" aria-label={`${pendingCount} pending`}>
                  {pendingCount}
                </span>
              )}
            </span>
          </NavLink>
          {me ? (
            <>
              {/* One-click shortcut to your own team page. Only renders once you've joined or posted a team. */}
              {myTeam && (
                <Link to={`/teams/${myTeam._id}`} className={cx(btn('secondary', 'sm'), 'h-[38px]')} title={myTeam.name}>
                  My team
                </Link>
              )}
              <Link to={`/hackers/${me._id}`} aria-label="Your profile" className="rounded-full focus-visible:outline-2 focus-visible:outline-indigo-400">
                <Avatar name={me.name} size={36} />
              </Link>
            </>
          ) : (
            <span className="hidden sm:block">
              <Link to="/onboard" className={cx(btn('primary', 'sm'), 'h-[42px]')}>
                Create profile
              </Link>
            </span>
          )}
        </nav>
      </div>
    </header>
  )
}

/** Lets a presenter act as any seeded hacker, since v1 has no login. */
function DemoSwitcher() {
  const { me, signIn, signOut } = useSession()
  // Everyone in the database (all=1 includes people already on teams, so you can act as a captain).
  const [people, setPeople] = useState<User[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    api
      .get<User[]>('/users', { params: { all: 1 } })
      .then(({ data }) => setPeople(data.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setPeople([]))
  }, [me?._id])

  return (
    <footer className="border-t border-gray-800">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 px-5 py-6 text-sm text-gray-500 sm:px-10 lg:px-16">
        <span>TeamUp · built for HowToHackathon</span>
        <label className="ml-auto flex items-center gap-2">
          <span>Demo: viewing as</span>
          <select
            className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-gray-300"
            value={me?._id ?? ''}
            onChange={(e) => {
              if (e.target.value) signIn(e.target.value)
              else signOut()
              navigate('/teams')
            }}
          >
            <option value="">Nobody (signed out)</option>
            {people.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </footer>
  )
}

/** Page frame. The onboarding page hides the nav bar so the form gets the full width. */
export default function Layout() {
  const { pathname } = useLocation()
  useEffect(() => {
    // Start each new page at the top (single-page apps don't do this on their own).
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="flex min-h-dvh flex-col">
      {pathname !== '/onboard' && <NavBar />}
      <div className="flex-1">
        <Outlet />
      </div>
      <DemoSwitcher />
    </div>
  )
}
