// Inline stroke icons (24×24 grid). Decorative unless a label is given.
import type { ComponentChildren } from 'preact'

type Props = { size?: number; label?: string; strokeWidth?: number }

function Svg({ size = 22, label, strokeWidth = 2, children }: Props & { children: ComponentChildren }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round"
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}
    >
      {children}
    </svg>
  )
}

export const IconBack = (p: Props) => <Svg {...p}><path d="m15 18-6-6 6-6" /></Svg>
export const IconCheck = (p: Props) => <Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>
export const IconPlus = (p: Props) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
export const IconX = (p: Props) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>
export const IconFlag = (p: Props) => <Svg {...p}><path d="M4 22V4" /><path d="M4 4h13l-2 4 2 4H4" /></Svg>
export const IconGear = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
)
export const IconGrid = (p: Props) => (
  <Svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Svg>
)
export const IconList = (p: Props) => (
  <Svg {...p}><rect x="3" y="4" width="5" height="5" rx="1.2" /><path d="m4.5 6.5 1 1 1.5-2" /><path d="M11 6.5h10M11 17.5h10" /><rect x="3" y="15" width="5" height="5" rx="1.2" /></Svg>
)
export const IconCalendar = (p: Props) => (
  <Svg {...p}><rect x="3" y="4" width="18" height="18" rx="2.5" /><path d="M16 2v4M8 2v4M3 10h18" /></Svg>
)
export const IconFlame = (p: Props) => (
  <Svg {...p}><path d="M12 22c4.4 0 7-2.9 7-6.8 0-3.9-2.6-6.4-4.4-8.9-.5 2.3-1.7 3.5-3.1 4.2.4-3.4-1-6.8-3.6-8.5.2 3.6-1.8 5.9-3.2 8.2A8 8 0 0 0 5 15.2C5 19.1 7.6 22 12 22z" /></Svg>
)
export const IconTrophy = (p: Props) => (
  <Svg {...p}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></Svg>
)
export const IconBell = (p: Props) => (
  <Svg {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></Svg>
)
export const IconLock = (p: Props) => (
  <Svg {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Svg>
)
export const IconChevron = (p: Props) => <Svg {...p}><path d="m9 18 6-6-6-6" /></Svg>
export const IconShare = (p: Props) => (
  <Svg {...p}><path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></Svg>
)
