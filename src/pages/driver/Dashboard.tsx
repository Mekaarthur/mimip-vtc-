import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Car, MapPin, Navigation, Star, TrendingUp, Bell, BellOff, CheckCircle, X, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { useDriverRides } from '@/hooks/useRide'
import { supabase } from '@/integrations/supabase/client'
import { Driver, Ride, DriverStatus, formatXAF } from '@/integrations/supabase/types'

export default function DriverDashboard() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user, profile } = useAuth()
  const { pendingRides, acceptRide, updateRideStatus } = useDriverRides()

  const [driver, setDriver] = useState<Driver | null>(null)
  const [currentRide, setCurrentRide] = useState<Ride | null>(null)
  const [todayEarnings, setTodayEarnings] = useState(0)
  const [todayRides, setTodayRides] = useState(0)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { data: driverData } = await supabase
        .from('drivers')
        .select('*')
        .eq('profile_id', user.id)
        .single()

      if (!driverData) {
        navigate('/driver/register')
        return
      }
      setDriver(driverData)

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { data: rides } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', driverData.id)
        .gte('created_at', today.toISOString())

      const completed = rides?.filter(r => r.status === 'completed') ?? []
      setTodayRides(completed.length)
      setTodayEarnings(completed.reduce((sum, r) => sum + (r.final_price ?? 0), 0))

      const active = rides?.find(r => ['accepted', 'arriving', 'ongoing'].includes(r.status))
      if (active) setCurrentRide(active)

      setLoading(false)
    }
    load()
  }, [user, navigate])

  // Countdown 15s par course en attente
  useEffect(() => {
    const timers: NodeJS.Timeout[] = []
    pendingRides.forEach(ride => {
      if (countdown[ride.id] === undefined) {
        setCountdown(prev => ({ ...prev, [ride.id]: 15 }))
      }
    })
    const interval = setInterval(() => {
      setCountdown(prev => {
        const next = { ...prev }
        Object.keys(next).forEach(id => {
          if (next[id] > 0) next[id]--
        })
        return next
      })
    }, 1000)
    return () => { clearInterval(interval); timers.forEach(clearTimeout) }
  }, [pendingRides])

  const toggleStatus = async (status: DriverStatus) => {
    if (!driver) return
    const { error } = await supabase
      .from('drivers')
      .update({ status })
      .eq('id', driver.id)
    if (!error) {
      setDriver(d => d ? { ...d, status } : d)
      toast({
        title: status === 'offline' ? 'Vous êtes hors ligne' : 'Vous êtes en ligne !',
        description: status === 'available' ? 'Vous pouvez recevoir des courses.' : 'Aucune nouvelle course ne vous sera attribuée.',
      })
    }
  }

  const handleAccept = async (ride: Ride) => {
    if (!driver) return
    setAccepting(ride.id)
    const { error } = await acceptRide(ride.id, driver.id)
    setAccepting(null)
    if (error) {
      toast({ title: 'Course déjà prise', description: 'Un autre chauffeur a accepté cette course.', variant: 'destructive' })
    } else {
      setCurrentRide(ride)
      toast({ title: 'Course acceptée !', description: `Direction : ${ride.pickup_address}` })
    }
  }

  const handleUpdateStatus = async (status: Ride['status']) => {
    if (!currentRide) return
    await updateRideStatus(currentRide.id, status)
    setCurrentRide(r => r ? { ...r, status } : r)
    if (status === 'completed') {
      setCurrentRide(null)
      setTodayRides(n => n + 1)
      toast({ title: 'Course terminée !', description: 'Bravo ! Continuez comme ça.' })
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
    </div>
  )

  const isOnline = driver?.status !== 'offline'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center font-bold text-orange-500">
              {profile?.full_name?.charAt(0) ?? 'C'}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{profile?.full_name ?? 'Chauffeur'}</p>
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs text-gray-500">{driver?.rating ?? '5.0'}</span>
              </div>
            </div>
          </div>
          {/* TOGGLE EN LIGNE */}
          <button
            onClick={() => toggleStatus(isOnline ? 'offline' : 'available')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-all ${
              isOnline ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            {isOnline ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            {isOnline ? 'En ligne' : 'Hors ligne'}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* STATS DU JOUR */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-orange-500">{todayRides}</p>
            <p className="text-xs text-gray-500 mt-1">Courses aujourd'hui</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <p className="text-lg font-bold text-green-500">{formatXAF(todayEarnings)}</p>
            <p className="text-xs text-gray-500 mt-1">Gains du jour</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{driver?.total_rides ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Total courses</p>
          </div>
        </div>

        {/* COURSE EN COURS */}
        {currentRide && (
          <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-orange-400">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Course en cours</h2>
              <Badge className="bg-orange-100 text-orange-700 border-0">Active</Badge>
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700">{currentRide.pickup_address}</span>
              </div>
              <div className="flex items-start gap-2">
                <Navigation className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700">{currentRide.dropoff_address}</span>
              </div>
            </div>
            <div className="flex justify-between text-sm mb-4">
              <span className="text-gray-500">Prix estimé</span>
              <span className="font-bold text-orange-500">{formatXAF(currentRide.estimated_price ?? 0)}</span>
            </div>

            {/* ACTIONS SELON STATUT */}
            <div className="flex gap-2">
              {currentRide.status === 'accepted' && (
                <Button onClick={() => handleUpdateStatus('arriving')} className="flex-1 bg-blue-500 hover:bg-blue-600 rounded-xl">
                  <Car className="w-4 h-4 mr-1" /> Je suis arrivé
                </Button>
              )}
              {currentRide.status === 'arriving' && (
                <Button onClick={() => handleUpdateStatus('ongoing')} className="flex-1 bg-green-500 hover:bg-green-600 rounded-xl">
                  <Navigation className="w-4 h-4 mr-1" /> Démarrer la course
                </Button>
              )}
              {currentRide.status === 'ongoing' && (
                <Button onClick={() => handleUpdateStatus('completed')} className="flex-1 bg-orange-500 hover:bg-orange-600 rounded-xl">
                  <CheckCircle className="w-4 h-4 mr-1" /> Terminer la course
                </Button>
              )}
            </div>
          </div>
        )}

        {/* COURSES EN ATTENTE */}
        {isOnline && !currentRide && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Bell className="w-4 h-4 text-orange-400" />
              Nouvelles demandes
              {pendingRides.length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingRides.length}
                </span>
              )}
            </h2>

            {pendingRides.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Car className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                <p className="text-sm">En attente de courses...</p>
                <p className="text-xs mt-1">Les demandes apparaîtront ici en temps réel</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRides.map(ride => {
                  const secs = countdown[ride.id] ?? 15
                  return (
                    <div key={ride.id} className="border border-orange-200 rounded-xl p-4 bg-orange-50">
                      <div className="flex items-center justify-between mb-3">
                        <Badge className="bg-orange-500 text-white border-0 text-xs">
                          Nouvelle course
                        </Badge>
                        <div className="flex items-center gap-1 text-orange-600 font-bold">
                          <Clock className="w-4 h-4" />
                          <span>{secs}s</span>
                        </div>
                      </div>
                      <div className="space-y-1.5 mb-3">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <MapPin className="w-3 h-3 text-orange-400" />
                          <span className="line-clamp-1">{ride.pickup_address}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Navigation className="w-3 h-3 text-green-500" />
                          <span className="line-clamp-1">{ride.dropoff_address}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-500 capitalize">{ride.vehicle_type}</span>
                        <span className="font-bold text-orange-500">{formatXAF(ride.estimated_price ?? 0)}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 border-red-200 text-red-500 rounded-lg"
                        >
                          <X className="w-4 h-4" /> Refuser
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAccept(ride)}
                          disabled={accepting === ride.id}
                          className="flex-1 bg-green-500 hover:bg-green-600 rounded-lg"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          {accepting === ride.id ? 'Acceptation...' : 'Accepter'}
                        </Button>
                      </div>
                      {/* Barre de progression */}
                      <div className="mt-2 h-1 bg-orange-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500 transition-all duration-1000"
                          style={{ width: `${(secs / 15) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {!isOnline && (
          <div className="bg-gray-100 rounded-2xl p-8 text-center">
            <BellOff className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Vous êtes hors ligne</p>
            <p className="text-gray-400 text-sm mt-1">Passez en ligne pour recevoir des courses</p>
            <Button onClick={() => toggleStatus('available')} className="mt-4 bg-green-500 hover:bg-green-600 rounded-full">
              Passer en ligne
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
