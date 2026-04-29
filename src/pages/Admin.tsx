import { useState, useEffect } from 'react'
import { Users, Car, TrendingUp, AlertTriangle, CheckCircle, X, Eye, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { Driver, Ride, SosAlert, formatXAF } from '@/integrations/supabase/types'

interface Stats {
  totalRides: number
  completedRides: number
  totalPassengers: number
  totalDrivers: number
  totalRevenue: number
  pendingDrivers: number
  activeAlerts: number
}

export default function Admin() {
  const { toast } = useToast()
  const [tab, setTab] = useState<'overview' | 'drivers' | 'rides' | 'alerts'>('overview')
  const [stats, setStats] = useState<Stats | null>(null)
  const [pendingDrivers, setPendingDrivers] = useState<Driver[]>([])
  const [recentRides, setRecentRides] = useState<Ride[]>([])
  const [alerts, setAlerts] = useState<SosAlert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [
        { count: totalRides },
        { count: completedRides },
        { count: totalPassengers },
        { count: totalDrivers },
        { data: rides },
        { data: drivers },
        { data: sosAlerts },
      ] = await Promise.all([
        supabase.from('rides').select('*', { count: 'exact', head: true }),
        supabase.from('rides').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'passenger'),
        supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'driver'),
        supabase.from('rides').select('*, profiles(full_name), drivers(plate_number)').order('created_at', { ascending: false }).limit(20),
        supabase.from('drivers').select('*, profiles(full_name, phone)').eq('is_verified', false).limit(20),
        supabase.from('sos_alerts').select('*').eq('status', 'active').order('created_at', { ascending: false }),
      ])

      const completedRidesList = rides?.filter(r => r.status === 'completed') ?? []
      const totalRevenue = completedRidesList.reduce((sum, r) => sum + (r.final_price ?? 0), 0)

      setStats({
        totalRides: totalRides ?? 0,
        completedRides: completedRides ?? 0,
        totalPassengers: totalPassengers ?? 0,
        totalDrivers: totalDrivers ?? 0,
        totalRevenue,
        pendingDrivers: drivers?.length ?? 0,
        activeAlerts: sosAlerts?.length ?? 0,
      })
      setRecentRides(rides ?? [])
      setPendingDrivers(drivers ?? [])
      setAlerts(sosAlerts ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const approveDriver = async (driverId: string) => {
    const { error } = await supabase
      .from('drivers')
      .update({ is_verified: true, verification_level: 5 })
      .eq('id', driverId)
    if (!error) {
      setPendingDrivers(prev => prev.filter(d => d.id !== driverId))
      toast({ title: 'Chauffeur approuvé !', description: 'Le chauffeur peut maintenant recevoir des courses.' })
    }
  }

  const resolveAlert = async (alertId: string) => {
    await supabase.from('sos_alerts').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', alertId)
    setAlerts(prev => prev.filter(a => a.id !== alertId))
    toast({ title: 'Alerte résolue' })
  }

  const TABS = [
    { id: 'overview', label: 'Vue d\'ensemble' },
    { id: 'drivers', label: `Chauffeurs (${stats?.pendingDrivers ?? 0})` },
    { id: 'rides', label: 'Courses' },
    { id: 'alerts', label: `🚨 SOS (${stats?.activeAlerts ?? 0})` },
  ] as const

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-500" />
            <h1 className="font-bold text-gray-900">Admin Mimip</h1>
          </div>
          {stats && stats.activeAlerts > 0 && (
            <Badge className="bg-red-500 text-white animate-pulse">
              {stats.activeAlerts} alerte(s) active(s)
            </Badge>
          )}
        </div>
        <div className="max-w-5xl mx-auto px-4 flex gap-4 pb-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* OVERVIEW */}
        {tab === 'overview' && stats && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Courses totales', value: stats.totalRides, icon: Car, color: 'text-blue-500' },
                { label: 'Passagers', value: stats.totalPassengers, icon: Users, color: 'text-green-500' },
                { label: 'Chauffeurs', value: stats.totalDrivers, icon: Car, color: 'text-orange-500' },
                { label: 'Revenus', value: formatXAF(stats.totalRevenue), icon: TrendingUp, color: 'text-purple-500' },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-2xl p-5 shadow-sm">
                  <card.icon className={`w-6 h-6 ${card.color} mb-2`} />
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{card.label}</p>
                </div>
              ))}
            </div>

            {stats.activeAlerts > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-red-700">{stats.activeAlerts} alerte(s) SOS active(s)</p>
                  <p className="text-sm text-red-600">Des passagers ont déclenché une alerte.</p>
                </div>
                <Button onClick={() => setTab('alerts')} className="bg-red-500 hover:bg-red-600 rounded-lg text-sm">
                  Voir
                </Button>
              </div>
            )}

            {stats.pendingDrivers > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3">
                <Car className="w-6 h-6 text-orange-500 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-orange-700">{stats.pendingDrivers} chauffeur(s) en attente</p>
                  <p className="text-sm text-orange-600">Des dossiers sont à vérifier.</p>
                </div>
                <Button onClick={() => setTab('drivers')} variant="outline" className="border-orange-300 text-orange-600 rounded-lg text-sm">
                  Vérifier
                </Button>
              </div>
            )}
          </div>
        )}

        {/* CHAUFFEURS EN ATTENTE */}
        {tab === 'drivers' && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-900">Chauffeurs en attente de vérification</h2>
            {pendingDrivers.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
                <CheckCircle className="w-10 h-10 mx-auto mb-2" />
                <p>Tous les chauffeurs sont vérifiés</p>
              </div>
            ) : (
              pendingDrivers.map(driver => (
                <div key={driver.id} className="bg-white rounded-2xl shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{(driver as any).profiles?.full_name ?? 'N/A'}</p>
                      <p className="text-sm text-gray-500">{(driver as any).profiles?.phone}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{driver.vehicle_type}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm text-gray-600 mb-4">
                    <span>{driver.vehicle_brand} {driver.vehicle_model}</span>
                    <span>{driver.vehicle_color}</span>
                    <span className="font-medium">{driver.plate_number}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 border-red-200 text-red-500 rounded-lg text-sm">
                      <X className="w-4 h-4 mr-1" /> Refuser
                    </Button>
                    <Button onClick={() => approveDriver(driver.id)} className="flex-1 bg-green-500 hover:bg-green-600 rounded-lg text-sm">
                      <CheckCircle className="w-4 h-4 mr-1" /> Approuver
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* COURSES RÉCENTES */}
        {tab === 'rides' && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-900">Courses récentes</h2>
            {recentRides.map(ride => (
              <div key={ride.id} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge className={`text-xs border-0 ${
                    ride.status === 'completed' ? 'bg-green-100 text-green-700' :
                    ride.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {ride.status}
                  </Badge>
                  <span className="text-xs text-gray-400">{new Date(ride.created_at).toLocaleDateString('fr-CM')}</span>
                </div>
                <p className="text-sm text-gray-700 mb-1 truncate">{ride.pickup_address} → {ride.dropoff_address}</p>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{(ride as any).profiles?.full_name ?? 'Passager'}</span>
                  <span className="font-bold text-orange-500">{formatXAF(ride.final_price ?? ride.estimated_price ?? 0)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ALERTES SOS */}
        {tab === 'alerts' && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Alertes SOS actives
            </h2>
            {alerts.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
                <Shield className="w-10 h-10 mx-auto mb-2" />
                <p>Aucune alerte active</p>
              </div>
            ) : (
              alerts.map(alert => (
                <div key={alert.id} className="bg-red-50 border border-red-200 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <Badge className="bg-red-500 text-white border-0 animate-pulse">🚨 SOS ACTIF</Badge>
                    <span className="text-xs text-red-500">{new Date(alert.created_at).toLocaleTimeString('fr-CM')}</span>
                  </div>
                  <p className="text-sm text-red-700 mb-1">Course ID : {alert.ride_id.slice(0, 8)}...</p>
                  {alert.lat && alert.lng && (
                    <p className="text-xs text-red-600 mb-3">GPS : {alert.lat.toFixed(4)}, {alert.lng.toFixed(4)}</p>
                  )}
                  <Button onClick={() => resolveAlert(alert.id)} className="w-full bg-red-500 hover:bg-red-600 rounded-lg">
                    Marquer comme résolu
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
