// ============================================================================
// ui.tsx — small reusable building blocks used on every page.
//
// Styles are Tailwind class strings. Grouped by purpose:
//   Styling helpers  cx, btn, inputClass, cardClass
//   Roles            RoleChip, RoleChips, RolePicker, roleText
//   People           Avatar
//   Matching         MatchReasons
//   Feedback         Spinner, PageLoading, ErrorNote, Empty
//   Layout/forms     Label, Page
// ============================================================================
import type { ReactNode } from 'react'
import type { MatchReasons as Reasons, Role } from '../lib/api'
import { initials, ROLE_CHIP, ROLE_LABEL } from '../lib/format'

// ---- Styling helpers ------------------------------------------------------

/** Join class names, skipping falsy ones: cx('a', cond && 'b') -> "a b" or "a". */
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

type Variant = 'primary' | 'secondary' | 'light' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

/**
 * Shared button styles, usable on <button> and <Link> alike:
 *   <button className={btn()}>                 indigo, medium
 *   <Link className={btn('secondary', 'sm')}>  outlined, small
 */
export function btn(variant: Variant = 'primary', size: Size = 'md') {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:cursor-not-allowed disabled:opacity-50'
  const sizes: Record<Size, string> = {
    sm: 'h-9 px-5 text-sm',
    md: 'h-12 px-6 text-base',
    lg: 'h-14 px-7 text-lg',
  }
  const variants: Record<Variant, string> = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-500',
    secondary: 'border border-gray-600 text-white hover:border-gray-400 hover:bg-gray-700/40',
    light: 'bg-white text-gray-900 hover:bg-gray-200',
    ghost: 'text-indigo-300 hover:text-indigo-200',
  }
  return cx(base, sizes[size], variants[variant])
}

/** Standard text input / textarea / select look. */
export const inputClass =
  'w-full rounded-lg border border-gray-600 bg-gray-800 px-4 py-3 text-base text-white placeholder:text-gray-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none'

/** Standard card: rounded, bordered, slightly lighter than the page. */
export const cardClass = 'rounded-2xl border border-gray-700 bg-gray-800'

// ---- Roles ---------------------------------------------------------------

// Each role has its own hue so chips are scannable. `chip` is the resting look, `on` is selected.
const ROLE_STYLE: Record<Role, { chip: string; on: string }> = {
  frontend: { chip: 'bg-blue-950 border-blue-800 text-blue-300', on: 'bg-blue-950 border-blue-400 text-blue-200' },
  backend: { chip: 'bg-violet-950 border-violet-800 text-violet-300', on: 'bg-violet-950 border-violet-400 text-violet-200' },
  design: { chip: 'bg-purple-950 border-purple-800 text-purple-300', on: 'bg-purple-950 border-purple-400 text-purple-200' },
  ml: { chip: 'bg-fuchsia-950 border-fuchsia-800 text-fuchsia-300', on: 'bg-fuchsia-950 border-fuchsia-400 text-fuchsia-200' },
  hardware: { chip: 'bg-indigo-950 border-indigo-800 text-indigo-300', on: 'bg-indigo-950 border-indigo-400 text-indigo-200' },
  pm: { chip: 'bg-sky-950 border-sky-800 text-sky-300', on: 'bg-sky-950 border-sky-400 text-sky-200' },
}

/** Just the text color for a role named inline in a sentence ("Open spot: backend"). */
export const roleText = (r: Role) => ROLE_STYLE[r].chip.split(' ').find((c) => c.startsWith('text-'))

/** A single read-only role pill. */
export function RoleChip({ role }: { role: Role }) {
  return (
    <span className={cx('inline-flex h-[30px] items-center rounded-full border px-3 text-sm', ROLE_STYLE[role].chip)}>
      {ROLE_CHIP[role]}
    </span>
  )
}

/** A wrapping row of role pills. */
export function RoleChips({ roles }: { roles: Role[] }) {
  return (
    <span className="flex flex-wrap gap-2">
      {roles.map((r) => (
        <RoleChip key={r} role={r} />
      ))}
    </span>
  )
}

/** Multi-select role pills used on the profile and team forms. Click toggles a role in/out of `value`. */
export function RolePicker({ value, onChange }: { value: Role[]; onChange: (next: Role[]) => void }) {
  const toggle = (r: Role) => onChange(value.includes(r) ? value.filter((x) => x !== r) : [...value, r])
  return (
    <div className="flex flex-wrap gap-3">
      {(Object.keys(ROLE_LABEL) as Role[]).map((r) => {
        const on = value.includes(r)
        return (
          <button
            key={r}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(r)}
            className={cx(
              'h-11 rounded-full px-[17px] text-base transition-colors',
              on ? cx('border-2 font-semibold', ROLE_STYLE[r].on) : 'border border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-400'
            )}
          >
            {on && '✓ '}
            {ROLE_LABEL[r]}
          </button>
        )
      })}
    </div>
  )
}

// ---- People --------------------------------------------------------------

const AVATAR_STYLES = ['bg-indigo-900 text-indigo-200', 'bg-violet-900 text-violet-200', 'bg-purple-900 text-purple-200']

/**
 * Initials in a colored circle. There are no profile photos, so the color is picked by
 * hashing the name: the same person always gets the same color.
 */
export function Avatar({ name, size = 44, muted = false }: { name: string; size?: number; muted?: boolean }) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const style = muted ? 'bg-gray-700 text-gray-200' : AVATAR_STYLES[hash % AVATAR_STYLES.length]
  return (
    <span
      aria-hidden
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold', style)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.37) }}
    >
      {initials(name)}
    </span>
  )
}

// ---- Matching ------------------------------------------------------------

/**
 * Explains a match score in words, from the `reasons` the API returns alongside it:
 * "Covers backend, design · Shares Python, TypeScript · similar level"
 */
export function MatchReasons({ reasons, className = '' }: { reasons: Reasons; className?: string }) {
  const parts: [string | null, string][] = []
  if (reasons.covers.length) parts.push(['Covers', reasons.covers.map((r) => ROLE_CHIP[r]).join(', ')])
  if (reasons.shares.length) parts.push(['Shares', reasons.shares.join(', ')])
  if (reasons.similarLevel) parts.push([null, 'similar level'])

  return (
    <p className={`text-sm leading-6 ${className}`}>
      {parts.map(([label, value], i) => (
        <span key={i}>
          {i > 0 && <span className="mx-1 text-gray-600">·</span>}
          {label && <span className="text-gray-400">{label} </span>}
          <span className="text-white">{value}</span>
        </span>
      ))}
    </p>
  )
}

// ---- Feedback ------------------------------------------------------------

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-gray-400">
      <span className="size-4 animate-spin rounded-full border-2 border-gray-600 border-t-indigo-400" />
      {label}
    </span>
  )
}

/** Centered spinner for a page that hasn't loaded its data yet. */
export function PageLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner />
    </div>
  )
}

/** Red error box. Renders nothing when there is no message, so it can always be in the tree. */
export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-lg border border-rose-900 bg-rose-950/60 px-4 py-3 text-sm text-rose-200">
      {children}
    </p>
  )
}

/** Dashed "nothing here" box with a title and optional explanation or call to action. */
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-600 px-6 py-12 text-center">
      <p className="font-display text-xl font-semibold">{title}</p>
      {children && <div className="mt-2 text-gray-400">{children}</div>}
    </div>
  )
}

// ---- Layout / forms ------------------------------------------------------

/** Form field label with an optional grey hint after it. */
export function Label({ htmlFor, children, hint }: { htmlFor?: string; children: ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold">
      {children}
      {hint && <span className="ml-1 font-normal text-gray-400">{hint}</span>}
    </label>
  )
}

/** Shell for every page body: same side margins and max width as the Figma mockups. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cx('mx-auto w-full max-w-[1280px] px-5 pt-10 pb-16 sm:px-10 lg:px-16 lg:pt-12', className)}>{children}</main>
}
