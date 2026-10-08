import { useEffect, useState } from 'preact/hooks'
import { challengeDay, type IsoDate } from './dates'

/** The current challenge day, updating at the 4 AM rollover and whenever the app comes back to the front. */
export function useToday(timeZone: string): IsoDate {
  const [today, setToday] = useState(() => challengeDay(timeZone))
  useEffect(() => {
    const check = () => setToday(challengeDay(timeZone))
    check()
    const timer = window.setInterval(check, 30_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [timeZone])
  return today
}
