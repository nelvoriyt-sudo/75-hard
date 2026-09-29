// Modal built on the native <dialog>: focus stays inside, Escape closes, the page behind is inert.
import type { ComponentChildren } from 'preact'
import { useEffect, useRef } from 'preact/hooks'

type Props = { open: boolean; onClose: () => void; labelledBy: string; children: ComponentChildren }

export function Dialog({ open, onClose, labelledBy, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      class="sheet"
      aria-labelledby={labelledBy}
      onCancel={(e) => { e.preventDefault(); onClose() }}
      onClick={(e) => { if (e.target === ref.current) onClose() }}
    >
      {open && <div class="sheet-body">{children}</div>}
    </dialog>
  )
}
