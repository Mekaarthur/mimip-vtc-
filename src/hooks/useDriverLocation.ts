import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'

export interface DriverPosition {
  lat: number
  lng: number
  updated_at?: string
}

// Passager : écoute la position d'un chauffeur en temps réel
export function useDriverLocation(driverId: string | null) {
  const [position, setPosition] = useState<DriverPosition | null>(null)

  useEffect(() => {
    if (!driverId) return

    // Charger la position initiale
    supabase
      .from('drivers')
      .select('current_lat, current_lng, updated_at')
      .eq('id', driverId)
      .single()
      .then(({ data }) => {
        if (data?.current_lat && data?.current_lng) {
          setPosition({ lat: data.current_lat, lng: data.current_lng, updated_at: data.updated_at })
        }
      })

    // Écouter les mises à jour en temps réel
    const channel = supabase
      .channel(`driver-location-${driverId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'drivers',
        filter: `id=eq.${driverId}`,
      }, payload => {
        const d = payload.new as { current_lat: number; current_lng: number; updated_at: string }
        if (d.current_lat && d.current_lng) {
          setPosition({ lat: d.current_lat, lng: d.current_lng, updated_at: d.updated_at })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [driverId])

  return position
}

// Chauffeur : envoie sa position GPS
export function useShareLocation(driverId: string | null, isOnline: boolean) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!driverId || !isOnline) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    if (!navigator.geolocation) {
      setError('GPS non disponible sur cet appareil')
      return
    }

    async function sendPosition() {
      navigator.geolocation.getCurrentPosition(
        async pos => {
          await supabase
            .from('drivers')
            .update({
              current_lat: pos.coords.latitude,
              current_lng: pos.coords.longitude,
              updated_at: new Date().toISOString(),
            })
            .eq('id', driverId)
          setError(null)
        },
        err => {
          if (err.code === err.PERMISSION_DENIED) {
            setError('Autorisez le GPS pour partager votre position')
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    }

    sendPosition()
    intervalRef.current = setInterval(sendPosition, 8000) // toutes les 8 secondes

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [driverId, isOnline])

  return { error }
}
