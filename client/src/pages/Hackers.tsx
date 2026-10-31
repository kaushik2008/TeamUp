// pages/Hackers.tsx — "/hackers": browse people looking for a team.
// Name search is debounced; role, language and level filters are sent to GET /api/users.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage, type Level, type Role, type User } from '../lib/api'
import { capitalize, LEVELS, ROLE_LABEL, ROLES, sortedSkills } from '../lib/format'
import { Avatar, cx, Empty, ErrorNote, Page, PageLoading, RoleChips } from '../components/ui'

// The language dropdown is a fixed list; the API matches it case-insensitively against each hacker's skills.
const LANGUAGES = ['Python', 'JavaScript', 'TypeScript', 'C++', 'Go', 'Rust', 'Java', 'C', 'SQL', 'Swift', 'Kotlin', 'R']

// "Python · TypeScript · Go" for the languages column.
const topLanguages = (u: User) =>
  sortedSkills(u.skills)
    .slice(0, 3)
    .map(([l]) => l)
    .join(' · ') || '—'

/** A filter dropdown that turns white when it's set, like the mockup's "Language: Python ×". */
function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  format = (v) => v,
}: {
  label: string
  value: T | ''
  onChange: (v: T | '') => void
  options: readonly T[]
  format?: (v: T) => string
}) {
  const active = value !== ''
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T | '')}
        className={cx(
          'h-[50px] cursor-pointer appearance-none rounded-lg border pr-9 pl-4 text-base',
          active ? 'border-indigo-400 bg-white text-gray-900' : 'border-gray-600 bg-gray-800 text-white'
        )}
      >
        <option value="">{label}: Any</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {label}: {format(o)}
          </option>
        ))}
      </select>
      {active ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={`Clear ${label.toLowerCase()} filter`}
          className="absolute inset-y-0 right-2 my-auto h-7 rounded px-1.5 text-gray-700 hover:bg-gray-200"
        >
          ×
        </button>
      ) : (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
          ▾
        </span>
      )}
    </div>
  )
}

export default function Hackers() {
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<Role | ''>('')
  const [lang, setLang] = useState('')
  const [level, setLevel] = useState<Level | ''>('')
  const [hackers, setHackers] = useState<User[] | null>(null)
  const [error, setError] = useState('')

  // Debounce typing so we don't hit the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 250)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    // Fetch whenever a filter changes. The flag ignores stale responses if filters change quickly.
    let cancelled = false
    setError('')
    api
      .get<User[]>('/users', { params: { q: query || undefined, role: role || undefined, lang: lang || undefined, level: level || undefined } })
      .then(({ data }) => !cancelled && setHackers(data))
      .catch((err) => !cancelled && setError(errorMessage(err)))
    return () => {
      cancelled = true
    }
  }, [query, role, lang, level])

  const verified = hackers?.filter((h) => h.githubVerified).length ?? 0

  return (
    <Page>
      <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Hackers looking for a team</h1>
      <p className="mt-2 text-gray-300">
        {hackers ? `${hackers.length} ${hackers.length === 1 ? 'person' : 'people'} · ${verified} GitHub verified` : ' '}
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <label className="w-full sm:w-[380px]">
          <span className="sr-only">Search by name</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name…"
            className="h-[50px] w-full rounded-lg border border-gray-600 bg-gray-800 px-4 text-base placeholder:text-gray-500 focus:border-indigo-400 focus:outline-none"
          />
        </label>
        <FilterSelect label="Role" value={role} onChange={setRole} options={ROLES} format={(r) => ROLE_LABEL[r]} />
        <FilterSelect label="Language" value={lang} onChange={setLang} options={LANGUAGES} />
        <FilterSelect label="Level" value={level} onChange={setLevel} options={LEVELS} format={capitalize} />
      </div>

      <div className="mt-8">
        <ErrorNote>{error}</ErrorNote>
      </div>

      {!hackers && !error ? (
        <PageLoading />
      ) : hackers && hackers.length === 0 ? (
        <Empty title="Nobody matches those filters">Try a different role or language.</Empty>
      ) : (
        hackers && (
          <div className="overflow-hidden rounded-2xl border border-gray-700 bg-gray-800">
            <div className="hidden grid-cols-[284px_142px_284px_1fr_auto] border-b border-gray-700 px-7 py-3 lg:grid">
              {['Hacker', 'Level', 'Roles', 'Top languages'].map((h) => (
                <span key={h} className="eyebrow">
                  {h}
                </span>
              ))}
            </div>
            <ul>
              {hackers.map((h) => (
                <li key={h._id} className="relative border-b border-gray-700 last:border-b-0 hover:bg-gray-700/30">
                  <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 px-5 py-5 sm:px-7 lg:grid-cols-[284px_142px_284px_1fr_auto]">
                    <div className="flex items-center gap-4">
                      <Avatar name={h.name} />
                      <div>
                        <Link to={`/hackers/${h._id}`} className="font-display text-lg font-semibold after:absolute after:inset-0">
                          {h.name}
                        </Link>
                        <p className={cx('text-sm', h.githubVerified ? 'text-indigo-300' : 'text-gray-400 italic')}>
                          {h.githubVerified ? '✓ GitHub verified' : 'Self-reported'}
                        </p>
                      </div>
                    </div>
                    <span className="hidden lg:block">{capitalize(h.level)}</span>
                    <div className="col-span-2 flex flex-wrap items-center gap-2 lg:col-span-1">
                      <span className="mr-1 text-sm text-gray-400 lg:hidden">{capitalize(h.level)} ·</span>
                      <RoleChips roles={h.roles} />
                    </div>
                    <span className="col-span-2 text-gray-300 lg:col-span-1">{topLanguages(h)}</span>
                    <span className="row-start-1 col-start-2 font-semibold text-indigo-300 lg:row-auto lg:col-auto">View →</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
      )}
    </Page>
  )
}
