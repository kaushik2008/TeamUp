// pages/Onboard.tsx — "/onboard": create a profile.
// Left column: name, email, roles, level, bio. Right column: optional GitHub sync, which
// previews your languages live via GET /api/github/:username before anything is saved.
// Submitting POSTs to /api/users, signs you in, and sends you to the teams page.
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, errorMessage, type GitHubPreview, type Level, type Role, type User } from '../lib/api'
import { capitalize, LEVELS } from '../lib/format'
import { useSession } from '../lib/session'
import { LanguageBars } from '../components/LanguageBars'
import TagInput from '../components/TagInput'
import { btn, cardClass, cx, ErrorNote, inputClass, Label, RolePicker, Spinner } from '../components/ui'

/** Beginner / Intermediate / Advanced as a segmented control. */
function LevelPicker({ value, onChange }: { value: Level; onChange: (l: Level) => void }) {
  return (
    <div role="radiogroup" aria-label="Experience level" className="inline-flex rounded-lg border border-gray-600 bg-gray-800 p-1">
      {LEVELS.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={value === l}
          onClick={() => onChange(l)}
          className={cx(
            'h-10 rounded-md px-4 text-base sm:px-5',
            value === l ? 'bg-white font-semibold text-gray-900' : 'text-gray-300 hover:text-white'
          )}
        >
          {capitalize(l)}
        </button>
      ))}
    </div>
  )
}

// The GitHub panel is a small state machine: idle -> loading -> done | error.
type SyncState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; data: GitHubPreview }
  | { status: 'error'; message: string }

/** The optional GitHub box. Also hosts the manual language input, shown when there is no sync data. */
function GitHubPanel({
  username,
  setUsername,
  sync,
  setSync,
  languages,
  setLanguages,
}: {
  username: string
  setUsername: (v: string) => void
  sync: SyncState
  setSync: (s: SyncState) => void
  languages: string[]
  setLanguages: (v: string[]) => void
}) {
  // Preview only: nothing is saved until the whole form is submitted.
  const runSync = async () => {
    const handle = username.trim().replace(/^@/, '')
    if (!handle) return
    setSync({ status: 'loading' })
    try {
      const { data } = await api.get<GitHubPreview>(`/github/${encodeURIComponent(handle)}`)
      setSync({ status: 'done', data })
    } catch (err) {
      setSync({ status: 'error', message: errorMessage(err, 'Could not reach GitHub.') })
    }
  }

  return (
    <aside className={cx(cardClass, 'p-6 sm:p-7')}>
      <h2 className="font-display text-xl font-semibold">
        GitHub <span className="text-base font-normal text-gray-400 italic">(optional)</span>
      </h2>
      <div className="mt-4 flex gap-2">
        <label htmlFor="gh" className="sr-only">
          GitHub username
        </label>
        <input
          id="gh"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
            if (sync.status !== 'idle') setSync({ status: 'idle' })
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), runSync())}
          placeholder="your-handle"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={cx(inputClass, 'bg-transparent')}
        />
        <button type="button" onClick={runSync} disabled={!username.trim() || sync.status === 'loading'} className={cx(btn('light'), 'h-[50px] rounded-lg px-4')}>
          Sync
        </button>
      </div>

      <div className="mt-3 min-h-5 text-sm" aria-live="polite">
        {sync.status === 'loading' && <Spinner label="Reading public repos…" />}
        {sync.status === 'error' && <span className="text-rose-300">{sync.message}</span>}
        {sync.status === 'done' && (
          <span className="text-indigo-300">✓ Verified · {sync.data.repoCount} public repos, forks skipped</span>
        )}
      </div>

      {sync.status === 'done' && Object.keys(sync.data.skills).length > 0 ? (
        <>
          <p className="eyebrow mt-6 mb-4">Detected languages</p>
          <LanguageBars skills={sync.data.skills} />
        </>
      ) : sync.status === 'done' ? (
        <p className="mt-6 text-sm text-gray-400">No languages found in public repos yet. Add them yourself below.</p>
      ) : null}

      {sync.status !== 'done' || !Object.keys(sync.data.skills).length ? (
        <div className="mt-6">
          <Label htmlFor="langs" hint="no GitHub? add them yourself">
            Languages you know
          </Label>
          <TagInput id="langs" value={languages} onChange={setLanguages} placeholder="Python, JavaScript…" />
        </div>
      ) : null}

      <p className="mt-6 border-t border-gray-700 pt-5 text-sm leading-relaxed text-gray-400 italic">
        Wrong? Edit these on your profile. We only read public repos.
      </p>
    </aside>
  )
}

export default function Onboard() {
  const navigate = useNavigate()
  const { me, signIn } = useSession()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [roles, setRoles] = useState<Role[]>([])
  const [level, setLevel] = useState<Level>('beginner')
  const [bio, setBio] = useState('')
  const [github, setGithub] = useState('')
  const [sync, setSync] = useState<SyncState>({ status: 'idle' })
  const [languages, setLanguages] = useState<string[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // One POST creates the profile. The server syncs GitHub itself if a username was given.
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!roles.length) return setError('Pick at least one thing you can do.')
    setError('')
    setSaving(true)
    try {
      const { data } = await api.post<{ user: User; githubWarning: string | null }>('/users', {
        name,
        email,
        roles,
        level,
        bio,
        githubUsername: github.trim() || undefined,
        languages,
      })
      // Remember this profile in the browser, then go to the ranked teams list.
      signIn(data.user._id)
      navigate('/teams', { state: data.githubWarning ? { notice: `Profile created. GitHub sync didn’t work: ${data.githubWarning}` } : undefined })
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <>
      <header className="border-b border-gray-700">
        <div className="mx-auto flex h-[81px] max-w-[1280px] items-center justify-between px-5 sm:px-10 lg:px-16">
          <Link to="/" className="font-display text-2xl font-semibold tracking-tight">
            TeamUp
          </Link>
          <span className="text-sm text-gray-400">
            Step 1 of 1<span className="hidden sm:inline"> · takes about two minutes</span>
          </span>
        </div>
      </header>

      <form onSubmit={submit} className="mx-auto grid max-w-[1280px] gap-10 px-5 pt-10 pb-16 sm:px-10 lg:grid-cols-[1fr_400px] lg:gap-14 lg:px-16 lg:pt-14">
        <div className="max-w-[696px]">
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Create your profile</h1>
          <p className="mt-3 text-lg text-gray-300">Your roles matter most. GitHub just adds detail.</p>
          {me && (
            <p className="mt-4 text-sm text-gray-400">
              You already have a profile as {me.name}.{' '}
              <Link to={`/hackers/${me._id}`} className="text-indigo-300 underline-offset-2 hover:underline">
                View it
              </Link>
            </p>
          )}

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Full name</Label>
              <input id="name" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={inputClass} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={inputClass} />
            </div>
          </div>

          <fieldset className="mt-8">
            <legend className="mb-3 text-sm font-semibold">
              What can you do? <span className="font-normal text-gray-400">Pick all that apply</span>
            </legend>
            <RolePicker value={roles} onChange={setRoles} />
          </fieldset>

          <div className="mt-8">
            <p className="mb-3 text-sm font-semibold">Experience level</p>
            <LevelPicker value={level} onChange={setLevel} />
          </div>

          <div className="mt-8">
            <Label htmlFor="bio">Short bio</Label>
            <textarea
              id="bio"
              rows={3}
              maxLength={500}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="What have you built? What do you want to learn this weekend?"
              className={cx(inputClass, 'leading-relaxed')}
            />
          </div>

          <div className="mt-8">
            <ErrorNote>{error}</ErrorNote>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-5">
            <button type="submit" disabled={saving} className={btn('primary', 'lg')}>
              {saving ? 'Creating…' : 'Create profile'}
            </button>
            <span className="text-gray-400">You can edit everything later.</span>
          </div>
        </div>

        <div className="lg:pt-1">
          <GitHubPanel username={github} setUsername={setGithub} sync={sync} setSync={setSync} languages={languages} setLanguages={setLanguages} />
        </div>
      </form>
    </>
  )
}
