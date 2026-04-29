import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MapPin, Navigation, Car, Shield } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { Ride, RideShare } from '@/integrations/supabase/types'

export default function Track() {
  const { token } = useParams<{ token: string }>()
  const [share, setShare] = useState<RideShare | null>(null)
  const [ride, setRide] = useState<Ride | null>(null)
  const [loading, setLoading] = useState(true)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    if (!token) return
    supabase
      .from('ride_shares')
      .select('*, rides(*, drivers(*, profiles(*)))')
      .eq('token', token)
      .single()
      .then(({ data }) => {
        if (!data) { setLoading(false); return }
        if (new Date(data.expires_at) < new Date()) { setExpired(true); setLoading(false); return }
        setShare(data)
        setRide(data.rides as Ride)
        setLoading(false)
      })
  }, [token])

  useEffect(() => {
    if (!ride) return
    const channel = supabase
      .channel(`track:${ride.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${ride.id}` },
        payload => setRide(prev => ({ ...prev, ...payload.new } as Ride)))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [ride?.id])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
    </div>
  )

  if (expired || !ride) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4 text-center">
      <Shield className="w-12 h-12 text-gray-300" />
      <h2 className="text-xl font-bold text-gray-700">{expired ? 'Lien expiré' : 'Lien invalide'}</h2>
      <p className="text-gray-500 text-sm">Ce lien de suivi n'est plus valide.</p>
    </div>
  )

  const driver = (ride as any).drivers
  const driverProfile = driver?.profiles

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="bg-white border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <Car className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900">Mimip</span>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Suivi en direct</span>
      </div>

      {/* MAP */}
      <div className="h-64 bg-gradient-to-br from-green-100 to-teal-100 relative">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, #ccc 0, #ccc 1px, transparent 1px, transparent 30px), repeating-linear-gradient(90deg, #ccc 0, #ccc 1px, transparent 1px, transparent 30px)'
        }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
            <Car className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-white rounded-full px-3 py-1.5 shadow text-xs font-medium text-gray-700">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          Suivi en temps réel
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-5 space-y-4">
        {/* STATUT */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            <span className="font-semibold text-gray-900 capitalize">
              {ride.status === 'pending' ? 'En attente de chauffeur' :
               ride.status === 'accepted' ? 'Chauffeur assigné' :
               ride.status === 'arriving' ? 'Chauffeur en route' :
               ride.status === 'ongoing' ? 'Course en cours' :
               ride.status === 'completed' ? 'Course terminée' : ride.status}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-orange-400" />
              <span>{ride.pickup_address}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Navigation className="w-4 h-4 text-green-500" />
              <span>{ride.dropoff_address}</span>
            </div>
          </div>
        </div>

        {/* CHAUFFEUR */}
        {driverProfile && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-xs text-gray-400 mb-3">Chauffeur</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-xl font-bold text-orange-500">
                {driverProfile.full_name?.charAt(0) ?? '?'}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{driverProfile.full_name}</p>
                <p className="text-sm text-gray-500">{driver.vehicle_brand} · {driver.plate_number}</p>
              </div>
            </div>
          </div>
        )}

        <div className="text-center text-xs text-gray-400 mt-4">
          <Shield className="w-4 h-4 inline mr-1" />
          Ce lien de suivi expire le {new Date(share!.expires_at).toLocaleDateString('fr-CM')}
        </div>
      </div>
    </div>
  )
}
