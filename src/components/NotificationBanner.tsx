import { useState } from 'react'
import { Bell, X } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'

export function NotificationBanner() {
  const { permission, subscribed, requestPermission } = useNotifications()
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(false)

  if (permission === 'granted' || permission === 'denied' || subscribed || dismissed) return null

  async function handleAllow() {
    setLoading(true)
    await requestPermission()
    setLoading(false)
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 bg-yellow-900 text-white rounded-2xl p-4 shadow-xl flex items-start gap-3">
      <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center shrink-0">
        <Bell className="w-5 h-5 text-yellow-900" />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-sm">Activer les notifications</p>
        <p className="text-xs text-yellow-200 mt-0.5">
          Soyez alerté quand votre chauffeur arrive ou quand votre course est confirmée.
        </p>
        <button
          onClick={handleAllow}
          disabled={loading}
          className="mt-2 bg-yellow-400 text-yellow-900 font-bold text-xs px-4 py-1.5 rounded-full hover:bg-yellow-300 transition-colors"
        >
          {loading ? 'Activation...' : 'Activer'}
        </button>
      </div>
      <button onClick={() => setDismissed(true)} className="text-yellow-300 hover:text-white shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
