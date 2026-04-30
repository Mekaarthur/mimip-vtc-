import { useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useNotifications } from '@/hooks/useNotifications'

type RideStatus = 'pending' | 'accepted' | 'arriving' | 'ongoing' | 'completed' | 'cancelled'

const STATUS_MESSAGES: Record<RideStatus, { title: string; body: string } | null> = {
  pending:   null,
  accepted:  { title: '🚗 Chauffeur trouvé !',   body: 'Votre chauffeur est en route vers vous.' },
  arriving:  { title: '📍 Chauffeur arrive !',    body: 'Votre chauffeur est presque à votre position.' },
  ongoing:   { title: '🛣️ Course démarrée',       body: 'Bon voyage !' },
  completed: { title: '✅ Course terminée',        body: 'Merci d\'avoir choisi Mimip !' },
  cancelled: { title: '❌ Course annulée',         body: 'Votre course a été annulée.' },
}

// Passager : écoute les changements de statut de sa course
export function useRideNotifications(rideId: string | undefined) {
  const { showLocalNotification } = useNotifications()
  const prevStatus = useRef<RideStatus | null>(null)

  useEffect(() => {
    if (!rideId) return

    const channel = supabase
      .channel(`ride-notif-${rideId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rides',
        filter: `id=eq.${rideId}`,
      }, payload => {
        const newStatus = payload.new.status as RideStatus
        const oldStatus = prevStatus.current

        if (newStatus !== oldStatus) {
          prevStatus.current = newStatus
          const msg = STATUS_MESSAGES[newStatus]
          if (msg) showLocalNotification(msg.title, msg.body, `/ride/${rideId}`)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [rideId])
}

// Chauffeur : écoute les nouvelles courses disponibles
export function useNewRideNotifications(driverId: string | null, city: string) {
  const { showLocalNotification } = useNotifications()

  useEffect(() => {
    if (!driverId) return

    const channel = supabase
      .channel(`new-rides-${driverId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'rides',
        filter: `status=eq.pending`,
      }, payload => {
        const ride = payload.new
        showLocalNotification(
          '🔔 Nouvelle course !',
          `${ride.pickup_address} → ${ride.dropoff_address}`,
          '/driver/dashboard'
        )
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [driverId, city])
}
