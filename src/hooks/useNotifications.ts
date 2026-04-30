import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function useNotifications() {
  const { user } = useAuth()
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission)
    }
  }, [])

  async function requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false

    const result = await Notification.requestPermission()
    setPermission(result)

    if (result === 'granted') {
      await subscribeToPush()
      return true
    }
    return false
  }

  async function subscribeToPush() {
    if (!user || !('serviceWorker' in navigator) || !VAPID_PUBLIC_KEY) return

    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) { await saveSubscription(existing); return }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      await saveSubscription(sub)
      setSubscribed(true)
    } catch (e) {
      console.error('Push subscription error:', e)
    }
  }

  async function saveSubscription(sub: PushSubscription) {
    if (!user) return
    const key = sub.getKey('p256dh')
    const auth = sub.getKey('auth')
    if (!key || !auth) return

    await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: btoa(String.fromCharCode(...new Uint8Array(key))),
      auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
    }, { onConflict: 'user_id,endpoint' })

    setSubscribed(true)
  }

  // Notification in-app (toast natif du navigateur)
  function showLocalNotification(title: string, body: string, url?: string) {
    if (permission !== 'granted') return

    const notif = new Notification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: 'mimip-ride',
      renotify: true,
    })

    if (url) notif.onclick = () => { window.focus(); window.location.href = url }
  }

  return { permission, subscribed, requestPermission, showLocalNotification }
}
