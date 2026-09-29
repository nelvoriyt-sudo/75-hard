import type { AuthError } from '@supabase/supabase-js'
import { useState } from 'preact/hooks'
import { supabase } from '../lib/supabase'
import { LIMITS } from '../lib/presets'

// NIST SP 800-63B: 15+ characters for a password used on its own, no composition rules, paste allowed.
// 72 bytes is Supabase's bcrypt limit; longer input is rejected rather than silently cut.
const PW_MIN = 15
const PW_MAX_BYTES = 72

function passwordProblem(pw: string): string | null {
  if (pw.length < PW_MIN) return `Use at least ${PW_MIN} characters. A few random words works well.`
  if (new TextEncoder().encode(pw).length > PW_MAX_BYTES) return 'That password is too long. Keep it under 72 characters.'
  return null
}

function authMessage(error: AuthError): string {
  switch (error.code) {
    case 'invalid_credentials': return 'Email or password is incorrect.'
    case 'user_already_exists':
    case 'email_exists': return 'An account with that email already exists. Sign in instead.'
    case 'weak_password': return `Choose a stronger password (at least ${PW_MIN} characters).`
    case 'email_address_invalid': return 'Enter a valid email address.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit': return 'Too many attempts. Wait a minute and try again.'
    case 'signup_disabled': return 'New sign-ups are turned off.'
    case 'email_not_confirmed': return 'Confirm your email first, then sign in.'
    default: return 'Something went wrong. Check your connection and try again.'
  }
}

export function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const signup = mode === 'signup'

  async function submit(e: Event) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    const trimmedEmail = email.trim()
    if (signup) {
      if (!name.trim()) return setError('Enter your first name.')
      const problem = passwordProblem(password)
      if (problem) return setError(problem)
    }
    setBusy(true)
    try {
      if (signup) {
        const { data, error: err } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: { data: { display_name: name.trim().slice(0, LIMITS.displayName) } },
        })
        if (err) return setError(authMessage(err))
        if (!data.session) setNotice('Check your email to confirm your account, then sign in.')
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password })
        if (err) return setError(authMessage(err))
      }
    } catch {
      setError('Something went wrong. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  function switchMode(next: 'signin' | 'signup') {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  return (
    <main class="page" style={{ justifyContent: 'center', paddingTop: 'calc(24px + env(safe-area-inset-top))' }}>
      <div class="hero-glow stack" style={{ gap: '8px', marginBottom: '8px' }}>
        <h1 class="wordmark" style={{ fontSize: 'clamp(4.5rem, 26vw, 7rem)' }}>
          <b>75</b> Hard
        </h1>
        <p class="label" style={{ color: 'var(--ink)' }}>No shortcuts. No days off.</p>
      </div>

      <div class="segmented" role="group" aria-label="Account">
        <button type="button" aria-pressed={!signup} onClick={() => switchMode('signin')}>Sign in</button>
        <button type="button" aria-pressed={signup} onClick={() => switchMode('signup')}>Create account</button>
      </div>

      <form class="card" onSubmit={submit} noValidate>
        {signup && (
          <div class="field">
            <label for="name">First name</label>
            <input
              id="name" class="input" autocomplete="given-name" maxLength={LIMITS.displayName}
              value={name} onInput={(e) => setName(e.currentTarget.value)} required
            />
          </div>
        )}
        <div class="field">
          <label for="email">Email</label>
          <input
            id="email" class="input" type="email" inputMode="email" autocomplete="email" autoCapitalize="none"
            spellcheck={false} value={email} onInput={(e) => setEmail(e.currentTarget.value)} required
          />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input
            id="password" class="input" type="password"
            autocomplete={signup ? 'new-password' : 'current-password'}
            value={password} onInput={(e) => setPassword(e.currentTarget.value)} required
            aria-describedby={signup ? 'pw-hint' : undefined}
          />
          {signup && <p id="pw-hint" class="hint">At least {PW_MIN} characters. Tip: 3–4 random words.</p>}
        </div>

        {error && <p class="error-text" role="alert">{error}</p>}
        {notice && <p class="small volt" role="status">{notice}</p>}

        <button class="btn btn-primary btn-block btn-lg" type="submit" disabled={busy}>
          {busy ? 'One sec…' : signup ? 'Create account' : 'Sign in'}
        </button>
      </form>
      <p class="hint" style={{ textAlign: 'center' }}>Your progress is private to your account.</p>
    </main>
  )
}
