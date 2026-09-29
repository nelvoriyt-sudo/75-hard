// Data access. Reads use row level security (own rows only); every write is a database function
// that re-checks the signed-in user and the challenge rules.
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Challenge, Completion, Task } from './challenge'
import type { IsoDate } from './dates'
import { isAccent, type Accent } from './theme'

export type Profile = {
  user_id: string
  display_name: string
  morning_enabled: boolean
  morning_time: string
  evening_enabled: boolean
  evening_time: string
  accent: Accent
}

export type ChallengeBundle = { challenge: Challenge; tasks: Task[]; completions: Completion[] }

const MESSAGES = {
  active_challenge_exists: 'You already have an active challenge. Finish it or fail it before starting a new one.',
  invalid_name: 'Give it a name between 1 and 40 characters.',
  invalid_start_date: 'Pick a start date between today and 30 days from now.',
  invalid_tasks: 'Add 1 to 12 tasks. Each needs a name (up to 60 characters).',
  invalid_timezone: "Your device's timezone isn't recognised. Check your date settings and try again.",
  challenge_not_active: 'This challenge has already ended.',
  outside_challenge_dates: 'Tasks can only be checked off for today while the challenge is running.',
  not_found: "That couldn't be found. It may have been removed.",
  not_authenticated: 'Your session expired. Sign in again.',
  rate_limited: 'Give it a few seconds before sending another test.',
  invalid_input: 'Something in that form is not valid. Check it and try again.',
  invalid_subscription: "This device's notification details were rejected. Try turning notifications off and on.",
  unknown: 'Something went wrong. Check your connection and try again.',
} as const

export type ErrorCode = keyof typeof MESSAGES

export class AppError extends Error {
  constructor(public readonly code: ErrorCode) {
    super(MESSAGES[code])
  }
}

// Database functions raise stable machine codes as their message (see the migration).
function fail(error: { message?: string } | null): never {
  const code = (error?.message ?? '') as ErrorCode
  throw new AppError(code in MESSAGES ? code : 'unknown')
}

export const errorMessage = (e: unknown) => (e instanceof AppError ? e.message : MESSAGES.unknown)

const CHALLENGE_COLUMNS =
  'id, name, start_date, end_date, timezone, status, end_reason, missed_day, ended_at, created_at'

export async function fetchProfile(): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, display_name, morning_enabled, morning_time, evening_enabled, evening_time, accent')
    .maybeSingle()
  if (error) fail(error)
  if (!data) return null
  return { ...data, accent: isAccent(data.accent) ? data.accent : 'volt' }
}

export async function setAccent(accent: Accent): Promise<void> {
  const { error } = await supabase.rpc('set_accent', { p_accent: accent })
  if (error) fail(error)
}

/** Settles an ended active challenge (missed day or past day 75) before anything is shown. */
export async function syncMyChallenge(): Promise<void> {
  const { error } = await supabase.rpc('sync_my_challenge')
  if (error) fail(error)
}

export async function listChallenges(): Promise<Challenge[]> {
  const { data, error } = await supabase
    .from('challenges')
    .select(CHALLENGE_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) fail(error)
  return (data ?? []) as Challenge[]
}

export async function fetchChallengeBundle(id: string): Promise<ChallengeBundle | null> {
  const [ch, tasks, completions] = await Promise.all([
    supabase.from('challenges').select(CHALLENGE_COLUMNS).eq('id', id).maybeSingle(),
    supabase.from('challenge_tasks').select('id, position, title, detail').eq('challenge_id', id).order('position'),
    // At most 75 days × 12 tasks = 900 rows.
    supabase.from('task_completions').select('task_id, day').eq('challenge_id', id).range(0, 999),
  ])
  if (ch.error) fail(ch.error)
  if (tasks.error) fail(tasks.error)
  if (completions.error) fail(completions.error)
  if (!ch.data) return null
  return {
    challenge: ch.data as Challenge,
    tasks: (tasks.data ?? []) as Task[],
    completions: (completions.data ?? []) as Completion[],
  }
}

export async function createChallenge(input: {
  name: string
  startDate: IsoDate
  timezone: string
  tasks: { title: string; detail: string }[]
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_challenge', {
    p_name: input.name,
    p_start_date: input.startDate,
    p_timezone: input.timezone,
    p_tasks: input.tasks,
  })
  if (error) fail(error)
  return data as string
}

export async function setTaskDone(taskId: string, done: boolean): Promise<'active' | 'completed'> {
  const { data, error } = await supabase.rpc('set_task_done', { p_task_id: taskId, p_done: done })
  if (error) fail(error)
  return data as 'active' | 'completed'
}

export async function failChallenge(id: string): Promise<void> {
  const { error } = await supabase.rpc('fail_challenge', { p_challenge_id: id })
  if (error) fail(error)
}

export async function updateProfile(p: Omit<Profile, 'user_id' | 'accent'>): Promise<void> {
  const { error } = await supabase.rpc('update_profile', {
    p_display_name: p.display_name,
    p_morning_enabled: p.morning_enabled,
    p_morning_time: p.morning_time,
    p_evening_enabled: p.evening_enabled,
    p_evening_time: p.evening_time,
  })
  if (error) fail(error)
}

export async function savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string }): Promise<void> {
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: sub.p256dh,
    p_auth: sub.auth,
  })
  if (error) fail(error)
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  const { error } = await supabase.rpc('delete_push_subscription', { p_endpoint: endpoint })
  if (error) fail(error)
}

export async function hasPushSubscription(endpoint: string): Promise<boolean> {
  const { data, error } = await supabase.from('push_subscriptions').select('id').eq('endpoint', endpoint).maybeSingle()
  if (error) fail(error)
  return data !== null
}

export async function sendTestPush(): Promise<number> {
  const { data, error } = await supabase.functions.invoke<{ sent: number }>('test-push', { body: {} })
  if (error) {
    if (error instanceof FunctionsHttpError && (error.context as Response).status === 429) throw new AppError('rate_limited')
    throw new AppError('unknown')
  }
  return data?.sent ?? 0
}
