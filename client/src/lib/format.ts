// format.ts — constants and tiny formatting helpers used across pages.
// The ROLES / LEVELS / TRACKS lists must match server/src/models.js.
import type { Level, Role } from './api'

export const ROLES: Role[] = ['frontend', 'backend', 'design', 'ml', 'hardware', 'pm']
export const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced']
export const TRACKS = ['Social Good', 'Climate', 'Education', 'Accessibility', 'Health', 'Fintech', 'Open']

/** Long labels for toggles and filters. */
export const ROLE_LABEL: Record<Role, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  design: 'Design',
  ml: 'ML / AI',
  hardware: 'Hardware',
  pm: 'Product / PM',
}

/** Short labels for chips. */
export const ROLE_CHIP: Record<Role, string> = {
  frontend: 'frontend',
  backend: 'backend',
  design: 'design',
  ml: 'ML / AI',
  hardware: 'hardware',
  pm: 'PM',
}

/** "beginner" -> "Beginner" */
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "Arjun Mehta" -> "AM". Used for avatars. */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/** An ISO date -> "just now", "5 minutes ago", "3 hours ago", "2 days ago". */
export function timeAgo(iso?: string) {
  if (!iso) return ''
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/** Join with commas and "and": ["a","b","c"] -> "a, b, and c". */
export function listJoin(items: string[]) {
  if (items.length <= 2) return items.join(' and ')
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

/** Sorted [language, share] pairs, biggest first. */
export const sortedSkills = (skills: Record<string, number> = {}) =>
  Object.entries(skills).sort((a, b) => b[1] - a[1])
