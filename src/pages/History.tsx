import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Star, Clock, Car, Filter } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { Ride, RideStatus, formatXAF } from '@/integrations/supabase/types'

const STATUS_LABELS: Record<RideStatus, { label: string; color: string }> = {
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
  accepted: { label: 'Acceptée', color: 'bg-blue-100 text-blue-700' },
  arriving: { label: 'En route', color: 'bg-blue-100 text-blue-700' },
  ongoing: { label: 'En cours', color: 'bg-green-100 text-green-700' },
  completed: { label: 'Terminée', color: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Annulée', color: 'bg-red-100 text-red-600' },
}

export default function History() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<RideStatus | 'all'>('all')

  useEffect(() => {
    if (!user) return
    const query = supabase
      .from('rides')
      .select('*, drivers(*, profiles(*))')
      .eq('passenger_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    query.then(({ data }) => {
      setRides(data ?? [])
      setLoading(false)
    })
  }, [user])

  const filtered = filter === 'all' ? rides : rides.filter(r => r.status === filter)

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-gray-900">Mes courses</h1>
          <span className="ml-auto text-sm text-gray-400">{rides.length} courses</span>
        </div>

        {/* FILTRES */}
        <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto">
          {(['all', 'completed', 'cancelled', 'ongoing'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                filter === f ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'Toutes' : STATUS_LABELS[f]?.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Car className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Aucune course trouvée</p>
            <p className="text-gray-400 text-sm mt-1">Vos courses apparaîtront ici</p>
            <Button onClick={() => navigate('/book')} className="mt-4 bg-orange-500 hover:bg-orange-600 rounded-full">
              Réserver une course
            </Button>
          </div>
        ) : (
          filtered.map(ride => {
            const statusInfo = STATUS_LABELS[ride.status]
            const driver = ride.drivers
            return (
              <div
                key={ride.id}
                onClick={() => ['pending', 'accepted', 'arriving', 'ongoing'].includes(ride.status) && navigate(`/ride/${ride.id}`)}
                className={`bg-white rounded-2xl shadow-sm p-5 ${
                  ['pending', 'accepted', 'arriving', 'ongoing'].includes(ride.status) ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <Badge className={`text-xs ${statusInfo.color} border-0`}>{statusInfo.label}</Badge>
                  <span className="text-xs text-gray-400">
                    {new Date(ride.created_at).toLocaleDateString('fr-CM', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700 line-clamp-1">{ride.pickup_address}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700 line-clamp-1">{ride.dropoff_address}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-2">
                    {driver?.profiles?.full_name && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Car className="w-3 h-3" />
                        <span>{driver.profiles.full_name}</span>
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 ml-1" />
                        <span>{driver.rating}</span>
                      </div>
                    )}
                  </div>
                  <span className="font-bold text-orange-500">
                    {ride.final_price ? formatXAF(ride.final_price) : ride.estimated_price ? `~${formatXAF(ride.estimated_price)}` : '—'}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
