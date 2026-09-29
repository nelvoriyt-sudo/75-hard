import type { ComponentChildren } from 'preact'

type Props = { value: number; size?: number; stroke?: number; label: string; children?: ComponentChildren }

/** Circular progress. value is 0–1. */
export function Ring({ value, size = 180, stroke = 14, label, children }: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.min(Math.max(value, 0), 1)
  return (
    <div class="ring" style={{ width: `${size}px`, height: `${size}px` }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle class="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" stroke-width={stroke} />
        <circle
          class="ring-fill" cx={size / 2} cy={size / 2} r={r} fill="none" stroke-width={stroke}
          stroke-linecap="round" stroke-dasharray={c} stroke-dashoffset={c * (1 - v)}
          style={{ opacity: v === 0 ? 0 : 1 }}
        />
      </svg>
      <div class="ring-center" aria-hidden="true">{children}</div>
    </div>
  )
}
