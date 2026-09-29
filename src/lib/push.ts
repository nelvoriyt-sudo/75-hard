// Browser side of reminders: the service worker, permission, and this device's push subscription.
import { VAPID_PUBLIC_KEY } from '../config'
import { deletePushSubscription, hasPushSubscription, savePushSubscription } from './data'

const BASE = import.meta.env.BASE_URL

/** 'install': iPhone/iPad in a browser tab, where push only works from the Home Screen app. */
export type PushSupport = 'ok' | 'install' | 'unsupported'

export function isAppleMobile(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function pushSupport(): PushSupport {
  const apis = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (isAppleMobile() && !isStandalone()) return 'install'
  return apis ? 'ok' : 'unsupported'
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE, updateViaCache: 'none' }).catch(() => undefined)
}

export class PushError extends Error {}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.byteLength) return false
  const x = new Uint8Array(a)
  return x.every((v, i) => v === b[i])
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(BASE)
  if (!existing) await navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE, updateViaCache: 'none' })
  // Subscribing needs an active worker.
  return navigator.serviceWorker.ready
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'ok') return null
  const reg = await navigator.serviceWorker.getRegistration(BASE)
  return reg ? reg.pushManager.getSubscription() : null
}

/** Whether this device delivers the signed-in person's reminders. */
export async function isOnHere(): Promise<boolean> {
  const sub = await currentSubscription()
  if (!sub || Notification.permission !== 'granted') return false
  return hasPushSubscription(sub.endpoint)
}

/** Must start from a tap: the permission prompt has to come first or iPhones ignore it. */
export async function enablePush(): Promise<void> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new PushError(permission === 'denied' ? 'denied' : 'dismissed')
  const reg = await registration()
  const key = keyBytes(VAPID_PUBLIC_KEY)
  let sub = await reg.pushManager.getSubscription()
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe()
    sub = null
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new PushError('subscribe_failed')
  await savePushSubscription({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth })
}

/** Stops reminders on this device, on the server and in the browser. */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription().catch(() => null)
  if (!sub) return
  await deletePushSubscription(sub.endpoint).catch(() => undefined)
  await sub.unsubscribe().catch(() => false)
}
