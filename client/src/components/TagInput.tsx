// TagInput.tsx — a chip-style input for lists like languages or a team's stack.
// Enter or comma adds the draft as a tag, Backspace on an empty draft removes the last one,
// and clicking × on a tag removes it. Duplicates (case-insensitive) are ignored.
import { useState } from 'react'
import { cx } from './ui'

/** Type a value and press Enter or comma to add it as a removable tag. */
export default function TagInput({
  id,
  value,
  onChange,
  placeholder,
  className,
}: {
  id?: string
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  className?: string
}) {
  const [draft, setDraft] = useState('')

  const add = (raw: string) => {
    const tag = raw.trim()
    if (tag && !value.some((v) => v.toLowerCase() === tag.toLowerCase())) onChange([...value, tag])
    setDraft('')
  }

  return (
    <div
      className={cx(
        'flex min-h-[58px] flex-wrap items-center gap-2 rounded-lg border border-gray-600 bg-gray-800 px-3 py-3 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/30',
        className
      )}
    >
      {value.map((tag) => (
        <span key={tag} className="inline-flex h-8 items-center gap-1 rounded-md bg-gray-700 pr-1 pl-3">
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((v) => v !== tag))}
            className="rounded px-1.5 text-gray-300 hover:bg-gray-600 hover:text-white"
            aria-label={`Remove ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add(draft)
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={() => draft && add(draft)}
        placeholder={placeholder}
        className="min-w-[140px] flex-1 bg-transparent px-1 text-base placeholder:text-gray-500 focus:outline-none"
      />
    </div>
  )
}
