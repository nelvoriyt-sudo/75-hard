import { IconChevron, IconFlag, IconPlus, IconTrophy } from '../../components/Icons'
import { Ring } from '../../components/Ring'
import { CHALLENGE_DAYS, completionsByDay, dayState, type Summary } from '../../lib/challenge'
import type { ChallengeBundle } from '../../lib/data'
import { addDays, longDate, shortDate, type IsoDate } from '../../lib/dates'
import { href } from '../../lib/router'

const LINES = [
  'Discipline is doing it when you don’t feel like it.',
  'No cheat days. No excuses. No exceptions.',
  'The work is the reward.',
  'Tough days build tough people.',
  'You don’t need motivation. You need a standard.',
  'Win the day. Then win the next one.',
  'It never gets easier. You get harder.',
]

type Props = { bundle: ChallengeBundle; today: IsoDate; summary: Summary; onFail: () => void }

export function DashboardTab({ bundle, today, summary: s, onFail }: Props) {
  const { challenge } = bundle
  const active = challenge.status === 'active'
  const byDay = completionsByDay(bundle.completions)
  const todayDone = s.taskCount > 0 && s.todayDone >= s.taskCount

  return (
    <>
      <section class="card hero-glow" aria-labelledby="hero-h" style={{ alignItems: 'center', textAlign: 'center', paddingTop: '24px' }}>
        <h2 id="hero-h" class="visually-hidden">Progress</h2>
        <Ring
          value={s.daysComplete / CHALLENGE_DAYS}
          size={208}
          stroke={16}
          label={`${s.daysComplete} of 75 days complete, ${s.percent} percent`}
        >
          {s.phase === 'upcoming' ? (
            <div>
              <p class="label">Starts in</p>
              <p class="display num" style={{ fontSize: '4rem' }}>{s.daysUntilStart}</p>
              <p class="label">{s.daysUntilStart === 1 ? 'day' : 'days'}</p>
            </div>
          ) : challenge.status === 'completed' ? (
            <div class="volt">
              <IconTrophy size={44} />
              <p class="display" style={{ fontSize: '2.75rem', marginTop: '6px' }}>75/75</p>
            </div>
          ) : (
            <div>
              <p class="label">Day</p>
              <p class="display num" style={{ fontSize: '4.5rem' }}>{s.dayNumber}</p>
              <p class="label">of 75</p>
            </div>
          )}
        </Ring>
        <Headline bundle={bundle} summary={s} />
      </section>

      <section aria-label="Stats" class="stats four">
        <Stat value={s.daysComplete} label="Days done" />
        <Stat value={s.daysLeft} label="Days left" />
        <Stat value={s.streak} label="Day streak" />
        <Stat value={s.phase === 'running' ? `${s.todayDone}/${s.taskCount}` : '—'} label="Today" />
      </section>

      {s.phase === 'running' && (
        <a class={`card ${todayDone ? 'card-volt' : ''}`} href={href.challenge(challenge.id, 'tasks')}>
          <div class="row spread">
            <div class="stack" style={{ gap: '2px' }}>
              <p class="label">Today · {shortDate(today)}</p>
              <p class="display title-md">
                {todayDone ? 'Day complete' : `${s.taskCount - s.todayDone} ${s.taskCount - s.todayDone === 1 ? 'task' : 'tasks'} left`}
              </p>
            </div>
            <IconChevron />
          </div>
          <div class="segments" aria-hidden="true">
            {Array.from({ length: s.taskCount }, (_, i) => <span key={i} class={i < s.todayDone ? 'on' : ''} />)}
          </div>
        </a>
      )}

      <section class="card" aria-labelledby="wall-h">
        <div class="row spread">
          <h2 id="wall-h" class="label">The 75</h2>
          <span class="small muted">{shortDate(challenge.start_date)} – {shortDate(challenge.end_date)}</span>
        </div>
        <div class="wall" role="img" aria-label={`${s.daysComplete} of 75 days complete`}>
          {Array.from({ length: CHALLENGE_DAYS }, (_, i) => {
            const day = addDays(challenge.start_date, i)
            return <span key={day} class={dayState(challenge, day, today, byDay, s.taskCount)} />
          })}
        </div>
      </section>

      {active && s.phase !== 'upcoming' && (
        <p class="display" style={{ fontSize: '1.25rem', lineHeight: 1.15, color: 'var(--muted)', padding: '4px 2px' }}>
          “{LINES[(s.dayNumber - 1) % LINES.length]}”
        </p>
      )}

      {active ? (
        <button type="button" class="btn btn-danger-outline btn-block btn-lg" onClick={onFail}>
          <IconFlag size={20} /> Fail / abort challenge
        </button>
      ) : (
        <a class="btn btn-primary btn-block btn-lg" href={href.new()}>
          <IconPlus /> Start a new challenge
        </a>
      )}
    </>
  )
}

function Headline({ bundle, summary: s }: { bundle: ChallengeBundle; summary: Summary }) {
  const c = bundle.challenge
  if (c.status === 'completed') {
    return (
      <div class="stack" style={{ gap: '4px' }}>
        <p class="display title-lg">You did it.</p>
        <p class="muted">75 days, no compromises. Finished {longDate(c.end_date)}.</p>
      </div>
    )
  }
  if (c.status === 'failed') {
    return (
      <div class="stack" style={{ gap: '6px', alignItems: 'center' }}>
        <span class="badge badge-danger">Failed</span>
        <p class="muted">
          {c.end_reason === 'missed_day' && c.missed_day
            ? `${shortDate(c.missed_day)} wasn't fully checked off. 75 Hard rules: start over.`
            : `Ended early after ${s.daysComplete} ${s.daysComplete === 1 ? 'day' : 'days'}.`}
        </p>
      </div>
    )
  }
  if (s.phase === 'upcoming') {
    return <p class="muted">Day 1 is {longDate(c.start_date)}. Get ready.</p>
  }
  return (
    <p class="muted">
      <strong class="volt num">{s.percent}%</strong> complete · finish line {longDate(c.end_date)}
    </p>
  )
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div class="stat">
      <span class="stat-value">{value}</span>
      <span class="stat-label">{label}</span>
    </div>
  )
}
