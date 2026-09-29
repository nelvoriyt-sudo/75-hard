import { describe, expect, it } from 'vitest'
import { addDays, addMonths, daysInMonth, diffDays, todayIn, weekday } from './dates'
import { completionsByDay, dayState, summarize, type Challenge, type Completion, type Task } from './challenge'

describe('dates', () => {
  it('adds days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-09-29', 74)).toBe('2026-12-12')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09') // US DST start: still one day
  })

  it('diffs days', () => {
    expect(diffDays('2026-09-29', '2026-12-12')).toBe(74)
    expect(diffDays('2026-10-01', '2026-09-30')).toBe(-1)
  })

  it('computes today in a given timezone', () => {
    const instant = new Date('2026-09-30T03:30:00Z')
    expect(todayIn('America/Los_Angeles', instant)).toBe('2026-09-29')
    expect(todayIn('Asia/Tokyo', instant)).toBe('2026-09-30')
  })

  it('handles month helpers', () => {
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01')
    expect(daysInMonth('2028-02-10')).toBe(29)
    expect(weekday('2026-09-29')).toBe(2) // Tuesday
  })

  it('rejects malformed dates', () => {
    expect(() => addDays('2026-9-1', 1)).toThrow()
  })
})

const tasks: Task[] = [
  { id: 'a', position: 0, title: 'A', detail: null },
  { id: 'b', position: 1, title: 'B', detail: null },
]

function challenge(over: Partial<Challenge> = {}): Challenge {
  return {
    id: 'c', name: '75 Hard', start_date: '2026-09-01', end_date: '2026-11-14', timezone: 'UTC',
    status: 'active', end_reason: null, missed_day: null, ended_at: null, created_at: '2026-09-01T00:00:00Z',
    ...over,
  }
}

function fullDays(from: string, count: number): Completion[] {
  const out: Completion[] = []
  for (let i = 0; i < count; i++) {
    const day = addDays(from, i)
    out.push({ task_id: 'a', day }, { task_id: 'b', day })
  }
  return out
}

describe('summarize', () => {
  it('reports an upcoming challenge', () => {
    const s = summarize(challenge({ start_date: '2026-10-01', end_date: '2026-12-14' }), tasks, [], '2026-09-29')
    expect(s.phase).toBe('upcoming')
    expect(s.dayNumber).toBe(0)
    expect(s.daysUntilStart).toBe(2)
    expect(s.daysLeft).toBe(75)
  })

  it('counts full days, streak and today progress', () => {
    const completions = [...fullDays('2026-09-01', 10), { task_id: 'a', day: '2026-09-11' }]
    const s = summarize(challenge(), tasks, completions, '2026-09-11')
    expect(s.phase).toBe('running')
    expect(s.dayNumber).toBe(11)
    expect(s.daysComplete).toBe(10)
    expect(s.daysLeft).toBe(65)
    expect(s.streak).toBe(10)
    expect(s.todayDone).toBe(1)
    expect(s.percent).toBe(13)
  })

  it('includes today in the streak once today is complete', () => {
    const s = summarize(challenge(), tasks, fullDays('2026-09-01', 11), '2026-09-11')
    expect(s.streak).toBe(11)
  })

  it('ends a finished challenge at day 75', () => {
    const ch = challenge({ status: 'completed', end_reason: 'finished', ended_at: '2026-11-14T22:00:00Z' })
    const s = summarize(ch, tasks, fullDays('2026-09-01', 75), '2026-11-20')
    expect(s.phase).toBe('ended')
    expect(s.dayNumber).toBe(75)
    expect(s.daysComplete).toBe(75)
    expect(s.streak).toBe(75)
  })

  it('treats a challenge with no tasks as never complete', () => {
    const s = summarize(challenge(), [], [], '2026-09-05')
    expect(s.daysComplete).toBe(0)
  })
})

describe('summarize: failed challenge', () => {
  it('reports the day it ended on, not day 75', () => {
    const ch = challenge({ status: 'failed', end_reason: 'missed_day', missed_day: '2026-09-19', ended_at: '2026-09-20T09:00:00Z' })
    const s = summarize(ch, tasks, fullDays('2026-09-01', 18), '2026-12-01')
    expect(s.phase).toBe('ended')
    expect(s.dayNumber).toBe(19)
    expect(s.streak).toBe(18)
  })
})

describe('dayState', () => {
  const byDay = completionsByDay([...fullDays('2026-09-01', 2), { task_id: 'a', day: '2026-09-03' }])

  it('classifies days of an active challenge', () => {
    const ch = challenge()
    expect(dayState(ch, '2026-08-31', '2026-09-03', byDay, 2)).toBe('empty')
    expect(dayState(ch, '2026-09-01', '2026-09-03', byDay, 2)).toBe('done')
    expect(dayState(ch, '2026-09-03', '2026-09-03', byDay, 2)).toBe('partial')
    expect(dayState(ch, '2026-09-04', '2026-09-03', byDay, 2)).toBe('upcoming')
  })

  it('marks the missed day of a failed challenge', () => {
    const ch = challenge({ status: 'failed', end_reason: 'missed_day', missed_day: '2026-09-03', ended_at: '2026-09-04T09:00:00Z' })
    expect(dayState(ch, '2026-09-03', '2026-09-10', byDay, 2)).toBe('missed')
    expect(dayState(ch, '2026-09-05', '2026-09-10', byDay, 2)).toBe('upcoming')
  })
})
