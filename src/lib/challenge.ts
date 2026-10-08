// Pure challenge math shared by the dashboard, tasks and calendar views.
// The database is the authority (it fails and finishes challenges); this only describes state.
import { addDays, challengeDay, diffDays, type IsoDate } from './dates'

export const CHALLENGE_DAYS = 75

export type ChallengeStatus = 'active' | 'failed' | 'completed'

export type Challenge = {
  id: string
  name: string
  start_date: IsoDate
  end_date: IsoDate
  timezone: string
  status: ChallengeStatus
  end_reason: 'gave_up' | 'missed_day' | 'finished' | null
  missed_day: IsoDate | null
  ended_at: string | null
  created_at: string
}

export type Task = { id: string; position: number; title: string; detail: string | null }
export type Completion = { task_id: string; day: IsoDate }

export type DayState = 'done' | 'partial' | 'today' | 'missed' | 'upcoming' | 'empty'

export type Summary = {
  phase: 'upcoming' | 'running' | 'ended'
  /** 1–75 while running; 0 before the start; clamped to 75 after. */
  dayNumber: number
  daysUntilStart: number
  daysComplete: number
  daysLeft: number
  streak: number
  todayDone: number
  taskCount: number
  percent: number
}

/** Completed task ids per day. */
export function completionsByDay(completions: Completion[]): Map<IsoDate, Set<string>> {
  const map = new Map<IsoDate, Set<string>>()
  for (const c of completions) {
    let set = map.get(c.day)
    if (!set) map.set(c.day, (set = new Set()))
    set.add(c.task_id)
  }
  return map
}

/** The last calendar day the challenge was live (end date, or the day it ended early). */
function lastLiveDay(ch: Challenge, today: IsoDate): IsoDate {
  if (ch.status === 'active') return today < ch.end_date ? today : ch.end_date
  if (ch.missed_day) return ch.missed_day
  if (ch.ended_at) {
    // The challenge day it was ended on.
    const ended = challengeDay(ch.timezone, new Date(ch.ended_at))
    return ended < ch.end_date ? ended : ch.end_date
  }
  return ch.end_date
}

export function summarize(ch: Challenge, tasks: Task[], completions: Completion[], today: IsoDate): Summary {
  const byDay = completionsByDay(completions)
  const taskCount = tasks.length
  const isFull = (day: IsoDate) => taskCount > 0 && (byDay.get(day)?.size ?? 0) >= taskCount

  let daysComplete = 0
  for (let i = 0; i < CHALLENGE_DAYS; i++) if (isFull(addDays(ch.start_date, i))) daysComplete++

  const phase: Summary['phase'] =
    ch.status !== 'active' || today > ch.end_date ? 'ended' : today < ch.start_date ? 'upcoming' : 'running'

  // The day reached: today while running, the last live day once it has ended.
  const reached = phase === 'ended' ? lastLiveDay(ch, today) : today
  const dayNumber = phase === 'upcoming' ? 0 : Math.min(Math.max(diffDays(ch.start_date, reached) + 1, 1), CHALLENGE_DAYS)

  // Streak: consecutive full days ending today (if today is full) or yesterday.
  let streak = 0
  const last = lastLiveDay(ch, today)
  let cursor = isFull(last) ? last : addDays(last, -1)
  while (cursor >= ch.start_date && isFull(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }

  const todayDone = phase === 'running' ? (byDay.get(today)?.size ?? 0) : 0

  return {
    phase,
    dayNumber,
    daysUntilStart: phase === 'upcoming' ? diffDays(today, ch.start_date) : 0,
    daysComplete,
    daysLeft: CHALLENGE_DAYS - daysComplete,
    streak,
    todayDone,
    taskCount,
    percent: Math.round((daysComplete / CHALLENGE_DAYS) * 100),
  }
}

export function dayState(
  ch: Challenge,
  day: IsoDate,
  today: IsoDate,
  byDay: Map<IsoDate, Set<string>>,
  taskCount: number,
): DayState {
  if (day < ch.start_date || day > ch.end_date) return 'empty'
  const done = byDay.get(day)?.size ?? 0
  if (taskCount > 0 && done >= taskCount) return 'done'
  if (ch.status === 'failed' && ch.missed_day === day) return 'missed'
  if (ch.status === 'active' && day === today) return done > 0 ? 'partial' : 'today'
  if (day < today && day < lastLiveDay(ch, today)) return 'missed'
  return 'upcoming'
}
