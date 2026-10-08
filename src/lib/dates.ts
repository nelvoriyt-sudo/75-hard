// Calendar-date helpers. Dates are ISO "YYYY-MM-DD" strings, never Date objects in local time,
// so a day can't drift across timezones. Arithmetic runs in UTC on the date alone.

export type IsoDate = string

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

function toUtc(iso: IsoDate): number {
  const m = ISO.exec(iso)
  if (!m) throw new Error(`Invalid date: ${iso}`)
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function fromUtc(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10)
}

const DAY_MS = 86_400_000

export function addDays(iso: IsoDate, days: number): IsoDate {
  return fromUtc(toUtc(iso) + days * DAY_MS)
}

/** Whole days from a to b (b − a). */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS)
}

/** Today's calendar date in an IANA timezone. */
export function todayIn(timeZone: string, now: Date = new Date()): IsoDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** A challenge day stays open until 4 AM the next morning ("before you go to bed"). Must match
 *  public.local_today() in the database. */
export const DAY_ROLLOVER_HOURS = 4

/** The challenge day an instant belongs to, in an IANA timezone. */
export function challengeDay(timeZone: string, now: Date = new Date()): IsoDate {
  return todayIn(timeZone, new Date(now.getTime() - DAY_ROLLOVER_HOURS * 3_600_000))
}

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export function formatDate(iso: IsoDate, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(new Date(toUtc(iso)))
}

/** "Tue, Sep 29" */
export const shortDate = (iso: IsoDate) => formatDate(iso, { weekday: 'short', month: 'short', day: 'numeric' })
/** "Sep 29, 2026" */
export const longDate = (iso: IsoDate) => formatDate(iso, { month: 'short', day: 'numeric', year: 'numeric' })

/** 0 = Sunday. */
export function weekday(iso: IsoDate): number {
  return new Date(toUtc(iso)).getUTCDay()
}

export function monthStart(iso: IsoDate): IsoDate {
  return `${iso.slice(0, 7)}-01`
}

export function addMonths(iso: IsoDate, months: number): IsoDate {
  const d = new Date(toUtc(monthStart(iso)))
  d.setUTCMonth(d.getUTCMonth() + months)
  return fromUtc(d.getTime())
}

export function daysInMonth(iso: IsoDate): number {
  return diffDays(monthStart(iso), addMonths(iso, 1))
}
