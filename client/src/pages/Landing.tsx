// pages/Landing.tsx — the home page ("/"): hero text, two calls to action, and a live
// "top match" card that proves the matching works before you have even made a profile.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Match, type Team, type User } from '../lib/api'
import { capitalize } from '../lib/format'
import { useSession } from '../lib/session'
import { Avatar, btn, cardClass, cx, RoleChip } from '../components/ui'

interface TopMatch extends Match {
  team: Team
  hacker: User
}

/** Live preview: the best suggestion for the first open team that still needs roles. */
function TopMatchCard() {
  const [top, setTop] = useState<TopMatch | null>(null)

  // Find a team that still needs roles, ask the API for its single best suggestion, and show it.
  // `cancelled` stops a late response from updating state after the component unmounts.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: teams } = await api.get<Team[]>('/teams')
        for (const team of teams.filter((t) => t.neededRoles.length).reverse()) {
          const { data } = await api.get<(Match & { hacker: User })[]>(`/teams/${team._id}/suggestions`, { params: { limit: 1 } })
          if (data[0]) {
            if (!cancelled) setTop({ team, ...data[0] })
            return
          }
        }
      } catch {
        /* the hero still works without the preview card */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!top) return <div className={cx(cardClass, 'h-[374px] animate-pulse')} aria-hidden />

  const { team, hacker, score, reasons } = top
  return (
    <div className={cx(cardClass, 'p-6 shadow-[0_20px_50px_-20px_rgba(28,25,23,0.25)] sm:p-8')}>
      <p className="eyebrow">Top match for {team.name}</p>
      <div className="mt-5 flex items-center gap-4">
        <Avatar name={hacker.name} size={56} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl font-semibold">{hacker.name}</p>
          <p className="text-gray-400">
            {capitalize(hacker.level)} · {hacker.githubVerified ? <span className="text-indigo-300">GitHub verified</span> : 'self-reported'}
          </p>
        </div>
        <span className="font-display text-4xl font-semibold text-indigo-300" aria-label={`Match score ${score}`}>
          {score}
        </span>
      </div>
      <dl className="mt-6 space-y-3 border-t border-gray-700 pt-5 text-[15px]">
        {reasons.covers.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <dt className="text-gray-400">Covers</dt>
            {reasons.covers.map((r) => (
              <dd key={r}>
                <RoleChip role={r} />
              </dd>
            ))}
          </div>
        )}
        {reasons.shares.length > 0 && (
          <div className="flex gap-2">
            <dt className="text-gray-400">Shares</dt>
            <dd>{reasons.shares.join(', ')}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="text-gray-400">Level</dt>
          <dd>{reasons.similarLevel ? 'matches your team' : 'different from your team'}</dd>
        </div>
      </dl>
      <Link to={`/hackers/${hacker._id}`} className={cx(btn('light'), 'mt-7 w-full')}>
        Invite to {team.name}
      </Link>
    </div>
  )
}

// The three-step explainer under the hero.
const STEPS = [
  ['Build a profile', 'Roles, level, and an optional GitHub handle. Under two minutes.'],
  ['See ranked matches', 'Teams that need your skills, ranked with the reasons shown.'],
  ['Send one request', 'Captains accept from their inbox. Full teams close on their own.'],
]

export default function Landing() {
  const { me } = useSession()

  return (
    <>
      <main className="mx-auto grid max-w-[1280px] items-center gap-12 px-5 pt-14 pb-20 sm:px-10 lg:grid-cols-[1fr_490px] lg:gap-20 lg:px-16 lg:pt-24 lg:pb-24">
        <section>
          <p className="text-sm font-semibold tracking-[0.18em] text-indigo-300 uppercase">Team formation, minus the scramble</p>
          <h1 className="mt-6 max-w-[590px] font-display text-5xl leading-[1.02] font-semibold tracking-tight sm:text-[64px]">
            Find the teammates your project is missing.
          </h1>
          <p className="mt-7 max-w-[505px] text-lg leading-relaxed text-gray-300 sm:text-xl sm:leading-[1.63]">
            Tell us what you can do. We pull your languages from GitHub, rank the teams that need you, and show exactly why each one fits.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            {/* Already have a profile? Skip onboarding and go straight to the ranked teams. */}
            <Link to={me ? '/teams' : '/onboard'} className={btn('primary', 'lg')}>
              Find a team
            </Link>
            <Link to="/teams/new" className={cx(btn('secondary', 'lg'), 'bg-gray-800')}>
              Post a team
            </Link>
          </div>
          <p className="mt-6 text-sm text-gray-400 italic">No GitHub? No problem. Your self-reported roles drive the match.</p>
        </section>
        <TopMatchCard />
      </main>

      <section className="border-t border-gray-700">
        <ol className="mx-auto grid max-w-[1280px] sm:grid-cols-3">
          {STEPS.map(([title, body], i) => (
            <li
              key={title}
              className={cx(
                'px-5 py-10 sm:px-10 sm:py-12 lg:px-12',
                i === 0 && 'lg:pl-16',
                i < 2 && 'border-b border-gray-700 sm:border-r sm:border-b-0'
              )}
            >
              <span className="font-display text-5xl leading-none font-semibold text-gray-600">{i + 1}</span>
              <h2 className="mt-4 font-display text-2xl font-semibold">{title}</h2>
              <p className="mt-2 max-w-[290px] leading-relaxed text-gray-300">{body}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
