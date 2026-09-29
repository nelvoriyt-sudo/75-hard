// Accent colour themes. The choice is saved to the profile and cached on the device so the app
// opens in the right colour before anything loads.
export const ACCENTS = [
  { id: 'volt', label: 'Volt', color: '#d4ff3a' },
  { id: 'blaze', label: 'Blaze', color: '#ff8a3d' },
  { id: 'ice', label: 'Ice', color: '#5ad1ff' },
  { id: 'violet', label: 'Violet', color: '#b69cff' },
  { id: 'gold', label: 'Gold', color: '#ffd23f' },
  { id: 'rose', label: 'Rose', color: '#ff7ab6' },
] as const

export type Accent = (typeof ACCENTS)[number]['id']

const KEY = 'accent'

export function isAccent(value: unknown): value is Accent {
  return ACCENTS.some((a) => a.id === value)
}

export function applyAccent(accent: Accent): void {
  if (accent === 'volt') document.documentElement.removeAttribute('data-accent')
  else document.documentElement.setAttribute('data-accent', accent)
  try {
    localStorage.setItem(KEY, accent)
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this visit.
  }
}

export function applyCachedAccent(): void {
  let cached: string | null = null
  try {
    cached = localStorage.getItem(KEY)
  } catch {
    cached = null
  }
  if (isAccent(cached)) applyAccent(cached)
}
