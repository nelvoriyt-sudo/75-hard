// Sends a test notification to the signed-in user's own devices.
// verify_jwt is off (new signing keys); the user's access token is verified with Supabase Auth below.
import { adminClient, APP_URL, json, loadPushConfig, sendPush } from '../_shared/push.ts'

const ALLOWED_ORIGINS = new Set([new URL(APP_URL).origin, 'http://localhost:5173', 'http://localhost:4173'])

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : new URL(APP_URL).origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    Vary: 'Origin',
  }
}

Deno.serve(async (req) => {
  const headers = cors(req)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, headers)

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'unauthorized' }, 401, headers)

  try {
    const admin = adminClient()
    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData.user) return json({ error: 'unauthorized' }, 401, headers)

    const { data, error } = await admin.rpc('claim_test_push', { p_user_id: userData.user.id })
    if (error) {
      if (error.code === '54000') return json({ error: 'rate_limited' }, 429, headers)
      throw new Error('claim_failed')
    }
    const targets = (data ?? []) as { endpoint: string; p256dh: string; auth: string }[]
    if (targets.length === 0) return json({ sent: 0 }, 200, headers)

    const cfg = await loadPushConfig(admin)
    let sent = 0
    for (const target of targets) {
      const result = await sendPush(cfg, target, {
        title: 'Reminders are on',
        body: "You'll get a nudge at your set times. Stay hard.",
        tag: 'test',
      })
      if (result === 'sent') sent++
      else if (result === 'gone') await admin.rpc('remove_dead_subscription', { p_endpoint: target.endpoint })
    }
    return json({ sent }, 200, headers)
  } catch (e) {
    console.error('test-push', e instanceof Error ? e.message : 'unknown')
    return json({ error: 'internal' }, 500, headers)
  }
})
