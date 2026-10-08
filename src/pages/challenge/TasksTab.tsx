import { useEffect, useRef, useState } from 'preact/hooks'
import { IconCheck, IconLock } from '../../components/Icons'
import { Ring } from '../../components/Ring'
import { useToast } from '../../components/Toast'
import type { Summary } from '../../lib/challenge'
import { errorMessage, setTaskDone, type ChallengeBundle } from '../../lib/data'
import { longDate, shortDate, type IsoDate } from '../../lib/dates'
import { href } from '../../lib/router'

type Props = {
  bundle: ChallengeBundle
  today: IsoDate
  summary: Summary
  onChange: (b: ChallengeBundle) => void
  reload: () => Promise<void>
}

export function TasksTab({ bundle, today, summary: s, onChange, reload }: Props) {
  const toast = useToast()
  const { challenge, tasks } = bundle
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [celebrate, setCelebrate] = useState(0)

  const doneToday = new Set(bundle.completions.filter((c) => c.day === today).map((c) => c.task_id))
  const count = tasks.filter((t) => doneToday.has(t.id)).length
  const pct = tasks.length ? count / tasks.length : 0
  const allDone = tasks.length > 0 && count === tasks.length

  // Celebrate the moment the last box is ticked (not on load).
  const wasDone = useRef(allDone)
  useEffect(() => {
    if (allDone && !wasDone.current) setCelebrate((n) => n + 1)
    wasDone.current = allDone
  }, [allDone])

  // Keep the latest bundle for async updates so quick taps don't overwrite each other.
  const latest = useRef(bundle)
  latest.current = bundle

  async function toggle(taskId: string, done: boolean) {
    if (pending.has(taskId)) {
      setPending((p) => new Set(p)) // re-render so the box snaps back to its saved state
      return
    }
    setPending((p) => new Set(p).add(taskId))
    const apply = (on: boolean) => {
      const b = latest.current
      const others = b.completions.filter((c) => !(c.task_id === taskId && c.day === today))
      const next = { ...b, completions: on ? [...others, { task_id: taskId, day: today }] : others }
      latest.current = next
      onChange(next)
    }
    apply(done) // optimistic
    try {
      const status = await setTaskDone(taskId, done)
      if (status === 'completed') {
        toast('75 days. Done. You did it.')
        await reload()
      }
    } catch (e) {
      apply(!done) // roll back
      toast(errorMessage(e), 'error')
      void reload()
    } finally {
      setPending((p) => {
        const n = new Set(p)
        n.delete(taskId)
        return n
      })
    }
  }

  if (challenge.status !== 'active') {
    return (
      <div class="card card-empty">
        <IconLock size={28} />
        <p class="display title-md">Challenge over</p>
        <p class="muted">This challenge has ended, so there's nothing left to check off.</p>
        <a class="btn btn-secondary" href={href.challenge(challenge.id, 'calendar')}>See calendar</a>
      </div>
    )
  }

  if (s.phase === 'upcoming') {
    return (
      <>
        <div class="card card-empty">
          <IconLock size={28} />
          <p class="display title-md">Starts {shortDate(challenge.start_date)}</p>
          <p class="muted">Check-offs unlock on day 1. Here's what you'll do every day:</p>
        </div>
        <TaskPreview bundle={bundle} />
      </>
    )
  }

  return (
    <>
      <section class={`card ${allDone ? 'card-volt' : ''}`} style={{ alignItems: 'center', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div class="stack" style={{ gap: '2px' }}>
          <p class="label">Day {s.dayNumber} of 75</p>
          <h2 class="display title-md">{longDate(today)}</h2>
        </div>
        <div key={celebrate} class={celebrate ? 'pop' : ''} style={{ position: 'relative' }}>
          <Ring value={pct} size={220} stroke={18} label={`${count} of ${tasks.length} tasks done, ${Math.round(pct * 100)} percent`}>
            <div>
              <p class="display num" style={{ fontSize: '4.25rem', color: allDone ? 'var(--volt)' : undefined }}>
                {Math.round(pct * 100)}%
              </p>
              <p class="label">{allDone ? 'Day complete' : `${count} of ${tasks.length} done`}</p>
            </div>
          </Ring>
          {celebrate > 0 && <Burst />}
        </div>
        <div class="segments" style={{ width: '100%' }} aria-hidden="true">
          {tasks.map((t) => <span key={t.id} class={doneToday.has(t.id) ? 'on' : ''} />)}
        </div>
        <p class="small muted" role="status">
          {allDone ? 'Every task done. Rest up.' : 'Finish before bed. The day closes at 4 AM.'}
        </p>
      </section>

      <ul class="checklist" aria-label={`Tasks for ${shortDate(today)}`}>
        {tasks.map((t) => {
          const checked = doneToday.has(t.id)
          return (
            <li key={t.id} class="check-row">
              <input
                type="checkbox" id={`task-${t.id}`} checked={checked}
                aria-busy={pending.has(t.id)}
                onChange={(e) => void toggle(t.id, e.currentTarget.checked)}
              />
              <label for={`task-${t.id}`}>
                <span class="check-box" aria-hidden="true"><IconCheck size={20} strokeWidth={3} /></span>
                <span class="grow">
                  <span class="check-title" style={{ display: 'block' }}>{t.title}</span>
                  {t.detail && <span class="check-detail" style={{ display: 'block' }}>{t.detail}</span>}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function TaskPreview({ bundle }: { bundle: ChallengeBundle }) {
  return (
    <ol class="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: '8px' }}>
      {bundle.tasks.map((t, i) => (
        <li key={t.id} class="task-edit" style={{ gridTemplateColumns: 'auto minmax(0, 1fr)' }}>
          <span class="index" style={{ paddingTop: 0 }} aria-hidden="true">{i + 1}</span>
          <div>
            <p class="check-title">{t.title}</p>
            {t.detail && <p class="check-detail">{t.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

function Burst() {
  return (
    <div class="burst" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => (
        <i key={i} style={{ '--a': `${i * 22.5}deg`, '--d': `${120 + (i % 3) * 24}px`, background: i % 2 ? 'var(--volt)' : 'var(--ink)' }} />
      ))}
    </div>
  )
}
