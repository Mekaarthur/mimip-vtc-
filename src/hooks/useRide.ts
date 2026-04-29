import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Ride, RideStatus, PaymentMethod, VehicleType } from '@/integrations/supabase/types'
import { useAuth } from './useAuth'

export function useRide(rideId?: string) {
  const { user } = useAuth()
  const [ride, setRide] = useState<Ride | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!rideId) return
    setLoading(true)
    supabase
      .from('rides')
      .select('*, profiles(*), drivers(*, profiles(*))')
      .eq('id', rideId)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setRide(data)
        setLoading(false)
      })

    const channel = supabase
      .channel(`ride:${rideId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rides',
        filter: `id=eq.${rideId}`,
      }, payload => setRide(prev => ({ ...prev, ...payload.new } as Ride)))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [rideId])

  const createRide = useCallback(async (params: {
    pickup_address: string
    dropoff_address: string
    pickup_lat: number
    pickup_lng: number
    dropoff_lat: number
    dropoff_lng: number
    vehicle_type: VehicleType
    payment_method: PaymentMethod
    estimated_price: number
    scheduled_at?: string
    notes?: string
  }) => {
    if (!user) return { error: 'Non connecté' }
    setLoading(true)
    const { data, error } = await supabase
      .from('rides')
      .insert({ ...params, passenger_id: user.id })
      .select()
      .single()
    setLoading(false)
    return { data, error }
  }, [user])

  const cancelRide = useCallback(async (reason?: string) => {
    if (!rideId || !user) return
    return supabase
      .from('rides')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        cancel_reason: reason ?? 'Annulé par le passager',
      })
      .eq('id', rideId)
  }, [rideId, user])

  const rateRide = useCallback(async (score: number, comment?: string) => {
    if (!ride || !user) return
    const toUserId = ride.passenger_id === user.id
      ? ride.drivers?.profile_id
      : ride.passenger_id
    return supabase.from('ratings').insert({
      ride_id: ride.id,
      score,
      comment,
      from_user_id: user.id,
      to_user_id: toUserId,
    })
  }, [ride, user])

  const triggerSOS = useCallback(async (lat?: number, lng?: number) => {
    if (!rideId || !user) return
    return supabase.from('sos_alerts').insert({
      ride_id: rideId,
      triggered_by: user.id,
      lat,
      lng,
    })
  }, [rideId, user])

  const shareRide = useCallback(async () => {
    if (!rideId || !user) return null
    const { data } = await supabase
      .from('ride_shares')
      .insert({ ride_id: rideId, shared_by: user.id })
      .select()
      .single()
    if (data) return `${window.location.origin}/track/${data.token}`
    return null
  }, [rideId, user])

  return { ride, loading, error, createRide, cancelRide, rateRide, triggerSOS, shareRide }
}

export function useDriverRides() {
  const { user, isDriver } = useAuth()
  const [pendingRides, setPendingRides] = useState<Ride[]>([])

  useEffect(() => {
    if (!user || !isDriver) return

    const channel = supabase
      .channel('pending_rides')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'rides',
        filter: `status=eq.pending`,
      }, payload => {
        setPendingRides(prev => [payload.new as Ride, ...prev])
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rides',
      }, payload => {
        const updated = payload.new as Ride
        if (updated.status !== 'pending') {
          setPendingRides(prev => prev.filter(r => r.id !== updated.id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, isDriver])

  const acceptRide = useCallback(async (rideId: string, driverId: string) => {
    return supabase
      .from('rides')
      .update({
        driver_id: driverId,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', rideId)
      .eq('status', 'pending')
  }, [])

  const updateRideStatus = useCallback(async (rideId: string, status: RideStatus) => {
    const timestamps: Record<string, string> = {}
    if (status === 'arriving') timestamps.arrived_at = new Date().toISOString()
    if (status === 'ongoing') timestamps.started_at = new Date().toISOString()
    if (status === 'completed') timestamps.completed_at = new Date().toISOString()
    return supabase.from('rides').update({ status, ...timestamps }).eq('id', rideId)
  }, [])

  return { pendingRides, acceptRide, updateRideStatus }
}
