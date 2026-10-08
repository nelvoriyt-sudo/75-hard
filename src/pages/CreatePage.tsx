import { useEffect, useState } from 'preact/hooks'
import { IconBack, IconLock, IconPlus, IconX } from '../components/Icons'
import { useToast } from '../components/Toast'
import { AppError, createChallenge, errorMessage, listChallenges } from '../lib/data'
import { addDays, challengeDay, deviceTimeZone, longDate, shortDate } from '../lib/dates'
import { LIMITS, newKey, presetDrafts, type TaskDraft } from '../lib/presets'
import { href, navigate } from '../lib/router'

type StartChoice = 'today' | 'tomorrow' | 'pick'

export function CreatePage() {
  const toast = useToast()
  const timezone = deviceTimeZone()
  const today = challengeDay(timezone)

  const [name, setName] = useState('75 Hard')
  const [tasks, setTasks] = useState<TaskDraft[]>(presetDrafts)
  const [startChoice, setStartChoice] = useState<StartChoice>('today')
  const [pickedDate, setPickedDate] = useState(addDays(today, 2))
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<string | null>(null)

  // One active challenge at a time: send people with one straight to it.
  useEffect(() => {
    listChallenges()
      .then((list) => {
        const active = list.find((c) => c.status === 'active')
        if (active) setBlocked(active.id)
      })
      .catch(() => undefined)
  }, [])

  const maxDate = addDays(today, 30)
  const startDate = startChoice === 'today' ? today : startChoice === 'tomorrow' ? addDays(today, 1) : pickedDate
  const startValid = startDate >= today && startDate <= maxDate
  const endDate = startValid ? addDays(startDate, 74) : null

  const nameError = name.trim().length === 0 ? 'Give your challenge a name.' : null
  const taskErrors = tasks.map((t) => (t.title.trim().length === 0 ? 'Name this task or remove it.' : null))
  const hasErrors = !!nameError || taskErrors.some(Boolean) || tasks.length === 0 || !startValid

  const update = (key: string, patch: Partial<TaskDraft>) =>
    setTasks((list) => list.map((t) => (t.key === key ? { ...t, ...patch } : t)))
  const remove = (key: string) => setTasks((list) => list.filter((t) => t.key !== key))
  const add = () => {
    const key = newKey()
    setTasks((list) => [...list, { key, title: '', detail: '' }])
    requestAnimationFrame(() => document.getElementById(`title-${key}`)?.focus())
  }

  async function submit(e: Event) {
    e.preventDefault()
    setAttempted(true)
    setError(null)
    if (hasErrors) return
    setBusy(true)
    try {
      const id = await createChallenge({
        name: name.trim(),
        startDate,
        timezone,
        tasks: tasks.map((t) => ({ title: t.title.trim(), detail: t.detail.trim() })),
      })
      toast('Challenge locked in. Let’s go.')
      navigate(href.challenge(id), true)
    } catch (err) {
      setError(errorMessage(err))
      if (err instanceof AppError && err.code === 'active_challenge_exists') {
        listChallenges().then((l) => setBlocked(l.find((c) => c.status === 'active')?.id ?? null)).catch(() => undefined)
      }
      setBusy(false)
    }
  }

  return (
    <>
      <header class="topbar">
        <div class="topbar-inner">
          <a class="icon-btn" href={href.home()} aria-label="Back to home"><IconBack /></a>
          <h1 class="topbar-title">New challenge</h1>
        </div>
      </header>

      <main class="page">
        {blocked ? (
          <div class="card card-empty">
            <p class="display title-md">You're already in one</p>
            <p class="muted">Only one challenge can be active at a time. Finish it, or fail it, to start another.</p>
            <a class="btn btn-primary" href={href.challenge(blocked)}>Go to my challenge</a>
          </div>
        ) : (
          <form class="stack" style={{ gap: '20px' }} onSubmit={submit} noValidate>
            <section class="card">
              <div class="field">
                <label for="ch-name">Challenge name</label>
                <input
                  id="ch-name" class="input" value={name} maxLength={LIMITS.name}
                  onInput={(e) => setName(e.currentTarget.value)}
                  aria-invalid={attempted && !!nameError} aria-describedby="ch-name-hint"
                />
                <p id="ch-name-hint" class={attempted && nameError ? 'error-text' : 'hint'}>
                  {attempted && nameError ? nameError : `${name.length}/${LIMITS.name}`}
                </p>
              </div>
            </section>

            <section class="stack" aria-labelledby="tasks-h">
              <div class="row spread">
                <h2 id="tasks-h" class="label">Daily tasks · {tasks.length}</h2>
                <button type="button" class="link-btn small" onClick={() => setTasks(presetDrafts())}>
                  Reset to 75 Hard
                </button>
              </div>
              <ol class="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: '8px' }}>
                {tasks.map((t, i) => (
                  <li key={t.key} class="task-edit">
                    <span class="index" aria-hidden="true">{i + 1}</span>
                    <div class="inputs">
                      <label class="visually-hidden" for={`title-${t.key}`}>Task {i + 1} name</label>
                      <input
                        id={`title-${t.key}`} class="input" placeholder="Task name" value={t.title} maxLength={LIMITS.title}
                        onInput={(e) => update(t.key, { title: e.currentTarget.value })}
                        aria-invalid={attempted && !!taskErrors[i]}
                        aria-describedby={attempted && taskErrors[i] ? `err-${t.key}` : undefined}
                      />
                      <label class="visually-hidden" for={`detail-${t.key}`}>Task {i + 1} details (optional)</label>
                      <input
                        id={`detail-${t.key}`} class="input detail" placeholder="Details (optional)" value={t.detail}
                        maxLength={LIMITS.detail} onInput={(e) => update(t.key, { detail: e.currentTarget.value })}
                      />
                      {attempted && taskErrors[i] && <p id={`err-${t.key}`} class="error-text">{taskErrors[i]}</p>}
                    </div>
                    <button
                      type="button" class="icon-btn" onClick={() => remove(t.key)}
                      aria-label={`Remove ${t.title.trim() || `task ${i + 1}`}`}
                    >
                      <IconX size={20} />
                    </button>
                  </li>
                ))}
              </ol>
              {tasks.length === 0 && <p class="error-text">Add at least one task.</p>}
              <button
                type="button" class="btn btn-secondary btn-block" onClick={add}
                disabled={tasks.length >= LIMITS.maxTasks}
              >
                <IconPlus size={20} /> {tasks.length >= LIMITS.maxTasks ? `Max ${LIMITS.maxTasks} tasks` : 'Add task'}
              </button>
            </section>

            <section class="card" aria-labelledby="start-h">
              <h2 id="start-h" class="label">Start date</h2>
              <div class="segmented" role="group" aria-label="Start date">
                <button type="button" aria-pressed={startChoice === 'today'} onClick={() => setStartChoice('today')}>Today</button>
                <button type="button" aria-pressed={startChoice === 'tomorrow'} onClick={() => setStartChoice('tomorrow')}>Tomorrow</button>
                <button type="button" aria-pressed={startChoice === 'pick'} onClick={() => setStartChoice('pick')}>Pick</button>
              </div>
              {startChoice === 'pick' && (
                <div class="field">
                  <label for="start-date">Start on</label>
                  <input
                    id="start-date" class="input" type="date" min={today} max={maxDate} value={pickedDate}
                    onInput={(e) => setPickedDate(e.currentTarget.value)} aria-invalid={!startValid}
                  />
                  {!startValid && <p class="error-text">Pick a date between today and {shortDate(maxDate)}.</p>}
                </div>
              )}
            </section>

            <section class="card card-volt" aria-labelledby="summary-h">
              <h2 id="summary-h" class="label">Your 75</h2>
              <div class="row spread" style={{ alignItems: 'flex-end' }}>
                <div class="stack" style={{ gap: '2px' }}>
                  <span class="small muted">Starts</span>
                  <span class="display title-md">{startValid ? shortDate(startDate) : '—'}</span>
                  <span class="small muted">{startValid ? longDate(startDate).split(', ')[1] : ''}</span>
                </div>
                <span class="display volt" style={{ fontSize: '1.5rem', paddingBottom: '18px' }} aria-hidden="true">→</span>
                <div class="stack" style={{ gap: '2px', textAlign: 'right' }}>
                  <span class="small muted">Ends</span>
                  <span class="display title-md">{endDate ? shortDate(endDate) : '—'}</span>
                  <span class="small muted">{endDate ? longDate(endDate).split(', ')[1] : ''}</span>
                </div>
              </div>
              <p class="small muted">
                75 days · {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} a day · each day stays open until 4 AM the next morning
                ({timezone.replace(/_/g, ' ')})
              </p>
              <p class="row small" style={{ gap: '8px', alignItems: 'flex-start' }}>
                <IconLock size={18} />
                <span>Once created, the name, tasks and dates can't be changed. Miss a day and the challenge fails.</span>
              </p>
            </section>

            {error && <p class="error-text" role="alert">{error}</p>}

            <button class="btn btn-primary btn-block btn-lg" type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create challenge'}
            </button>
          </form>
        )}
      </main>
    </>
  )
}
