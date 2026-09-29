// Called by pg_cron every 5 minutes. Sends morning and "tasks left" evening reminders.
// verify_jwt is off: the caller proves itself with the cron secret stored in Vault.
import { adminClient, json, loadPushConfig, safeEqual, sendPush, type Message } from '../_shared/push.ts'

type DueRow = {
  user_id: string
  kind: 'morning' | 'evening'
  day_number: number
  tasks_total: number
  tasks_left: number
  endpoint: string
  p256dh: string
  auth: string
}

function message(row: DueRow): Message {
  if (row.kind === 'morning') {
    return {
      title: `Day ${row.day_number} of 75`,
      body: `${row.tasks_total} tasks today. Start strong.`,
      tag: 'morning',
    }
  }
  const left = row.tasks_left === 1 ? '1 task' : `${row.tasks_left} tasks`
  return {
    title: `Day ${row.day_number}: ${left} left`,
    body: 'Finish before midnight. No excuses.',
    tag: 'evening',
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  try {
    const admin = adminClient()
    const cfg = await loadPushConfig(admin)
    if (!safeEqual(req.headers.get('x-cron-secret') ?? '', cfg.cronSecret)) {
      return json({ error: 'unauthorized' }, 401)
    }

    const { data, error } = await admin.rpc('claim_due_reminders')
    if (error) throw new Error('claim_failed')
    const rows = (data ?? []) as DueRow[]

    let sent = 0
    let failed = 0
    for (let i = 0; i < rows.length; i += 10) {
      const batch = rows.slice(i, i + 10)
      const results = await Promise.all(batch.map((row) => sendPush(cfg, row, message(row))))
      for (const [j, result] of results.entries()) {
        if (result === 'sent') sent++
        else if (result === 'gone') await admin.rpc('remove_dead_subscription', { p_endpoint: batch[j].endpoint })
        else failed++
      }
    }
    return json({ sent, failed })
  } catch (e) {
    console.error('send-reminders', e instanceof Error ? e.message : 'unknown')
    return json({ error: 'internal' }, 500)
  }
})
