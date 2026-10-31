// pages/TeamDetail.tsx — "/teams/:id": one team.
// Left: idea, track, stack, members, and dashed "open spot" rows for each unfilled seat.
// Right: hackers ranked for this team's gaps (GET /api/teams/:id/suggestions). Members can
// invite from here; non-members see a "Request to join" button instead.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, errorMessage, teamIdOf, type Match, type Role, type Team, type User } from '../lib/api'
import { capitalize, ROLE_CHIP } from '../lib/format'
import { useMyRequests, useSession } from '../lib/session'
import { Avatar, btn, cardClass, cx, Empty, ErrorNote, MatchReasons, Page, PageLoading, roleText } from '../components/ui'

type Suggestion = Match & { hacker: User }

/** A current member, linking to their profile. */
function MemberRow({ member, captain }: { member: User; captain: boolean }) {
  return (
    <li className="relative flex items-center gap-4 rounded-xl border border-gray-700 bg-gray-800 px-4 py-4 hover:border-gray-500">
      <Avatar name={member.name} />
      <div>
        <p>
          <Link to={`/hackers/${member._id}`} className="font-semibold after:absolute after:inset-0">
            {member.name}
          </Link>
          {captain && <span className="text-gray-400 italic"> · captain</span>}
        </p>
        <p className="text-sm text-gray-400">
          {member.roles.map((r) => ROLE_CHIP[r]).join(', ')} ·{' '}
          {capitalize(member.level)}
        </p>
      </div>
    </li>
  )
}

/** A dashed placeholder for an unfilled seat, labelled with the next needed role if there is one. */
function OpenSpot({ role }: { role?: Role }) {
  return (
    <li className="flex items-center gap-4 rounded-xl border-2 border-dashed border-gray-600 px-4 py-4">
      <span className="flex size-11 items-center justify-center rounded-full border border-dashed border-gray-600 text-gray-400">+</span>
      <span className="text-gray-400">
        Open spot: <span className={role ? roleText(role) : 'text-gray-300'}>{role ? ROLE_CHIP[role] : 'any role'}</span>
      </span>
    </li>
  )
}

/** One ranked hacker with their score and reasons. The top result is highlighted. */
function SuggestionCard({
  s,
  top,
  canInvite,
  invited,
  onInvite,
}: {
  s: Suggestion
  top: boolean
  canInvite: boolean
  invited: boolean
  onInvite: (u: User) => void
}) {
  const { hacker } = s
  return (
    <li className={cx('rounded-xl p-5 sm:p-6', top ? 'border-2 border-indigo-500' : 'border border-gray-700')}>
      <div className="flex items-start gap-4">
        <Avatar name={hacker.name} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold">{hacker.name}</p>
          <p className="text-sm text-gray-400">
            {capitalize(hacker.level)} · {hacker.githubVerified ? '✓ verified' : 'self-reported'}
          </p>
        </div>
        <span className={cx('font-display text-3xl font-semibold', top ? 'text-indigo-300' : 'text-gray-200')} aria-label={`Score ${s.score}`}>
          {s.score}
        </span>
      </div>
      <MatchReasons reasons={s.reasons} className="mt-4" />
      <div className="mt-4 flex flex-wrap gap-2">
        {canInvite &&
          (invited ? (
            <span className="inline-flex h-9 items-center text-sm font-semibold text-indigo-300">Invited ✓</span>
          ) : (
            <button type="button" onClick={() => onInvite(hacker)} className={btn(top ? 'primary' : 'secondary', 'sm')}>
              Invite
            </button>
          ))}
        {(top || !canInvite) && (
          <Link to={`/hackers/${hacker._id}`} className={btn('secondary', 'sm')}>
            View profile
          </Link>
        )}
      </div>
    </li>
  )
}

export default function TeamDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { me, refresh } = useSession()
  const { sent, reload } = useMyRequests()
  const [team, setTeam] = useState<Team | null>(null)
  const [leave, setLeave] = useState<'idle' | 'confirm' | 'busy'>('idle') // the "Leave team" button's two-step confirm
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)

  // Load the team, then its suggestions. "Not found" and bad ids get a friendly page instead of an error box.
  const load = useCallback(async () => {
    try {
      const { data } = await api.get<Team>(`/teams/${id}`)
      setTeam(data)
      const { data: sugg } = await api.get<Suggestion[]>(`/teams/${id}/suggestions`, { params: { limit: 5 } })
      setSuggestions(sugg)
    } catch (err) {
      if (errorMessage(err).match(/not found|invalid/i)) setNotFound(true)
      else setError(errorMessage(err))
    }
  }, [id])

  useEffect(() => {
    setTeam(null)
    setSuggestions(null)
    setNotFound(false)
    load()
  }, [load])

  // What the signed-in user can do here depends on whether they are on this team.
  const isMember = Boolean(me && team?.memberIds.includes(me._id))
  const invitedIds = useMemo(
    () => new Set(sent.filter((r) => r.type === 'invite' && r.status === 'pending' && r.teamId._id === id).map((r) => r.toUserId._id)),
    [sent, id]
  )
  const requested = sent.some((r) => r.type === 'join' && r.status === 'pending' && r.teamId._id === id)

  const invite = async (hacker: User) => {
    if (!me) return
    try {
      await api.post('/requests', { type: 'invite', fromUserId: me._id, toUserId: hacker._id, teamId: id })
      reload()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const requestToJoin = async () => {
    if (!me) return
    try {
      await api.post('/requests', { type: 'join', fromUserId: me._id, teamId: id })
      reload()
      refresh()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  // Leave this team. The server frees the seat (and may pass the captaincy or delete an emptied
  // team); then we refresh the session and go to the teams list, which is ranked for you again.
  const leaveTeam = async () => {
    if (!me) return
    setLeave('busy')
    try {
      await api.post(`/teams/${id}/leave`, { userId: me._id })
      await refresh()
      navigate('/teams', { state: { notice: `You left ${team?.name}. Teams are ranked for you again, and you can request to join one.` } })
    } catch (err) {
      setError(errorMessage(err))
      setLeave('idle')
    }
  }

  if (notFound)
    return (
      <Page>
        <Empty title="Team not found">
          <Link to="/teams" className="text-indigo-300 hover:underline">
            Back to open teams
          </Link>
        </Empty>
      </Page>
    )
  if (!team) return error ? <Page><ErrorNote>{error}</ErrorNote></Page> : <PageLoading />

  const members = team.members ?? []
  const nextCaptain = members.find((m) => m._id !== me?._id)?.name ?? 'the next member' // shown in the leave confirm
  const openSpots = Math.max(0, team.maxSize - members.length)
  // One placeholder per open seat; the first ones are labelled with the roles still needed.
  const spotRoles: (Role | undefined)[] = Array.from({ length: openSpots }, (_, i) => team.neededRoles[i])

  return (
    <Page className="grid gap-12 lg:grid-cols-[1fr_520px] lg:gap-12">
      <section className="min-w-0">
        <p className="text-sm text-gray-400">
          <Link to="/teams" className="hover:text-white">
            Teams
          </Link>{' '}
          / {team.name}
        </p>
        <h1 className="mt-2 font-display text-5xl leading-tight font-semibold tracking-tight sm:text-[56px]">{team.name}</h1>
        <p className="mt-3 max-w-[520px] text-lg leading-relaxed text-gray-300 sm:text-xl sm:leading-[1.63]">{team.idea}</p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          {/* Labelled pills, tinted like the role chips: a bold colored label, then the value in white. */}
          <span className="rounded-full border border-indigo-700 bg-indigo-950 px-3 py-1 text-white">
            <span className="font-semibold text-indigo-300">Category: </span>
            {team.track}
          </span>
          {team.stack.length > 0 && (
            <span className="rounded-full border border-violet-700 bg-violet-950 px-3 py-1 text-white">
              <span className="font-semibold text-violet-300">Stack: </span>
              {team.stack.join(' · ')}
            </span>
          )}
          {!team.isOpen && <span className="rounded-full bg-gray-700 px-3 py-1 text-gray-300">Full · closed</span>}
        </div>

        {team.isOpen && !isMember && (
          <div className="mt-6">
            {!me ? (
              <Link to="/onboard" className={btn()}>
                Create a profile to join
              </Link>
            ) : teamIdOf(me) ? null : requested ? (
              <span className="font-semibold text-indigo-300">Request sent ✓ · the captain will see it in their inbox</span>
            ) : (
              <button type="button" onClick={requestToJoin} className={btn()}>
                Request to join
              </button>
            )}
          </div>
        )}

        {/* Members can leave. A two-step confirm explains what happens to the team first. */}
        {isMember && me && (
          <div className="mt-6">
            {leave === 'idle' ? (
              <button type="button" onClick={() => setLeave('confirm')} className={btn('secondary', 'sm')}>
                Leave team
              </button>
            ) : (
              <div className="max-w-[520px] rounded-xl border border-gray-700 bg-gray-800 p-5">
                <p className="font-semibold">Leave {team.name}?</p>
                <p className="mt-1 text-sm text-gray-400">
                  {members.length === 1
                    ? 'You’re the only member, so the team will be removed.'
                    : me._id === team.ownerId
                      ? `You’re the captain, so ${nextCaptain} will take over. You’ll be able to request to join other teams again.`
                      : 'Your seat opens up and you’ll be able to request to join other teams again.'}
                </p>
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={leaveTeam} disabled={leave === 'busy'} className={btn('primary', 'sm')}>
                    {leave === 'busy' ? 'Leaving…' : 'Yes, leave'}
                  </button>
                  <button type="button" onClick={() => setLeave('idle')} disabled={leave === 'busy'} className={btn('secondary', 'sm')}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4">
          <ErrorNote>{error}</ErrorNote>
        </div>

        <h2 className="eyebrow mt-8">
          Members · {members.length} of {team.maxSize}
        </h2>
        <ul className="mt-4 max-w-[584px] space-y-3">
          {members.map((m) => (
            <MemberRow key={m._id} member={m} captain={m._id === team.ownerId} />
          ))}
          {team.isOpen && spotRoles.map((r, i) => <OpenSpot key={i} role={r} />)}
        </ul>
      </section>

      <aside className={cx(cardClass, 'self-start p-6 sm:p-8')}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold">Suggested hackers</h2>
          <span className="text-sm text-gray-400">ranked for {isMember ? 'your' : 'their'} gaps</span>
        </div>
        <p className="mt-2 text-sm text-gray-400 italic">+3 per needed role covered · +1 per shared language · +1 similar level</p>

        {!team.isOpen ? (
          <p className="mt-6 text-gray-300">This team is full, so it isn’t looking for anyone.</p>
        ) : !suggestions ? (
          <div className="mt-6">
            <PageLoading />
          </div>
        ) : suggestions.length === 0 ? (
          <p className="mt-6 text-gray-300">No available hackers fill these gaps yet. Check back as more people sign up.</p>
        ) : (
          <ul className="mt-6 space-y-4">
            {suggestions.map((s, i) => (
              <SuggestionCard key={s.hacker._id} s={s} top={i === 0} canInvite={isMember} invited={invitedIds.has(s.hacker._id)} onInvite={invite} />
            ))}
          </ul>
        )}
      </aside>
    </Page>
  )
}
