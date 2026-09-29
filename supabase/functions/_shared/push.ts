// Shared Web Push helpers for the edge functions.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.2'
import webpush from 'npm:web-push@3.6.7'

export const APP_URL = 'https://75-hard.vercel.app/'

export type Target = { endpoint: string; p256dh: string; auth: string }
export type Message = { title: string; body: string; tag: string }
type PushConfig = { vapidPublic: string; vapidPrivate: string; cronSecret: string }

export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  let key: string | undefined
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (secretKeys) {
    try {
      key = (JSON.parse(secretKeys) as Record<string, string>)['default']
    } catch {
      key = undefined
    }
  }
  key ??= Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('missing_supabase_env')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function loadPushConfig(admin: SupabaseClient): Promise<PushConfig> {
  const { data, error } = await admin.rpc('get_push_config').single<{
    vapid_public: string | null
    vapid_private: string | null
    cron_secret: string | null
  }>()
  if (error || !data?.vapid_public || !data.vapid_private || !data.cron_secret) throw new Error('missing_push_config')
  return { vapidPublic: data.vapid_public, vapidPrivate: data.vapid_private, cronSecret: data.cron_secret }
}

/** Constant-time string comparison for shared secrets. */
export function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

// Only real browser push services, so a stored endpoint can never point the server elsewhere.
function isPushService(endpoint: string): boolean {
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.port !== '') return false
  const h = url.hostname
  return (
    h === 'fcm.googleapis.com' ||
    h === 'android.googleapis.com' ||
    h === 'web.push.apple.com' ||
    h.endsWith('.push.apple.com') ||
    h === 'updates.push.services.mozilla.com' ||
    h.endsWith('.notify.windows.com')
  )
}

export type SendResult = 'sent' | 'gone' | 'failed'

/** Encrypts with web-push, then sends with fetch and a timeout. */
export async function sendPush(cfg: PushConfig, target: Target, msg: Message): Promise<SendResult> {
  if (!isPushService(target.endpoint)) return 'gone'
  const details = webpush.generateRequestDetails(
    { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
    JSON.stringify({ ...msg, url: APP_URL }),
    {
      vapidDetails: { subject: APP_URL, publicKey: cfg.vapidPublic, privateKey: cfg.vapidPrivate },
      TTL: 60 * 60 * 6,
      urgency: 'normal',
    },
  )
  // fetch sets Content-Length itself.
  const headers = Object.fromEntries(
    Object.entries(details.headers as Record<string, string | number>)
      .filter(([k]) => k.toLowerCase() !== 'content-length')
      .map(([k, v]) => [k, String(v)]),
  )
  try {
    const res = await fetch(details.endpoint, {
      method: details.method,
      headers,
      body: details.body as Uint8Array,
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    })
    await res.body?.cancel()
    if (res.status === 404 || res.status === 410) return 'gone'
    return res.ok ? 'sent' : 'failed'
  } catch {
    return 'failed'
  }
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}
