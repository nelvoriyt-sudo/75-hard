// Hash routing: GitHub Pages serves one file, so routes live after "#".
import { useEffect, useState } from 'preact/hooks'

export type Route =
  | { name: 'home' }
  | { name: 'new' }
  | { name: 'settings' }
  | { name: 'challenge'; id: string; tab: 'dashboard' | 'tasks' | 'calendar' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'new') return { name: 'new' }
  if (parts[0] === 'settings') return { name: 'settings' }
  if (parts[0] === 'c' && parts[1] && UUID.test(parts[1])) {
    const tab = parts[2] === 'tasks' || parts[2] === 'calendar' ? parts[2] : 'dashboard'
    return { name: 'challenge', id: parts[1], tab }
  }
  return { name: 'home' }
}

export const href = {
  home: () => '#/',
  new: () => '#/new',
  settings: () => '#/settings',
  challenge: (id: string, tab: 'dashboard' | 'tasks' | 'calendar' = 'dashboard') =>
    tab === 'dashboard' ? `#/c/${id}` : `#/c/${id}/${tab}`,
}

export function navigate(to: string, replace = false) {
  if (replace) location.replace(to)
  else location.hash = to
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
