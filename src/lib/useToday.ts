import { useEffect, useState } from 'preact/hooks'
import { todayIn, type IsoDate } from './dates'

/** Today's date in a timezone, updating at midnight and whenever the app comes back to the front. */
export function useToday(timeZone: string): IsoDate {
  const [today, setToday] = useState(() => todayIn(timeZone))
  useEffect(() => {
    const check = () => setToday(todayIn(timeZone))
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
