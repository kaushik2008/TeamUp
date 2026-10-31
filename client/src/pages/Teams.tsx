// pages/Teams.tsx — "/teams": browse open teams.
// Filters (needed role, track) are React state; changing one re-fetches from GET /api/teams.
// When you are signed in and not on a team, the API also returns a match score per team and
// sorts best-first, so the first open card gets the "Best match" border.
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api, errorMessage, teamIdOf, teamOf, type Role, type Team } from '../lib/api'
import { listJoin, ROLE_CHIP, ROLE_LABEL, ROLES, TRACKS } from '../lib/format'
import { useMyRequests, useSession } from '../lib/session'
import { btn, cx, Empty, ErrorNote, MatchReasons, Page, PageLoading, RoleChip } from '../components/ui'

/** One team in the grid. The whole card is a link; the button sits above it with z-10. */
function TeamCard({
  team,
  best,
  requested,
  canRequest,
  onRequest,
}: {
  team: Team
  best: boolean
  requested: boolean
  canRequest: boolean
  onRequest: (team: Team) => void
}) {
  const filled = team.memberIds.length
  return (
    <article
      className={cx(
        'relative flex flex-col rounded-2xl bg-gray-800 p-6 sm:p-7',
        best ? 'border-2 border-indigo-500' : 'border border-gray-700',
        !team.isOpen && 'opacity-60'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold">
          <Link to={`/teams/${team._id}`} className="after:absolute after:inset-0 after:rounded-2xl hover:text-indigo-200">
            {team.name}
          </Link>
        </h2>
        {best && <span className="shrink-0 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold">Best match</span>}
        {!team.isOpen && <span className="shrink-0 rounded-full bg-gray-700 px-3 py-1 text-xs font-semibold text-gray-300">Full</span>}
      </div>
      <p className="mt-2 leading-relaxed text-gray-300">{team.idea}</p>
      <p className="mt-3 text-sm text-gray-400 italic">{team.track} track</p>

      <div className="mt-4 flex min-h-[30px] flex-wrap items-center gap-2 text-sm">
        {team.isOpen && team.neededRoles.length ? (
          <>
            <span className="text-gray-400">Needs</span>
            {team.neededRoles.map((r) => (
              <RoleChip key={r} role={r} />
            ))}
          </>
        ) : (
          <span className="text-gray-400">{team.isOpen ? 'Open to any role' : 'Team complete'}</span>
        )}
      </div>

      {team.match && (team.match.reasons.covers.length > 0 || team.match.reasons.shares.length > 0) && (
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-sm font-semibold text-indigo-300">{team.match.score}</span>
          <MatchReasons reasons={team.match.reasons} />
        </div>
      )}

      <div className="min-h-6 flex-1" />
      <div className="flex items-center justify-between gap-3 border-t border-gray-700 pt-5">
        <span className="text-sm text-gray-400">
          {filled} of {team.maxSize} spots filled
        </span>
        {!team.isOpen ? (
          <span className="text-sm text-gray-500">Closed</span>
        ) : requested ? (
          <span className="relative z-10 text-sm font-semibold text-indigo-300">Requested ✓</span>
        ) : canRequest ? (
          <button type="button" onClick={() => onRequest(team)} className={cx(btn(best ? 'light' : 'secondary', 'sm'), 'relative z-10')}>
            Request to join
          </button>
        ) : null}
      </div>
    </article>
  )
}

export default function Teams() {
  const { me } = useSession()
  const { sent, reload } = useMyRequests()
  const navigate = useNavigate()
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const [roles, setRoles] = useState<Role[]>([])
  const [track, setTrack] = useState('')
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [error, setError] = useState('')

  const looking = Boolean(me && !teamIdOf(me))
  const myTeam = teamOf(me) // set when the viewer is already on a team

  // Fetch whenever a filter or the signed-in user changes. includeClosed=1 so full teams still show, greyed out.
  useEffect(() => {
    let cancelled = false
    setError('')
    api
      .get<Team[]>('/teams', {
        params: { includeClosed: 1, role: roles.join(',') || undefined, track: track || undefined, forUser: me?._id },
      })
      .then(({ data }) => !cancelled && setTeams(data))
      .catch((err) => !cancelled && setError(errorMessage(err)))
    return () => {
      cancelled = true
    }
  }, [roles, track, me?._id])

  // Teams you have already asked to join, so the card shows "Requested ✓" instead of the button.
  const requestedTeamIds = useMemo(
    () => new Set(sent.filter((r) => r.type === 'join' && r.status === 'pending').map((r) => r.teamId._id)),
    [sent]
  )

  const open = teams?.filter((t) => t.isOpen) ?? []
  const bestId = looking && open[0]?.match && open[0].match.score > 0 ? open[0]._id : null
  const countNeeding = (r: Role) => open.filter((t) => t.neededRoles.includes(r)).length

  // Send a join request to the team's captain. It appears in their inbox.
  const requestToJoin = async (team: Team) => {
    if (!me) return navigate('/onboard')
    try {
      await api.post('/requests', { type: 'join', fromUserId: me._id, teamId: team._id })
      reload()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const myLanguages = me ? Object.keys(me.skills).slice(0, 1) : []

  return (
    <Page className="grid gap-10 lg:grid-cols-[240px_1fr] lg:gap-12">
      <aside className="space-y-8 lg:pt-1">
        <fieldset>
          <legend className="eyebrow mb-4">Needs a</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {ROLES.map((r) => {
              const on = roles.includes(r)
              return (
                <label key={r} className="flex cursor-pointer items-center gap-2 text-[15px]">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => setRoles(on ? roles.filter((x) => x !== r) : [...roles, r])}
                    className="size-4 rounded border-gray-500 bg-transparent accent-indigo-500"
                  />
                  <span className={on ? 'font-semibold' : ''}>{ROLE_LABEL[r]}</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="track" className="eyebrow mb-4 block">
            Track
          </label>
          <select
            id="track"
            value={track}
            onChange={(e) => setTrack(e.target.value)}
            className="h-[45px] w-full rounded-lg border border-gray-600 bg-gray-800 px-4 text-[15px]"
          >
            <option value="">All tracks</option>
            {TRACKS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        {looking && me && (
          <p className="rounded-xl bg-indigo-950 px-5 py-5 text-[15px] leading-relaxed text-indigo-200">
            Ranked for your roles: {listJoin([...me.roles.map((r) => ROLE_CHIP[r]), ...myLanguages])}.
          </p>
        )}
        {/* Already on a team: no ranking for you, but a quick way back to your own team page. */}
        {myTeam && (
          <div className="rounded-xl bg-indigo-950 px-5 py-5 text-[15px] leading-relaxed text-indigo-200">
            <p>
              You’re on <span className="font-semibold text-white">{myTeam.name}</span>.
            </p>
            <Link to={`/teams/${myTeam._id}`} className={cx(btn('light', 'sm'), 'mt-4 w-full')}>
              View your team
            </Link>
          </div>
        )}
        {!me && (
          <p className="rounded-xl bg-indigo-950 px-5 py-5 text-[15px] leading-relaxed text-indigo-200">
            <Link to="/onboard" className="font-semibold underline underline-offset-2">
              Create a profile
            </Link>{' '}
            to see teams ranked for your skills.
          </p>
        )}
      </aside>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Open teams</h1>
            {teams && (
              <p className="mt-2 text-gray-300">
                {open.length} team{open.length === 1 ? '' : 's'} looking
                {me && me.roles[0] ? ` · ${countNeeding(me.roles[0])} need ${ROLE_CHIP[me.roles[0]]}` : ''}
              </p>
            )}
          </div>
          <Link to="/teams/new" className={btn('primary')}>
            + Post a team
          </Link>
        </div>

        <div className="mt-6 space-y-3">
          {notice && <p className="rounded-lg border border-amber-900 bg-amber-950/50 px-4 py-3 text-sm text-amber-200">{notice}</p>}
          <ErrorNote>{error}</ErrorNote>
        </div>

        {!teams && !error ? (
          <PageLoading />
        ) : teams && teams.length === 0 ? (
          <div className="mt-8">
            <Empty title="No teams match those filters">Try clearing a filter, or post your own team.</Empty>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {teams?.map((t) => (
              <TeamCard
                key={t._id}
                team={t}
                best={t._id === bestId}
                requested={requestedTeamIds.has(t._id)}
                canRequest={!me || looking}
                onRequest={requestToJoin}
              />
            ))}
          </div>
        )}
      </section>
    </Page>
  )
}
