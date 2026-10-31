// pages/Inbox.tsx — "/inbox": requests you received (with Accept / Decline) and ones you sent.
// Answering a request PATCHes /api/requests/:id. Accepting is what actually adds someone to a
// team, so afterwards we reload both the request list and the session (your team may have changed).
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage, type TeamRequest } from '../lib/api'
import { ROLE_CHIP, timeAgo } from '../lib/format'
import { useMyRequests, useSession } from '../lib/session'
import { Avatar, btn, cardClass, cx, Empty, ErrorNote, Page, PageLoading } from '../components/ui'

// ["frontend", "pm"] -> "frontend, PM"
const chipList = (roles: string[]) => roles.map((r) => ROLE_CHIP[r as keyof typeof ROLE_CHIP] ?? r).join(', ')

/** Pending / Accepted / Declined pill. */
function StatusBadge({ status }: { status: TeamRequest['status'] }) {
  if (status === 'pending') return <span className="rounded-full bg-gray-700 px-3 py-1 text-sm text-gray-300">Pending</span>
  return (
    <span className={cx('rounded-full px-3 py-1 text-sm font-semibold', status === 'accepted' ? 'bg-indigo-900 text-indigo-300' : 'bg-gray-700 text-gray-400')}>
      {status === 'accepted' ? 'Accepted' : 'Declined'}
    </span>
  )
}

/** A request addressed to you. Pending ones have buttons; answered ones collapse to a one-line summary. */
function ReceivedCard({ r, onAnswer, busy }: { r: TeamRequest; onAnswer: (r: TeamRequest, s: 'accepted' | 'declined') => void; busy: boolean }) {
  const isJoin = r.type === 'join'
  const who = isJoin ? r.fromUserId : null
  const team = r.teamId
  const covers = who ? who.roles.filter((role) => team.neededRoles.includes(role)) : []

  if (r.status !== 'pending') {
    return (
      <li className={cx(cardClass, 'flex items-center gap-4 p-6')}>
        <Avatar name={isJoin ? r.fromUserId.name : team.name} muted={!isJoin} />
        <p className="flex-1 text-gray-400">
          {isJoin ? (
            <>
              {r.status === 'accepted' ? 'You accepted ' : 'Declined: '}
              <Link to={`/hackers/${r.fromUserId._id}`} className="font-bold text-gray-200 hover:underline">
                {r.fromUserId.name}
              </Link>
              {r.status === 'accepted' ? ' into ' : '’s request to join '}
            </>
          ) : (
            <>You {r.status} the invite to </>
          )}
          <Link to={`/teams/${team._id}`} className="hover:underline">
            {team.name}
          </Link>
        </p>
        <StatusBadge status={r.status} />
      </li>
    )
  }

  return (
    <li className={cx(cardClass, 'p-6')}>
      <div className="flex gap-4">
        <Avatar name={isJoin ? r.fromUserId.name : team.name} muted={!isJoin} />
        <div className="min-w-0 flex-1">
          <p className="text-lg">
            {isJoin ? (
              <>
                <Link to={`/hackers/${r.fromUserId._id}`} className="font-bold hover:underline">
                  {r.fromUserId.name}
                </Link>{' '}
                wants to join{' '}
                <Link to={`/teams/${team._id}`} className="font-bold hover:underline">
                  {team.name}
                </Link>
              </>
            ) : (
              <>
                <Link to={`/teams/${team._id}`} className="font-bold hover:underline">
                  {team.name}
                </Link>{' '}
                invited you to join
              </>
            )}
          </p>
          <p className="mt-1 text-sm text-gray-400">
            {isJoin ? 'Join request' : 'Invite'} · {timeAgo(r.createdAt)}
            {isJoin && covers.length > 0 && ` · covers ${chipList(covers)}`}
            {!isJoin && team.neededRoles.length > 0 && ` · they need ${chipList(team.neededRoles)}`}
          </p>
          {r.message && <blockquote className="mt-4 border-l-2 border-gray-700 pl-4 text-gray-200 italic">“{r.message}”</blockquote>}
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" disabled={busy} onClick={() => onAnswer(r, 'declined')} className={btn('secondary', 'sm')}>
              Decline
            </button>
            <button type="button" disabled={busy} onClick={() => onAnswer(r, 'accepted')} className={btn('primary', 'sm')}>
              Accept
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}

/** A request you sent, with its current status. */
function SentCard({ r }: { r: TeamRequest }) {
  const isJoin = r.type === 'join'
  return (
    <li className={cx(cardClass, 'flex flex-wrap items-center gap-4 p-6')}>
      <Avatar name={isJoin ? r.teamId.name : r.toUserId.name} muted={isJoin} />
      <div className="min-w-0 flex-1">
        <p>
          {isJoin ? 'You asked to join ' : 'You invited '}
          {!isJoin && (
            <>
              <Link to={`/hackers/${r.toUserId._id}`} className="font-bold hover:underline">
                {r.toUserId.name}
              </Link>{' '}
              to{' '}
            </>
          )}
          <Link to={`/teams/${r.teamId._id}`} className="font-bold hover:underline">
            {r.teamId.name}
          </Link>
        </p>
        <p className="mt-1 text-sm text-gray-400">{timeAgo(r.createdAt)}</p>
      </div>
      <StatusBadge status={r.status} />
    </li>
  )
}

export default function Inbox() {
  const { me, loading, refresh } = useSession()
  const { sent, received, reload } = useMyRequests()
  const [tab, setTab] = useState<'received' | 'sent'>('received')
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  if (loading) return <PageLoading />
  if (!me)
    return (
      <Page className="max-w-[820px]">
        <Empty title="Your inbox lives on your profile">
          <p>Create a profile to send and receive team requests.</p>
          <Link to="/onboard" className={cx(btn(), 'mt-6')}>
            Create profile
          </Link>
        </Empty>
      </Page>
    )

  const pending = received.filter((r) => r.status === 'pending').length

  // Accept or decline. actingUserId lets the server confirm it's really the recipient answering.
  const answer = async (r: TeamRequest, status: 'accepted' | 'declined') => {
    setBusyId(r._id)
    setError('')
    setNote('')
    try {
      await api.patch(`/requests/${r._id}`, { status, actingUserId: me._id })
      if (status === 'accepted') {
        setNote(r.type === 'join' ? `${r.fromUserId.name} is on ${r.teamId.name} now.` : `You joined ${r.teamId.name}.`)
      }
      await Promise.all([reload(), refresh()])
    } catch (err) {
      setError(errorMessage(err))
      reload()
    } finally {
      setBusyId('')
    }
  }

  const tabClass = (on: boolean) =>
    cx('-mb-px flex items-center gap-2 border-b-2 pb-3 text-[15px]', on ? 'border-indigo-400 font-semibold text-white' : 'border-transparent text-gray-400 hover:text-white')

  const list = tab === 'received' ? received : sent

  return (
    <Page className="max-w-[1280px]">
      <div className="mx-auto max-w-[820px]">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Inbox</h1>

        <div role="tablist" className="mt-8 flex gap-8 border-b border-gray-700">
          <button role="tab" aria-selected={tab === 'received'} onClick={() => setTab('received')} className={tabClass(tab === 'received')}>
            Received
            {pending > 0 && <span className="rounded-full bg-indigo-600 px-2 text-xs leading-5 font-semibold text-white">{pending}</span>}
          </button>
          <button role="tab" aria-selected={tab === 'sent'} onClick={() => setTab('sent')} className={tabClass(tab === 'sent')}>
            Sent
          </button>
        </div>

        <div className="mt-6 space-y-3">
          <ErrorNote>{error}</ErrorNote>
          {note && <p className="rounded-lg border border-indigo-800 bg-indigo-950 px-4 py-3 text-sm text-indigo-200">{note}</p>}
        </div>

        {list.length === 0 ? (
          <div className="mt-6">
            <Empty title={tab === 'received' ? 'Nothing here yet' : 'You haven’t sent anything'}>
              {tab === 'received' ? (
                'Join requests and invites show up here.'
              ) : (
                <Link to="/teams" className="text-indigo-300 hover:underline">
                  Browse open teams
                </Link>
              )}
            </Empty>
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
            {tab === 'received'
              ? received.map((r) => <ReceivedCard key={r._id} r={r} onAnswer={answer} busy={busyId === r._id} />)
              : sent.map((r) => <SentCard key={r._id} r={r} />)}
          </ul>
        )}
      </div>
    </Page>
  )
}
