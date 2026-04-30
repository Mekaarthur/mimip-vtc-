import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Car, MapPin, Navigation, Star, Bell, BellOff,
  CheckCircle, X, Clock, TrendingUp, AlertTriangle,
  CreditCard, ChevronRight, Zap, Users
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { useDriverRides } from '@/hooks/useRide'
import { useShareLocation } from '@/hooks/useDriverLocation'
import { supabase } from '@/integrations/supabase/client'
import { Driver, Ride, DriverStatus, formatXAF } from '@/integrations/supabase/types'

interface MonthlyStats {
  total_rides: number
  total_earnings: number
  total_commission: number
  net_earnings: number
  alert_sent: boolean
}

interface Subscription {
  status: 'pending' | 'paid' | 'overdue'
  amount: number
  paid_at: string | null
}

interface DriverAlert {
  id: string
  type: string
  message: string
  is_read: boolean
  created_at: string
}

const MINIMUM_RIDES = 20
const ALERT_DAY = 25

export default function DriverDashboard() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user, profile } = useAuth()
  const { pendingRides, acceptRide, updateRideStatus } = useDriverRides()

  const [driver, setDriver] = useState<Driver | null>(null)
  const [currentRide, setCurrentRide] = useState<Ride | null>(null)
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [alerts, setAlerts] = useState<DriverAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<Record<string, number>>({})

  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()
  const today = new Date().getDate()
  const daysLeft = new Date(currentYear, currentMonth, 0).getDate() - today
  const ridesLeft = Math.max(0, MINIMUM_RIDES - (monthlyStats?.total_rides ?? 0))
  const progressPercent = Math.min(100, ((monthlyStats?.total_rides ?? 0) / MINIMUM_RIDES) * 100)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { data: driverData } = await supabase
        .from('drivers').select('*').eq('profile_id', user.id).single()

      if (!driverData) { navigate('/driver/register'); return }
      setDriver(driverData)

      const [
        { data: stats },
        { data: sub },
        { data: alertsData },
        { data: activeRide },
      ] = await Promise.all([
        supabase.from('driver_monthly_stats')
          .select('*')
          .eq('driver_id', driverData.id)
          .eq('month', currentMonth)
          .eq('year', currentYear)
          .single(),
        supabase.from('driver_subscriptions')
          .select('*')
          .eq('driver_id', driverData.id)
          .eq('month', currentMonth)
          .eq('year', currentYear)
          .single(),
        supabase.from('driver_alerts')
          .select('*')
          .eq('driver_id', driverData.id)
          .eq('is_read', false)
          .order('created_at', { ascending: false }),
        supabase.from('rides')
          .select('*')
          .eq('driver_id', driverData.id)
          .in('status', ['accepted', 'arriving', 'ongoing'])
          .single(),
      ])

      setMonthlyStats(stats ?? { total_rides: 0, total_earnings: 0, total_commission: 0, net_earnings: 0, alert_sent: false })
      setSubscription(sub ?? null)
      setAlerts(alertsData ?? [])
      if (activeRide) setCurrentRide(activeRide)
      setLoading(false)
    }
    load()
  }, [user, navigate, currentMonth, currentYear])

  // Countdown 15s par course en attente
  useEffect(() => {
    pendingRides.forEach(ride => {
      if (countdown[ride.id] === undefined)
        setCountdown(prev => ({ ...prev, [ride.id]: 15 }))
    })
    const interval = setInterval(() => {
      setCountdown(prev => {
        const next = { ...prev }
        Object.keys(next).forEach(id => { if (next[id] > 0) next[id]-- })
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [pendingRides])

  const toggleStatus = async (status: DriverStatus) => {
    if (!driver) return
    await supabase.from('drivers').update({ status }).eq('id', driver.id)
    setDriver(d => d ? { ...d, status } : d)
    toast({
      title: status === 'available' ? '✅ Vous êtes en ligne !' : '⏸ Vous êtes hors ligne',
      description: status === 'available' ? 'Vous pouvez recevoir des courses.' : 'Aucune course ne vous sera attribuée.',
    })
  }

  const handleAccept = async (ride: Ride) => {
    if (!driver) return
    setAccepting(ride.id)
    const { error } = await acceptRide(ride.id, driver.id)
    setAccepting(null)
    if (error) {
      toast({ title: 'Course déjà prise', variant: 'destructive' })
    } else {
      setCurrentRide(ride)
      toast({ title: '🚗 Course acceptée !', description: `Direction : ${ride.pickup_address}` })
    }
  }

  const handleUpdateStatus = async (status: Ride['status']) => {
    if (!currentRide) return
    await updateRideStatus(currentRide.id, status)
    setCurrentRide(r => r ? { ...r, status } : r)
    if (status === 'completed') {
      setCurrentRide(null)
      setMonthlyStats(s => s ? { ...s, total_rides: s.total_rides + 1 } : s)
      toast({ title: '✅ Course terminée !', description: 'Bravo, continuez comme ça !' })
    }
  }

  const dismissAlert = async (alertId: string) => {
    await supabase.from('driver_alerts').update({ is_read: true }).eq('id', alertId)
    setAlerts(prev => prev.filter(a => a.id !== alertId))
  }

  const paySubscription = async (method: 'mtn_momo' | 'orange_money') => {
    if (!driver) return
    await supabase.from('driver_subscriptions').upsert({
      driver_id: driver.id,
      month: currentMonth,
      year: currentYear,
      amount: 10000,
      commission_rate: 8,
      status: 'pending',
      payment_method: method,
    })
    toast({
      title: '📱 Demande envoyée',
      description: `Confirmez le paiement de 10 000 XAF sur votre ${method === 'mtn_momo' ? 'MTN MoMo' : 'Orange Money'}.`,
    })
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
    </div>
  )

  const isOnline = driver?.status !== 'offline'
  const { error: gpsError } = useShareLocation(driver?.id ?? null, isOnline)
  const monthNames = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center font-bold text-orange-500 text-lg">
              {profile?.full_name?.charAt(0) ?? 'C'}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{profile?.full_name ?? 'Chauffeur'}</p>
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs text-gray-500">{driver?.rating ?? '5.0'} · {driver?.total_rides ?? 0} courses</span>
              </div>
            </div>
          </div>

          {/* TOGGLE EN LIGNE */}
          <button
            onClick={() => toggleStatus(isOnline ? 'offline' : 'available')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all ${
              isOnline ? 'bg-green-500 text-white shadow-green-200 shadow-md' : 'bg-gray-200 text-gray-600'
            }`}
          >
            {isOnline
              ? <><span className="w-2 h-2 bg-white rounded-full animate-pulse" /> En ligne</>
              : <><BellOff className="w-3 h-3" /> Hors ligne</>
            }
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ALERTE GPS */}
        {gpsError && isOnline && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <MapPin className="w-5 h-5 text-orange-500 shrink-0" />
            <p className="text-sm text-orange-700">{gpsError}</p>
          </div>
        )}

        {/* ══ ALERTES IMPORTANTES ══ */}
        {alerts.map(alert => (
          <div key={alert.id} className={`rounded-2xl p-4 flex items-start gap-3 ${
            alert.type === 'rides_minimum'
              ? 'bg-amber-50 border border-amber-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${
              alert.type === 'rides_minimum' ? 'text-amber-500' : 'text-red-500'
            }`} />
            <div className="flex-1">
              <p className={`text-sm font-semibold ${
                alert.type === 'rides_minimum' ? 'text-amber-700' : 'text-red-700'
              }`}>{alert.message}</p>
            </div>
            <button onClick={() => dismissAlert(alert.id)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}

        {/* ══ ABONNEMENT ══ */}
        <div className={`bg-white rounded-2xl shadow-sm p-5 border-l-4 ${
          subscription?.status === 'paid'
            ? 'border-green-400'
            : subscription?.status === 'overdue'
            ? 'border-red-400'
            : 'border-orange-400'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CreditCard className={`w-5 h-5 ${
                subscription?.status === 'paid' ? 'text-green-500'
                : subscription?.status === 'overdue' ? 'text-red-500'
                : 'text-orange-500'
              }`} />
              <span className="font-semibold text-gray-900">Abonnement {monthNames[currentMonth - 1]} {currentYear}</span>
            </div>
            <Badge className={`border-0 text-xs ${
              subscription?.status === 'paid'
                ? 'bg-green-100 text-green-700'
                : subscription?.status === 'overdue'
                ? 'bg-red-100 text-red-700'
                : 'bg-orange-100 text-orange-700'
            }`}>
              {subscription?.status === 'paid' ? '✓ Payé'
               : subscription?.status === 'overdue' ? '⚠ En retard'
               : '⏳ À payer'}
            </Badge>
          </div>

          {subscription?.status === 'paid' ? (
            <p className="text-sm text-gray-500">
              10 000 XAF payé le {subscription.paid_at
                ? new Date(subscription.paid_at).toLocaleDateString('fr-CM')
                : '—'}
              <span className="text-green-600 font-medium ml-2">· Commission 8%</span>
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-3">
                10 000 XAF/mois · Commission 8% par course
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => paySubscription('mtn_momo')}
                  className="flex-1 py-2.5 rounded-xl bg-yellow-400 text-black text-xs font-bold hover:bg-yellow-500 transition-colors"
                >
                  MTN MoMo
                </button>
                <button
                  onClick={() => paySubscription('orange_money')}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-colors"
                >
                  Orange Money
                </button>
              </div>
            </>
          )}
        </div>

        {/* ══ COMPTEUR MENSUEL ══ */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Courses ce mois</h2>
            <span className="text-xs text-gray-400">{monthNames[currentMonth - 1]} {currentYear}</span>
          </div>

          {/* BARRE DE PROGRESSION */}
          <div className="mb-3">
            <div className="flex justify-between text-sm mb-2">
              <span className={`font-bold text-2xl ${
                (monthlyStats?.total_rides ?? 0) >= MINIMUM_RIDES ? 'text-green-500' : 'text-gray-900'
              }`}>
                {monthlyStats?.total_rides ?? 0}
                <span className="text-base font-normal text-gray-400"> / {MINIMUM_RIDES} minimum</span>
              </span>
              {(monthlyStats?.total_rides ?? 0) >= MINIMUM_RIDES && (
                <span className="text-green-500 text-sm font-semibold">✓ Objectif atteint !</span>
              )}
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  progressPercent >= 100 ? 'bg-green-500' :
                  progressPercent >= 60 ? 'bg-orange-400' : 'bg-red-400'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* ALERTE J25 */}
          {today >= ALERT_DAY && ridesLeft > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 rounded-xl px-3 py-2.5 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700 font-medium">
                Il vous reste <strong>{ridesLeft} course{ridesLeft > 1 ? 's' : ''}</strong> pour atteindre le minimum · {daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* STATS FINANCIÈRES */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-50">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">
                {formatXAF(monthlyStats?.total_earnings ?? 0)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Gains bruts</p>
            </div>
            <div className="text-center border-x border-gray-100">
              <p className="text-lg font-bold text-red-400">
                -{formatXAF(monthlyStats?.total_commission ?? 0)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Commission 8%</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-green-500">
                {formatXAF(monthlyStats?.net_earnings ?? 0)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Net encaissé</p>
            </div>
          </div>
        </div>

        {/* ══ COURSE EN COURS ══ */}
        {currentRide && (
          <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-orange-400">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-400" />
                Course en cours
              </h2>
              <Badge className="bg-orange-100 text-orange-700 border-0 animate-pulse">Active</Badge>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-400 shrink-0 mt-1" />
                <span className="text-sm text-gray-700">{currentRide.pickup_address}</span>
              </div>
              <div className="ml-1.5 w-0.5 h-3 bg-gray-200" />
              <div className="flex items-start gap-2">
                <Navigation className="w-3 h-3 text-green-500 shrink-0 mt-1" />
                <span className="text-sm text-gray-700">{currentRide.dropoff_address}</span>
              </div>
            </div>

            <div className="flex justify-between text-sm mb-4 pt-2 border-t border-gray-50">
              <span className="text-gray-500">Prix estimé</span>
              <div className="text-right">
                <span className="font-bold text-orange-500">{formatXAF(currentRide.estimated_price ?? 0)}</span>
                <span className="text-xs text-gray-400 ml-2">
                  (vous : {formatXAF(Math.round((currentRide.estimated_price ?? 0) * 0.92))})
                </span>
              </div>
            </div>

            {/* ACTIONS SELON STATUT */}
            <div className="flex gap-2">
              {currentRide.status === 'accepted' && (
                <Button onClick={() => handleUpdateStatus('arriving')}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 rounded-xl h-11">
                  <MapPin className="w-4 h-4 mr-1" /> Je suis arrivé
                </Button>
              )}
              {currentRide.status === 'arriving' && (
                <Button onClick={() => handleUpdateStatus('ongoing')}
                  className="flex-1 bg-green-500 hover:bg-green-600 rounded-xl h-11">
                  <Navigation className="w-4 h-4 mr-1" /> Démarrer
                </Button>
              )}
              {currentRide.status === 'ongoing' && (
                <Button onClick={() => handleUpdateStatus('completed')}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 rounded-xl h-11">
                  <CheckCircle className="w-4 h-4 mr-1" /> Terminer la course
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ══ NOUVELLES DEMANDES ══ */}
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
              <div className="text-center py-8">
                <Car className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">En attente de courses...</p>
                <p className="text-xs text-gray-300 mt-1">Les demandes apparaissent ici en temps réel</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRides.map(ride => {
                  const secs = countdown[ride.id] ?? 15
                  const isSurge = ride.estimated_price && ride.estimated_price > 3000
                  return (
                    <div key={ride.id} className="border-2 border-orange-200 rounded-xl p-4 bg-orange-50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-orange-500 text-white border-0 text-xs">
                            Nouvelle course
                          </Badge>
                          {isSurge && (
                            <Badge className="bg-yellow-400 text-black border-0 text-xs">
                              <Zap className="w-3 h-3 mr-0.5" /> +500 XAF heure de pointe
                            </Badge>
                          )}
                        </div>
                        <div className={`flex items-center gap-1 font-bold text-sm ${
                          secs <= 5 ? 'text-red-500' : 'text-orange-600'
                        }`}>
                          <Clock className="w-3 h-3" />
                          {secs}s
                        </div>
                      </div>

                      <div className="space-y-1.5 mb-3">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                          <span className="truncate">{ride.pickup_address}</span>
                        </div>
                        <div className="ml-1 w-0.5 h-2 bg-gray-300" />
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Navigation className="w-3 h-3 text-green-500 shrink-0" />
                          <span className="truncate">{ride.dropoff_address}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-3 text-sm">
                        <span className="text-gray-500 capitalize">{ride.vehicle_type}</span>
                        <div className="text-right">
                          <span className="font-bold text-orange-500">{formatXAF(ride.estimated_price ?? 0)}</span>
                          <span className="text-xs text-green-600 ml-1">
                            → vous : {formatXAF(Math.round((ride.estimated_price ?? 0) * 0.92))}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm"
                          className="flex-1 border-red-200 text-red-500 hover:bg-red-50 rounded-xl h-10">
                          <X className="w-4 h-4 mr-1" /> Refuser
                        </Button>
                        <Button size="sm"
                          onClick={() => handleAccept(ride)}
                          disabled={accepting === ride.id}
                          className="flex-1 bg-green-500 hover:bg-green-600 rounded-xl h-10">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          {accepting === ride.id ? '...' : 'Accepter'}
                        </Button>
                      </div>

                      {/* Barre countdown */}
                      <div className="mt-2 h-1.5 bg-orange-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${
                            secs <= 5 ? 'bg-red-500' : 'bg-orange-500'
                          }`}
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

        {/* ══ HORS LIGNE ══ */}
        {!isOnline && !currentRide && (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
            <BellOff className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-semibold">Vous êtes hors ligne</p>
            <p className="text-gray-400 text-sm mt-1 mb-4">Passez en ligne pour recevoir des courses</p>
            <Button onClick={() => toggleStatus('available')}
              className="bg-green-500 hover:bg-green-600 rounded-full px-8">
              Passer en ligne
            </Button>
          </div>
        )}

        {/* ══ LIEN VERS HISTORIQUE ══ */}
        <button
          onClick={() => navigate('/history')}
          className="w-full flex items-center justify-between bg-white rounded-2xl shadow-sm px-5 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Voir tout l'historique</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </button>
      </div>
    </div>
  )
}
