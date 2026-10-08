import { useEffect, useState } from 'preact/hooks'
import { IconChevron, IconFlame, IconGear, IconPlus, IconTrophy } from '../components/Icons'
import { summarize, type Challenge } from '../lib/challenge'
import { errorMessage, fetchChallengeBundle, fetchProfile, listChallenges, syncMyChallenge, type ChallengeBundle, type Profile } from '../lib/data'
import { challengeDay, longDate, shortDate } from '../lib/dates'
import { href } from '../lib/router'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; profile: Profile | null; active: ChallengeBundle | null; history: Challenge[] }

export function HomePage() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await syncMyChallenge()
        const [profile, challenges] = await Promise.all([fetchProfile(), listChallenges()])
        const activeRow = challenges.find((c) => c.status === 'active')
        const active = activeRow ? await fetchChallengeBundle(activeRow.id) : null
        if (!cancelled) {
          setState({ status: 'ready', profile, active, history: challenges.filter((c) => c.status !== 'active') })
        }
      } catch (e) {
        if (!cancelled) setState({ status: 'error', message: errorMessage(e) })
      }
    })()
    return () => { cancelled = true }
  }, [attempt])

  const name = state.status === 'ready' ? state.profile?.display_name : undefined

  return (
    <main class="page" style={{ paddingTop: 'calc(16px + env(safe-area-inset-top))' }}>
      <header class="row spread hero-glow">
        <div class="stack" style={{ gap: '4px' }}>
          <p class="label">{name ? `Let's work, ${name}` : "Let's work"}</p>
          <h1 class="display title-xl">Home</h1>
        </div>
        <a class="icon-btn" href={href.settings()} aria-label="Settings"><IconGear /></a>
      </header>

      {state.status === 'loading' && (
        <>
          <div class="skeleton" style={{ height: '220px' }} />
          <div class="skeleton" style={{ height: '72px' }} />
        </>
      )}

      {state.status === 'error' && (
        <div class="card card-empty" role="alert">
          <p class="display title-md">Couldn't load</p>
          <p class="muted">{state.message}</p>
          <button class="btn btn-secondary" onClick={() => { setState({ status: 'loading' }); setAttempt((a) => a + 1) }}>
            Try again
          </button>
        </div>
      )}

      {state.status === 'ready' && (
        <>
          <section aria-labelledby="current-h" class="stack">
            <h2 id="current-h" class="label">Current challenge</h2>
            {state.active ? <ActiveCard bundle={state.active} /> : <StartCard hasHistory={state.history.length > 0} />}
          </section>

          {state.history.length > 0 && (
            <section aria-labelledby="history-h" class="stack">
              <h2 id="history-h" class="label">History</h2>
              <ul class="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: '8px' }}>
                {state.history.map((c) => <HistoryRow key={c.id} challenge={c} />)}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  )
}

function ActiveCard({ bundle }: { bundle: ChallengeBundle }) {
  const { challenge, tasks, completions } = bundle
  const today = challengeDay(challenge.timezone)
  const s = summarize(challenge, tasks, completions, today)
  const todayPct = s.taskCount ? s.todayDone / s.taskCount : 0

  return (
    <a class="card card-volt" href={href.challenge(challenge.id)} aria-label={`Open ${challenge.name}`}>
      <div class="row spread">
        <span class="badge badge-volt">{s.phase === 'upcoming' ? 'Starts soon' : 'Active'}</span>
        <IconChevron />
      </div>
      <div class="stack" style={{ gap: '6px' }}>
        <p class="display title-lg" style={{ overflowWrap: 'anywhere' }}>{challenge.name}</p>
        {s.phase === 'upcoming' ? (
          <p class="muted">
            Starts {shortDate(challenge.start_date)} · in {s.daysUntilStart} {s.daysUntilStart === 1 ? 'day' : 'days'}
          </p>
        ) : (
          <p class="muted">
            <span class="volt" style={{ fontWeight: 700 }}>Day {s.dayNumber}</span> of 75 · ends {shortDate(challenge.end_date)}
          </p>
        )}
      </div>
      <div class="stack" style={{ gap: '8px' }}>
        <div class="row spread small">
          <span class="muted">{s.daysComplete} of 75 days complete</span>
          <span class="num" style={{ fontWeight: 700 }}>{s.percent}%</span>
        </div>
        <div class="bar" aria-hidden="true"><span style={{ width: `${s.percent}%` }} /></div>
      </div>
      {s.phase === 'running' && (
        <div class="row spread" style={{ paddingTop: '4px' }}>
          <span class="row small" style={{ gap: '6px' }}>
            <IconFlame size={18} /> <strong>{s.streak}</strong> day streak
          </span>
          <span class="small">
            Today <strong class="num">{s.todayDone}/{s.taskCount}</strong>
            {todayPct === 1 && <span class="volt"> ✓</span>}
          </span>
        </div>
      )}
    </a>
  )
}

function StartCard({ hasHistory }: { hasHistory: boolean }) {
  return (
    <div class="card card-empty">
      <p class="display title-lg">{hasHistory ? 'Run it back' : 'Day 1 starts here'}</p>
      <p class="muted">
        75 days. Every task, every day. Miss one and you start over.
      </p>
      <a class="btn btn-primary btn-lg" href={href.new()}>
        <IconPlus /> Start a challenge
      </a>
    </div>
  )
}

function HistoryRow({ challenge }: { challenge: Challenge }) {
  const completed = challenge.status === 'completed'
  const why =
    challenge.end_reason === 'missed_day' && challenge.missed_day
      ? `Missed ${shortDate(challenge.missed_day)}`
      : challenge.end_reason === 'gave_up'
        ? 'Ended early'
        : `Finished ${longDate(challenge.end_date)}`
  return (
    <li>
      <a class="card" href={href.challenge(challenge.id)} style={{ padding: '14px 16px' }}>
        <div class="row">
          <span style={{ color: completed ? 'var(--volt)' : 'var(--danger)' }}>
            {completed ? <IconTrophy /> : <IconFlame />}
          </span>
          <div class="grow">
            <p style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{challenge.name}</p>
            <p class="small muted">Started {longDate(challenge.start_date)} · {why}</p>
          </div>
          <span class={`badge ${completed ? 'badge-volt' : 'badge-danger'}`}>{completed ? 'Done' : 'Failed'}</span>
        </div>
      </a>
    </li>
  )
}
