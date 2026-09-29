import { useEffect, useState } from 'preact/hooks'
import { IconBack, IconBell, IconShare } from '../components/Icons'
import { useToast } from '../components/Toast'
import { errorMessage, fetchProfile, sendTestPush, updateProfile, type Profile } from '../lib/data'
import { LIMITS } from '../lib/presets'
import { disablePush, enablePush, isAppleMobile, isOnHere, isStandalone, pushSupport, PushError } from '../lib/push'
import { href } from '../lib/router'
import { supabase } from '../lib/supabase'

type Form = Omit<Profile, 'user_id'>
const hhmm = (t: string) => t.slice(0, 5)

export function SettingsPage() {
  const toast = useToast()
  const [form, setForm] = useState<Form | null>(null)
  const [saved, setSaved] = useState<Form | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    fetchProfile()
      .then((p) => {
        if (!p) return setLoadError('Profile not found.')
        const f = {
          display_name: p.display_name,
          morning_enabled: p.morning_enabled,
          morning_time: hhmm(p.morning_time),
          evening_enabled: p.evening_enabled,
          evening_time: hhmm(p.evening_time),
        }
        setForm(f)
        setSaved(f)
      })
      .catch((e) => setLoadError(errorMessage(e)))
  }, [])

  const dirty = form && saved && JSON.stringify(form) !== JSON.stringify(saved)
  const timeOk = (t: string) => /^\d{2}:\d{2}$/.test(t) && t >= '05:00' && t <= '22:30'

  async function save(e: Event) {
    e.preventDefault()
    if (!form) return
    setFormError(null)
    if (!form.display_name.trim()) return setFormError('Enter your name.')
    if (!timeOk(form.morning_time) || !timeOk(form.evening_time)) return setFormError('Reminder times must be between 5:00 AM and 10:30 PM.')
    setSaving(true)
    try {
      const next = { ...form, display_name: form.display_name.trim() }
      await updateProfile(next)
      setForm(next)
      setSaved(next)
      toast('Saved.')
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function signOut() {
    await disablePush().catch(() => undefined)
    await supabase.auth.signOut()
    location.hash = '#/'
  }

  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f))

  return (
    <>
      <header class="topbar">
        <div class="topbar-inner">
          <a class="icon-btn" href={href.home()} aria-label="Back to home"><IconBack /></a>
          <h1 class="topbar-title">Settings</h1>
        </div>
      </header>
      <main class="page">
        {loadError && <p class="error-text" role="alert">{loadError}</p>}
        {!form && !loadError && <div class="skeleton" style={{ height: '320px' }} />}

        {form && (
          <form class="stack" style={{ gap: '16px' }} onSubmit={save} noValidate>
            <section class="card" aria-labelledby="you-h">
              <h2 id="you-h" class="label">You</h2>
              <div class="field">
                <label for="display-name">First name</label>
                <input
                  id="display-name" class="input" autocomplete="given-name" maxLength={LIMITS.displayName}
                  value={form.display_name} onInput={(e) => set({ display_name: e.currentTarget.value })}
                />
              </div>
            </section>

            <section class="card" aria-labelledby="rem-h">
              <h2 id="rem-h" class="label">Reminders</h2>
              <ReminderRow
                id="morning" title="Morning kickoff" hint="Your task list for the day."
                enabled={form.morning_enabled} time={form.morning_time}
                onToggle={(v) => set({ morning_enabled: v })} onTime={(v) => set({ morning_time: v })}
              />
              <hr class="divider" />
              <ReminderRow
                id="evening" title="Evening check" hint="Only if tasks are still unchecked."
                enabled={form.evening_enabled} time={form.evening_time}
                onToggle={(v) => set({ evening_enabled: v })} onTime={(v) => set({ evening_time: v })}
              />
              <p class="hint">Times use your challenge's timezone. Between 5:00 AM and 10:30 PM.</p>
            </section>

            {formError && <p class="error-text" role="alert">{formError}</p>}
            <button class="btn btn-primary btn-block btn-lg" type="submit" disabled={saving || !dirty}>
              {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </button>
          </form>
        )}

        <DeviceNotifications />
        <InstallHelp />

        <button type="button" class="btn btn-secondary btn-block" onClick={signOut}>Sign out</button>
      </main>
    </>
  )
}

function ReminderRow(props: {
  id: string; title: string; hint: string; enabled: boolean; time: string
  onToggle: (v: boolean) => void; onTime: (v: string) => void
}) {
  return (
    <div class="stack" style={{ gap: '10px' }}>
      <div class="row spread">
        <div class="grow">
          <label for={`${props.id}-on`} style={{ fontWeight: 700 }}>{props.title}</label>
          <p class="hint">{props.hint}</p>
        </div>
        <span class="switch">
          <input id={`${props.id}-on`} type="checkbox" role="switch" checked={props.enabled} onChange={(e) => props.onToggle(e.currentTarget.checked)} />
          <span />
        </span>
      </div>
      {props.enabled && (
        <div class="row">
          <label for={`${props.id}-time`} class="small muted grow">Time</label>
          <input
            id={`${props.id}-time`} class="input" type="time" min="05:00" max="22:30" step={300}
            value={props.time} onInput={(e) => props.onTime(e.currentTarget.value)}
          />
        </div>
      )}
    </div>
  )
}

function DeviceNotifications() {
  const toast = useToast()
  const support = pushSupport()
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (support !== 'ok') return
    isOnHere().then(setOn).catch(() => setOn(false))
  }, [support])

  async function turnOn() {
    setBusy(true)
    try {
      await enablePush()
      setOn(true)
      toast('Notifications on for this device.')
    } catch (e) {
      if (e instanceof PushError && e.message === 'denied') {
        toast('Notifications are blocked. Allow them for this app in your phone settings.', 'error')
      } else if (e instanceof PushError && e.message === 'dismissed') {
        toast('No problem. Turn them on any time.')
      } else {
        toast(errorMessage(e), 'error')
      }
    } finally {
      setBusy(false)
    }
  }

  async function turnOff() {
    setBusy(true)
    await disablePush().catch(() => undefined)
    setOn(false)
    setBusy(false)
    toast('Notifications off for this device.')
  }

  async function test() {
    setBusy(true)
    try {
      const sent = await sendTestPush()
      toast(sent > 0 ? 'Test sent. Check your notifications.' : 'No devices to notify. Turn notifications off and on again.')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section class="card" aria-labelledby="notif-h">
      <div class="row">
        <IconBell />
        <h2 id="notif-h" class="label grow">Notifications on this device</h2>
      </div>
      {support === 'install' && (
        <p class="muted">On iPhone, reminders only work from the Home Screen app. Add it (below), open it from your Home Screen, then turn notifications on here.</p>
      )}
      {support === 'unsupported' && <p class="muted">This browser doesn't support notifications.</p>}
      {support === 'ok' && on === null && <div class="skeleton" style={{ height: '48px' }} />}
      {support === 'ok' && on === false && (
        <>
          <p class="muted">Get your morning and evening reminders here.</p>
          <button type="button" class="btn btn-primary btn-block" onClick={turnOn} disabled={busy}>
            {busy ? 'Turning on…' : 'Turn on notifications'}
          </button>
        </>
      )}
      {support === 'ok' && on === true && (
        <>
          <p class="muted"><span class="badge badge-volt">On</span> This device gets your reminders.</p>
          <div class="row">
            <button type="button" class="btn btn-secondary grow" onClick={test} disabled={busy}>Send test</button>
            <button type="button" class="btn btn-ghost grow" onClick={turnOff} disabled={busy}>Turn off</button>
          </div>
        </>
      )}
    </section>
  )
}

function InstallHelp() {
  if (isStandalone()) return null
  return (
    <section class="card" aria-labelledby="install-h">
      <h2 id="install-h" class="label">Add to Home Screen</h2>
      {isAppleMobile() ? (
        <ol class="stack muted" style={{ margin: 0, paddingLeft: '20px', gap: '6px' }}>
          <li>In Safari, tap <IconShare size={16} /> <strong style={{ color: 'var(--ink)' }}>Share</strong>.</li>
          <li>Tap <strong style={{ color: 'var(--ink)' }}>Add to Home Screen</strong>, then <strong style={{ color: 'var(--ink)' }}>Add</strong>.</li>
          <li>Open 75 Hard from your Home Screen and sign in.</li>
        </ol>
      ) : (
        <p class="muted">In your browser menu, choose <strong style={{ color: 'var(--ink)' }}>Install app</strong> or <strong style={{ color: 'var(--ink)' }}>Add to Home screen</strong>.</p>
      )}
    </section>
  )
}
