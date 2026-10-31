// pages/HackerProfile.tsx — "/hackers/:id": one hacker.
// Shows roles, bio, team status, recent repos and a languages chart. On your *own* profile
// you can edit languages, re-sync GitHub, and toggle "looking for a team". If you are a member
// of an open team and this person is available, an invite card appears.
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, errorMessage, teamIdOf, type Team, type User } from '../lib/api'
import { capitalize, listJoin, ROLE_CHIP, sortedSkills, timeAgo } from '../lib/format'
import { useMyRequests, useSession } from '../lib/session'
import { LanguageStack } from '../components/LanguageBars'
import { Avatar, btn, cardClass, cx, Empty, ErrorNote, inputClass, Page, PageLoading, RoleChips, Spinner } from '../components/ui'

/** Edit language shares by hand. Shares are re-normalized by the API to add up to 100%. */
function SkillsEditor({ user, onSaved, onCancel }: { user: User; onSaved: (u: User) => void; onCancel: () => void }) {
  const [rows, setRows] = useState(() => sortedSkills(user.skills).map(([lang, share]) => ({ lang, pct: Math.round(share * 100) })))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const skills = Object.fromEntries(rows.filter((r) => r.lang.trim() && r.pct > 0).map((r) => [r.lang.trim(), r.pct]))
    setSaving(true)
    try {
      const { data } = await api.patch<User>(`/users/${user._id}`, { skills })
      onSaved(data)
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2">
          <input
            aria-label="Language"
            value={row.lang}
            onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, lang: e.target.value } : r)))}
            className={cx(inputClass, 'py-2')}
          />
          <input
            aria-label={`${row.lang || 'Language'} share in percent`}
            type="number"
            min={0}
            max={100}
            value={row.pct}
            onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, pct: Number(e.target.value) } : r)))}
            className={cx(inputClass, 'w-24 py-2')}
          />
          <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`Remove ${row.lang}`} className="px-2 text-gray-400 hover:text-white">
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={() => setRows([...rows, { lang: '', pct: 10 }])} className="text-sm font-semibold text-indigo-300 hover:text-indigo-200">
        + Add a language
      </button>
      <ErrorNote>{error}</ErrorNote>
      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={saving} className={btn('primary', 'sm')}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className={btn('secondary', 'sm')}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/** The languages chart, with Edit and GitHub sync controls when it's your own profile. */
function LanguagesCard({ user, isMe, onChange }: { user: User; isMe: boolean; onChange: (u: User) => void }) {
  const [editing, setEditing] = useState(false)
  const [handle, setHandle] = useState(user.githubUsername ?? '')
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const hasSkills = Object.keys(user.skills).length > 0

  // Save a changed handle first (PATCH), then ask the server to pull from GitHub (POST).
  const sync = async () => {
    setSyncing(true)
    setError('')
    try {
      if (handle.trim() && handle.trim() !== user.githubUsername) {
        await api.patch(`/users/${user._id}`, { githubUsername: handle.trim() })
      }
      const { data } = await api.post<User>(`/users/${user._id}/sync-github`)
      onChange(data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSyncing(false)
    }
  }

  return (
    <section className={cx(cardClass, 'p-6 sm:p-7')}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">Languages</h2>
        {isMe && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="text-sm font-semibold text-indigo-300 hover:text-indigo-200">
            Edit
          </button>
        )}
      </div>

      <div className="mt-5">
        {editing ? (
          <SkillsEditor
            user={user}
            onCancel={() => setEditing(false)}
            onSaved={(u) => {
              onChange(u)
              setEditing(false)
            }}
          />
        ) : hasSkills ? (
          <LanguageStack skills={user.skills} />
        ) : (
          <p className="text-gray-400">No languages yet.</p>
        )}
      </div>

      {!editing && (
        <p className="mt-6 text-sm text-gray-400 italic">
          {user.githubVerified
            ? `From ${user.githubRepoCount ?? 'their'} public repos · synced ${timeAgo(user.githubSyncedAt)}`
            : 'Self-reported'}
        </p>
      )}

      {isMe && !editing && (
        <div className="mt-5 border-t border-gray-700 pt-5">
          <label htmlFor="gh" className="mb-2 block text-sm font-semibold">
            GitHub username
          </label>
          <div className="flex gap-2">
            <input id="gh" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="your-handle" className={cx(inputClass, 'py-2')} />
            <button type="button" onClick={sync} disabled={syncing || !handle.trim()} className={cx(btn('light', 'sm'), 'h-auto rounded-lg')}>
              Sync
            </button>
          </div>
          <div className="mt-2 text-sm" aria-live="polite">
            {syncing && <Spinner label="Reading public repos…" />}
            {error && <span className="text-rose-300">{error}</span>}
          </div>
        </div>
      )}
    </section>
  )
}

/** Invite this hacker to the viewer's team, with an optional note. */
function InviteCard({ hacker, team, onSent }: { hacker: User; team: Team; onSent: () => void }) {
  const { me } = useSession()
  const [message, setMessage] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')
  const first = hacker.name.split(' ')[0]
  const covers = hacker.roles.filter((r) => team.neededRoles.includes(r))

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!me) return
    setState('sending')
    setError('')
    try {
      await api.post('/requests', { type: 'invite', fromUserId: me._id, toUserId: hacker._id, teamId: team._id, message })
      setState('sent')
      onSent()
    } catch (err) {
      setError(errorMessage(err))
      setState('idle')
    }
  }

  return (
    <section className="rounded-2xl bg-indigo-600 p-6 sm:p-7">
      <h2 className="font-display text-xl font-semibold">Invite {first}</h2>
      <p className="mt-2 text-sm text-indigo-100">
        {covers.length === 0
          ? `${team.name} doesn’t list ${first}’s roles as needed, but you can still invite them.`
          : covers.length === team.neededRoles.length && covers.length > 1
            ? `${first} covers both roles ${team.name} still needs.`
            : `${first} covers ${listJoin(covers.map((r) => ROLE_CHIP[r]))} for ${team.name}.`}
      </p>
      {state === 'sent' ? (
        <p className="mt-5 rounded-lg bg-indigo-700 px-4 py-3 font-semibold">Invite sent ✓ It’s in {first}’s inbox.</p>
      ) : (
        <form onSubmit={send} className="mt-5 space-y-3">
          <p className="rounded-lg bg-indigo-700 px-4 py-3">{team.name}</p>
          <label className="block">
            <span className="sr-only">Note</span>
            <textarea
              rows={3}
              maxLength={300}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a note (optional)…"
              className="w-full rounded-lg bg-indigo-700 px-4 py-3 text-sm placeholder:text-indigo-200 focus:ring-2 focus:ring-white/60 focus:outline-none"
            />
          </label>
          {error && <p className="text-sm text-rose-100">{error}</p>}
          <button type="submit" disabled={state === 'sending'} className={cx(btn('light'), 'w-full text-indigo-700')}>
            {state === 'sending' ? 'Sending…' : 'Send invite'}
          </button>
        </form>
      )}
    </section>
  )
}

export default function HackerProfile() {
  const { id = '' } = useParams()
  const { me, refresh } = useSession()
  const { sent, reload } = useMyRequests()
  const [user, setUser] = useState<User | null>(null)
  const [myTeam, setMyTeam] = useState<Team | null>(null)
  const [error, setError] = useState('')

  // Load the profile for the id in the URL. Re-runs if you navigate from one profile to another.
  const load = useCallback(async () => {
    try {
      const { data } = await api.get<User>(`/users/${id}`)
      setUser(data)
    } catch (err) {
      setError(errorMessage(err))
    }
  }, [id])

  useEffect(() => {
    setUser(null)
    setError('')
    load()
  }, [load])

  // Also load the viewer's own team, so we know whether they can invite this person.
  const myTeamId = teamIdOf(me)
  useEffect(() => {
    if (!myTeamId) return setMyTeam(null)
    api
      .get<Team>(`/teams/${myTeamId}`)
      .then(({ data }) => setMyTeam(data))
      .catch(() => setMyTeam(null))
  }, [myTeamId])

  if (error) return <Page>{/not found|invalid/i.test(error) ? <Empty title="Hacker not found" /> : <ErrorNote>{error}</ErrorNote>}</Page>
  if (!user) return <PageLoading />

  const isMe = me?._id === user._id
  const team = typeof user.teamId === 'object' ? user.teamId : null
  const alreadyInvited = sent.some((r) => r.type === 'invite' && r.status === 'pending' && r.toUserId._id === user._id)
  // You can invite someone if you are on an open team, they are not you, and they are available.
  const canInvite = !isMe && myTeam?.isOpen && !user.teamId && user.lookingForTeam

  const updateMe = (u: User) => {
    setUser(u)
    refresh()
  }

  return (
    <Page className="grid gap-12 lg:grid-cols-[1fr_400px] lg:gap-12">
      <section className="min-w-0">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          <Avatar name={user.name} size={96} />
          <div>
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{user.name}</h1>
            <p className="mt-2 text-lg text-gray-300">
              {capitalize(user.level)}
              {user.githubVerified && <span className="text-indigo-300"> · ✓ GitHub verified</span>}
              {user.githubUsername && (
                <>
                  {' · '}
                  <a href={`https://github.com/${user.githubUsername}`} target="_blank" rel="noreferrer" className="hover:text-white">
                    @{user.githubUsername}
                  </a>
                </>
              )}
            </p>
          </div>
        </div>

        {user.bio && <p className="mt-8 max-w-[640px] text-lg leading-relaxed sm:text-xl sm:leading-[1.63]">{user.bio}</p>}
        <div className="mt-5">
          <RoleChips roles={user.roles} />
        </div>

        <p className="mt-6 text-gray-300">
          {team ? (
            <>
              On team{' '}
              <Link to={`/teams/${team._id}`} className="font-semibold text-indigo-300 hover:underline">
                {team.name}
              </Link>
            </>
          ) : user.lookingForTeam ? (
            'Looking for a team'
          ) : (
            'Not looking for a team right now'
          )}
          {isMe && !team && (
            <button
              type="button"
              onClick={async () => updateMe((await api.patch<User>(`/users/${user._id}`, { lookingForTeam: !user.lookingForTeam })).data)}
              className="ml-3 text-sm font-semibold text-indigo-300 hover:text-indigo-200"
            >
              {user.lookingForTeam ? 'Hide me from suggestions' : 'I’m looking again'}
            </button>
          )}
        </p>

        {user.recentRepos && user.recentRepos.length > 0 && (
          <>
            <h2 className="eyebrow mt-12">Recently pushed repos</h2>
            <ul className={cx(cardClass, 'mt-4 divide-y divide-gray-700')}>
              {user.recentRepos.map((r) => (
                <li key={r.name} className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="min-w-0">
                    <p className="font-semibold">{r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="hover:text-indigo-200">{r.name}</a> : r.name}</p>
                    {r.description && <p className="truncate text-sm text-gray-400">{r.description}</p>}
                  </div>
                  <span className="shrink-0 text-sm text-gray-400">{r.language}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="space-y-6">
        {/* The key resets the card's edit state after a sync, so the form never shows stale values. */}
        <LanguagesCard key={user._id + (user.githubSyncedAt ?? '')} user={user} isMe={isMe} onChange={updateMe} />
        {canInvite && myTeam && !alreadyInvited && <InviteCard hacker={user} team={myTeam} onSent={reload} />}
        {canInvite && alreadyInvited && (
          <p className="rounded-2xl bg-indigo-950 px-6 py-5 text-indigo-200">You’ve invited {user.name.split(' ')[0]} to {myTeam?.name}. Waiting on their answer.</p>
        )}
      </div>
    </Page>
  )
}
