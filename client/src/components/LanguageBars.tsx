// LanguageBars.tsx — two ways to draw a hacker's language shares ({ Python: 0.6, Go: 0.4 }).
//   LanguageBars  — one horizontal bar per language (onboarding preview)
//   LanguageStack — a single stacked bar plus legend (profile page)
// Both show the top three languages and fold the rest into "Other".
import { sortedSkills } from '../lib/format'

/** One bar per language (onboarding GitHub panel). Shows the top 3 and folds the rest into "Other". */
export function LanguageBars({ skills }: { skills: Record<string, number> }) {
  const rows = sortedSkills(skills)
  const top = rows.slice(0, 3)
  const other = rows.slice(3).reduce((s, [, v]) => s + v, 0)
  const all: [string, number, boolean][] = [...top.map(([k, v]) => [k, v, false] as [string, number, boolean])]
  if (other > 0.005) all.push(['Other', other, true])

  return (
    <ul className="space-y-4">
      {all.map(([lang, share, isOther]) => (
        <li key={lang}>
          <div className="mb-1.5 flex justify-between text-[15px]">
            <span>{lang}</span>
            <span className="text-gray-400">{Math.round(share * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-700">
            <div className={`h-2 rounded-full ${isOther ? 'bg-gray-500' : 'bg-indigo-500'}`} style={{ width: `${share * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

const SEGMENT_COLORS = ['bg-indigo-500', 'bg-violet-400', 'bg-purple-300', 'bg-gray-600']

/** One stacked bar plus a legend (hacker profile). */
export function LanguageStack({ skills }: { skills: Record<string, number> }) {
  const rows = sortedSkills(skills)
  const top = rows.slice(0, 3)
  const other = rows.slice(3).reduce((s, [, v]) => s + v, 0)
  const segments: [string, number][] = other > 0.005 ? [...top, ['Other', other]] : top

  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-gray-700">
        {segments.map(([lang, share], i) => (
          <div key={lang} className={SEGMENT_COLORS[i]} style={{ width: `${share * 100}%` }} title={lang} />
        ))}
      </div>
      <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-[15px]">
        {segments.map(([lang, share], i) => (
          <li key={lang} className="flex items-center gap-2">
            <span className={`size-2.5 rounded-full ${SEGMENT_COLORS[i]}`} />
            {lang} {Math.round(share * 100)}%
          </li>
        ))}
      </ul>
    </div>
  )
}
