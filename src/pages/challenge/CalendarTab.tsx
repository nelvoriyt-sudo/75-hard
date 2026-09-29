import { IconCheck, IconX } from '../../components/Icons'
import { completionsByDay, dayState, type DayState, type Summary } from '../../lib/challenge'
import type { ChallengeBundle } from '../../lib/data'
import { addDays, addMonths, daysInMonth, formatDate, longDate, monthStart, weekday, type IsoDate } from '../../lib/dates'

type Props = { bundle: ChallengeBundle; today: IsoDate; summary: Summary }

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const STATE_TEXT: Record<DayState, string> = {
  done: 'complete',
  partial: 'in progress',
  today: 'today, not started',
  missed: 'missed',
  upcoming: 'upcoming',
  empty: 'not part of the challenge',
}

export function CalendarTab({ bundle, today, summary: s }: Props) {
  const { challenge } = bundle
  const byDay = completionsByDay(bundle.completions)

  const months: IsoDate[] = []
  for (let m = monthStart(challenge.start_date); m <= challenge.end_date; m = addMonths(m, 1)) months.push(m)

  return (
    <>
      <section class="stats" aria-label="Summary">
        <div class="stat">
          <span class="stat-value volt">{s.daysComplete}</span>
          <span class="stat-label">Days complete</span>
        </div>
        <div class="stat">
          <span class="stat-value">{s.daysLeft}</span>
          <span class="stat-label">Days left</span>
        </div>
      </section>
      <p class="small muted">
        {longDate(challenge.start_date)} → {longDate(challenge.end_date)}
      </p>

      <div class="legend" aria-hidden="true">
        <span><i style={{ background: 'var(--volt)' }} /> Complete</span>
        <span><i style={{ boxShadow: 'inset 0 0 0 2px var(--volt)' }} /> Today</span>
        <span><i style={{ background: 'var(--surface)' }} /> Upcoming</span>
        {challenge.status === 'failed' && <span><i style={{ background: 'var(--danger)' }} /> Missed</span>}
      </div>

      {months.map((m) => {
        const lead = weekday(m)
        const count = daysInMonth(m)
        return (
          <section key={m} class="card" aria-labelledby={`m-${m}`}>
            <h2 id={`m-${m}`} class="display title-md">{formatDate(m, { month: 'long', year: 'numeric' })}</h2>
            <div class="cal" role="list" aria-labelledby={`m-${m}`}>
              {WEEKDAYS.map((d, i) => <span key={`h${i}`} class="cal-head" aria-hidden="true">{d}</span>)}
              {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} aria-hidden="true" />)}
              {Array.from({ length: count }, (_, i) => {
                const day = addDays(m, i)
                const state = dayState(challenge, day, today, byDay, s.taskCount)
                const inRange = state !== 'empty'
                const cls = ['cal-day', inRange ? 'in' : '', state === 'empty' || state === 'upcoming' ? '' : state].join(' ')
                return (
                  <span key={day} class={cls} role="listitem" aria-label={`${formatDate(day, { month: 'long', day: 'numeric' })}: ${STATE_TEXT[state]}`}>
                    {state === 'done' ? <IconCheck size={18} strokeWidth={3} /> : state === 'missed' ? <IconX size={18} strokeWidth={3} /> : i + 1}
                  </span>
                )
              })}
            </div>
          </section>
        )
      })}
    </>
  )
}
