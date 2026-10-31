// pages/NewTeam.tsx — "/teams/new": post a team.
// You must have a profile and not already be on a team; otherwise the page explains why.
// Submitting POSTs to /api/teams and jumps to the new team's page.
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, errorMessage, teamIdOf, type Role, type Team } from '../lib/api'
import { TRACKS } from '../lib/format'
import { useSession } from '../lib/session'
import TagInput from '../components/TagInput'
import { btn, cx, Empty, ErrorNote, inputClass, Label, Page, PageLoading, RolePicker } from '../components/ui'

/** A "− 4 +" control for the team size (2 to 6). */
function SizeStepper({ value, onChange, min, max }: { value: number; onChange: (n: number) => void; min: number; max: number }) {
  const step = 'flex w-[50px] items-center justify-center text-lg text-gray-400 hover:text-white disabled:opacity-30'
  return (
    <div className="flex h-[50px] items-center rounded-lg border border-gray-600 bg-gray-800">
      <button type="button" className={cx(step, 'h-full border-r border-gray-700')} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="Smaller team">
        −
      </button>
      <output className="flex-1 text-center font-semibold" aria-live="polite">
        {value}
      </output>
      <button type="button" className={cx(step, 'h-full border-l border-gray-700')} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="Bigger team">
        +
      </button>
    </div>
  )
}

export default function NewTeam() {
  const { me, loading } = useSession()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [idea, setIdea] = useState('')
  const [track, setTrack] = useState('Social Good')
  const [maxSize, setMaxSize] = useState(4)
  const [stack, setStack] = useState<string[]>([])
  const [neededRoles, setNeededRoles] = useState<Role[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Guard rails: wait for the session, then require a profile that isn't already on a team.
  if (loading) return <PageLoading />

  if (!me)
    return (
      <Page className="max-w-[760px]">
        <Empty title="Create a profile first">
          <p>Your profile tells us what you already bring, so we can suggest people for the rest.</p>
          <Link to="/onboard" className={cx(btn(), 'mt-6')}>
            Create profile
          </Link>
        </Empty>
      </Page>
    )

  const myTeam = teamIdOf(me)
  if (myTeam)
    return (
      <Page className="max-w-[760px]">
        <Empty title="You’re already on a team">
          <p>Each hacker can be on one team at a time.</p>
          <Link to={`/teams/${myTeam}`} className={cx(btn(), 'mt-6')}>
            Go to your team
          </Link>
        </Empty>
      </Page>
    )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!neededRoles.length) return setError('Pick at least one role you still need.')
    setError('')
    setSaving(true)
    try {
      const { data } = await api.post<Team>('/teams', { ownerId: me._id, name, idea, track, maxSize, stack, neededRoles })
      navigate(`/teams/${data._id}`)
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Page className="max-w-[1280px]">
      <form onSubmit={submit} className="mx-auto max-w-[760px]">
        <p className="text-sm text-gray-400">
          <Link to="/teams" className="hover:text-white">
            Teams
          </Link>{' '}
          / New
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Post your team</h1>
        <p className="mt-3 text-lg text-gray-300">The roles you mark as needed decide who we suggest.</p>

        <div className="mt-10">
          <Label htmlFor="name">Team name</Label>
          <input id="name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>

        <div className="mt-8">
          <Label htmlFor="idea">The idea, in one or two sentences</Label>
          <textarea id="idea" required rows={2} maxLength={400} value={idea} onChange={(e) => setIdea(e.target.value)} className={cx(inputClass, 'leading-relaxed')} />
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <Label htmlFor="track">Track</Label>
            <select id="track" value={track} onChange={(e) => setTrack(e.target.value)} className={cx(inputClass, 'h-[50px] py-0')}>
              {TRACKS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Team size</Label>
            <SizeStepper value={maxSize} onChange={setMaxSize} min={2} max={6} />
          </div>
        </div>

        <div className="mt-8">
          <Label htmlFor="stack">Stack you’re planning to use</Label>
          <TagInput id="stack" value={stack} onChange={setStack} placeholder="Add a language…" />
        </div>

        <fieldset className="mt-8">
          <legend className="mb-3 text-sm font-semibold">Roles you still need</legend>
          <RolePicker value={neededRoles} onChange={setNeededRoles} />
        </fieldset>

        <div className="mt-8">
          <ErrorNote>{error}</ErrorNote>
        </div>

        <div className="mt-4 flex flex-col-reverse gap-4 border-t border-gray-700 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-gray-400">You’re added as captain. 1 of {maxSize} spots filled.</span>
          <button type="submit" disabled={saving} className={btn('primary', 'lg')}>
            {saving ? 'Publishing…' : 'Publish team'}
          </button>
        </div>
      </form>
    </Page>
  )
}
