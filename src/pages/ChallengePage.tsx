import type { ComponentChildren } from 'preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { Dialog } from '../components/Dialog'
import { IconBack, IconCalendar, IconFlag, IconGrid, IconList } from '../components/Icons'
import { useToast } from '../components/Toast'
import { summarize } from '../lib/challenge'
import { errorMessage, failChallenge, fetchChallengeBundle, syncMyChallenge, type ChallengeBundle } from '../lib/data'
import { href } from '../lib/router'
import { useToday } from '../lib/useToday'
import { CalendarTab } from './challenge/CalendarTab'
import { DashboardTab } from './challenge/DashboardTab'
import { TasksTab } from './challenge/TasksTab'

type Tab = 'dashboard' | 'tasks' | 'calendar'

type State =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; message: string }
  | { status: 'ready'; bundle: ChallengeBundle }

export function ChallengePage({ id, tab }: { id: string; tab: Tab }) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      await syncMyChallenge()
      const bundle = await fetchChallengeBundle(id)
      setState(bundle ? { status: 'ready', bundle } : { status: 'missing' })
    } catch (e) {
      setState((prev) => (prev.status === 'ready' ? prev : { status: 'error', message: errorMessage(e) }))
    }
  }, [id])

  useEffect(() => { void load() }, [load, attempt])

  const bundle = state.status === 'ready' ? state.bundle : null
  const active = bundle?.challenge.status === 'active'

  return (
    <>
      <header class="topbar">
        <div class="topbar-inner">
          <a class="icon-btn" href={href.home()} aria-label="Back to home"><IconBack /></a>
          <h1 class="topbar-title">{bundle?.challenge.name ?? ''}</h1>
          {active && (
            <button type="button" class="btn btn-danger btn-sm" onClick={() => setConfirmOpen(true)}>
              <IconFlag size={18} /> Fail
            </button>
          )}
        </div>
      </header>

      <main class={`page ${bundle ? 'with-tabs' : ''}`}>
        {state.status === 'loading' && (
          <>
            <div class="skeleton" style={{ height: '260px' }} />
            <div class="skeleton" style={{ height: '120px' }} />
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
        {state.status === 'missing' && (
          <div class="card card-empty">
            <p class="display title-md">Not found</p>
            <p class="muted">This challenge doesn't exist or isn't yours.</p>
            <a class="btn btn-secondary" href={href.home()}>Back to home</a>
          </div>
        )}
        {bundle && (
          <Body
            bundle={bundle}
            tab={tab}
            onChange={(next) => setState({ status: 'ready', bundle: next })}
            reload={load}
            onFail={() => setConfirmOpen(true)}
          />
        )}
      </main>

      {bundle && (
        <nav class="tabbar" aria-label="Challenge">
          <div class="tabbar-inner">
            <TabLink id={id} tab="dashboard" current={tab} label="Dashboard" icon={<IconGrid />} />
            <TabLink id={id} tab="tasks" current={tab} label="Tasks" icon={<IconList />} />
            <TabLink id={id} tab="calendar" current={tab} label="Calendar" icon={<IconCalendar />} />
          </div>
        </nav>
      )}

      {bundle && active && (
        <FailDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          bundle={bundle}
          onFailed={() => { setConfirmOpen(false); void load() }}
        />
      )}
    </>
  )
}

function Body({ bundle, tab, onChange, reload, onFail }: {
  bundle: ChallengeBundle
  tab: Tab
  onChange: (b: ChallengeBundle) => void
  reload: () => Promise<void>
  onFail: () => void
}) {
  const today = useToday(bundle.challenge.timezone)
  const summary = summarize(bundle.challenge, bundle.tasks, bundle.completions, today)

  // A new day may have settled the challenge on the server (missed day or finished).
  const lastDay = useRef(today)
  useEffect(() => {
    if (today === lastDay.current) return
    lastDay.current = today
    void reload()
  }, [today, reload])

  if (tab === 'tasks') return <TasksTab bundle={bundle} today={today} summary={summary} onChange={onChange} reload={reload} />
  if (tab === 'calendar') return <CalendarTab bundle={bundle} today={today} summary={summary} />
  return <DashboardTab bundle={bundle} today={today} summary={summary} onFail={onFail} />
}

function TabLink({ id, tab, current, label, icon }: { id: string; tab: Tab; current: Tab; label: string; icon: ComponentChildren }) {
  return (
    <a class="tab" href={href.challenge(id, tab)} aria-current={tab === current ? 'page' : undefined}>
      {icon}
      {label}
    </a>
  )
}

function FailDialog({ open, onClose, bundle, onFailed }: {
  open: boolean
  onClose: () => void
  bundle: ChallengeBundle
  onFailed: () => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const today = useToday(bundle.challenge.timezone)
  const s = summarize(bundle.challenge, bundle.tasks, bundle.completions, today)

  useEffect(() => { if (open) setError(null) }, [open])

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await failChallenge(bundle.challenge.id)
      toast('Challenge ended. Reset, then run it back.')
      onFailed()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} labelledBy="fail-title">
      <div class="row" style={{ color: 'var(--danger)' }}><IconFlag size={28} /></div>
      <h2 id="fail-title" class="display title-lg">Fail this challenge?</h2>
      <p class="muted">
        {s.phase === 'upcoming'
          ? "It hasn't started yet. Failing it ends it for good."
          : `You're on day ${s.dayNumber} with ${s.daysComplete} ${s.daysComplete === 1 ? 'day' : 'days'} done. This ends it for good. It can't be undone.`}
      </p>
      <p class="small muted">You can start a new challenge right after.</p>
      {error && <p class="error-text" role="alert">{error}</p>}
      <div class="stack" style={{ gap: '8px', marginTop: '4px' }}>
        <button type="button" class="btn btn-danger btn-block btn-lg" onClick={confirm} disabled={busy}>
          {busy ? 'Ending…' : 'Yes, fail challenge'}
        </button>
        <button type="button" class="btn btn-secondary btn-block" onClick={onClose} disabled={busy} autofocus>
          Keep going
        </button>
      </div>
    </Dialog>
  )
}
