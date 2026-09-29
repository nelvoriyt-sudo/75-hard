// Service worker: shows reminder notifications and opens the app when one is tapped.
// It deliberately does not cache pages, so the app is always the latest version.
const APP_SCOPE = self.registration.scope

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  const title = typeof data.title === 'string' ? data.title.slice(0, 80) : '75 Hard'
  const body = typeof data.body === 'string' ? data.body.slice(0, 200) : 'Time to check in.'
  const tag = typeof data.tag === 'string' ? data.tag.slice(0, 32) : 'reminder'
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: `${APP_SCOPE}icons/icon-192.png`,
      badge: `${APP_SCOPE}icons/icon-192.png`,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows.find((w) => w.url.startsWith(APP_SCOPE))
      if (existing) return existing.focus()
      return self.clients.openWindow(APP_SCOPE)
    })(),
  )
})
