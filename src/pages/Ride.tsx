import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Phone, Share2, Shield, Star, X, CheckCircle, Clock, MapPin, Navigation, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useRide } from '@/hooks/useRide'
import { useAuth } from '@/hooks/useAuth'
import { useDriverLocation } from '@/hooks/useDriverLocation'
import { MapView } from '@/components/MapView'
import { RideStatus, formatXAF } from '@/integrations/supabase/types'

const STATUS_STEPS: { status: RideStatus; label: string; icon: typeof Clock }[] = [
  { status: 'pending', label: 'Recherche d\'un chauffeur', icon: Clock },
  { status: 'accepted', label: 'Chauffeur assigné', icon: CheckCircle },
  { status: 'arriving', label: 'Chauffeur en route', icon: MapPin },
  { status: 'ongoing', label: 'Course en cours', icon: Navigation },
  { status: 'completed', label: 'Course terminée', icon: CheckCircle },
]

export default function RidePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const { ride, loading, cancelRide, rateRide, triggerSOS, shareRide } = useRide(id)

  const [rating, setRating] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [showRating, setShowRating] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showPin, setShowPin] = useState(false)

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
    </div>
  )

  if (!ride) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
      <AlertTriangle className="w-12 h-12 text-gray-300" />
      <p className="text-gray-500">Course introuvable</p>
      <Button onClick={() => navigate('/book')} variant="outline">Nouvelle réservation</Button>
    </div>
  )

  const currentStepIndex = STATUS_STEPS.findIndex(s => s.status === ride.status)
  const driver = ride.drivers
  const driverProfile = driver?.profiles
  const driverPosition = useDriverLocation(driver?.id ?? null)

  const handleCancel = async () => {
    setCancelling(true)
    await cancelRide('Annulé par le passager')
    setCancelling(false)
    toast({ title: 'Course annulée', description: 'Votre course a été annulée.' })
    navigate('/book')
  }

  const handleShare = async () => {
    const url = await shareRide()
    if (url) {
      navigator.clipboard.writeText(url)
      toast({ title: 'Lien copié !', description: 'Partagez ce lien avec vos proches pour qu\'ils suivent votre trajet.' })
    }
  }

  const handleSOS = async () => {
    navigator.geolocation.getCurrentPosition(async pos => {
      await triggerSOS(pos.coords.latitude, pos.coords.longitude)
      toast({ title: '🚨 Alerte SOS envoyée', description: 'Les secours ont été alertés. Restez calme.', variant: 'destructive' })
    }, async () => {
      await triggerSOS()
      toast({ title: '🚨 Alerte SOS envoyée', description: 'Les secours ont été alertés.', variant: 'destructive' })
    })
  }

  const handleRate = async () => {
    if (rating === 0) return
    await rateRide(rating, ratingComment)
    toast({ title: 'Merci pour votre avis !', description: 'Votre évaluation a été enregistrée.' })
    setShowRating(false)
    navigate('/history')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* CARTE TEMPS RÉEL */}
      <div className="relative h-72">
        <MapView
          height="288px"
          driverPosition={driverPosition ?? undefined}
          pickup={ride.pickup_lat ? { lat: ride.pickup_lat, lng: ride.pickup_lng, label: ride.pickup_address } : null}
          dropoff={ride.dropoff_lat ? { lat: ride.dropoff_lat, lng: ride.dropoff_lng, label: ride.dropoff_address } : null}
          className="rounded-none"
        />
        {/* Boutons flottants */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          <button onClick={handleShare} className="w-10 h-10 bg-white rounded-full shadow flex items-center justify-center hover:bg-gray-50">
            <Share2 className="w-4 h-4 text-gray-600" />
          </button>
          <button onClick={handleSOS} className="w-10 h-10 bg-red-500 rounded-full shadow flex items-center justify-center hover:bg-red-600">
            <Shield className="w-4 h-4 text-white" />
          </button>
        </div>
        {/* Indicateur live */}
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 bg-white rounded-full px-3 py-1.5 shadow text-xs font-medium text-gray-700">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          {driverPosition ? 'Chauffeur localisé' : 'Suivi en temps réel'}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* STATUT */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Statut de votre course</h2>
          <div className="space-y-3">
            {STATUS_STEPS.filter(s => s.status !== 'cancelled').map((step, i) => {
              const done = i < currentStepIndex
              const active = i === currentStepIndex
              return (
                <div key={step.status} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    done ? 'bg-green-500' : active ? 'bg-orange-500 animate-pulse' : 'bg-gray-100'
                  }`}>
                    <step.icon className={`w-4 h-4 ${done || active ? 'text-white' : 'text-gray-400'}`} />
                  </div>
                  <span className={`text-sm ${active ? 'font-semibold text-orange-500' : done ? 'text-green-600' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* CHAUFFEUR */}
        {driver && driverProfile && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Votre chauffeur</h2>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center text-2xl font-bold text-orange-500">
                {driverProfile.full_name?.charAt(0) ?? '?'}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">{driverProfile.full_name ?? 'Chauffeur'}</div>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  <span>{driver.rating}</span>
                  <span className="mx-1">·</span>
                  <span>{driver.vehicle_brand} {driver.vehicle_model}</span>
                </div>
                <Badge variant="outline" className="mt-1 text-xs">{driver.plate_number}</Badge>
              </div>
              {driverProfile.phone && (
                <a href={`tel:${driverProfile.phone}`}>
                  <Button size="sm" className="bg-green-500 hover:bg-green-600 rounded-full">
                    <Phone className="w-4 h-4" />
                  </Button>
                </a>
              )}
            </div>

            {/* PIN DE VÉRIFICATION */}
            <div className="mt-4 p-4 bg-orange-50 rounded-xl">
              <p className="text-sm text-orange-700 font-medium mb-2">🔐 Code de vérification</p>
              <p className="text-xs text-orange-600">Communiquez ce code à votre chauffeur au départ de la course.</p>
              <button
                onClick={() => setShowPin(!showPin)}
                className="mt-2 text-sm font-bold text-orange-500 underline"
              >
                {showPin ? 'Masquer le code' : 'Voir mon code PIN'}
              </button>
              {showPin && (
                <div className="mt-2 text-3xl font-bold text-orange-500 tracking-widest text-center">
                  ••••
                </div>
              )}
            </div>
          </div>
        )}

        {/* DÉTAILS COURSE */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-gray-900 mb-2">Détails</h2>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Départ</span>
            <span className="text-gray-900 font-medium text-right max-w-48">{ride.pickup_address}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Destination</span>
            <span className="text-gray-900 font-medium text-right max-w-48">{ride.dropoff_address}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Paiement</span>
            <span className="text-gray-900 font-medium capitalize">{ride.payment_method.replace('_', ' ')}</span>
          </div>
          {ride.estimated_price && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Prix estimé</span>
              <span className="text-orange-500 font-bold text-base">{formatXAF(ride.estimated_price)}</span>
            </div>
          )}
        </div>

        {/* ACTIONS */}
        {ride.status === 'completed' && !showRating && (
          <Button onClick={() => setShowRating(true)} className="w-full bg-orange-500 hover:bg-orange-600 rounded-xl h-12">
            Évaluer votre chauffeur
          </Button>
        )}

        {showRating && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Évaluer la course</h2>
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setRating(n)}>
                  <Star className={`w-8 h-8 ${n <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                </button>
              ))}
            </div>
            <textarea
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none outline-none focus:border-orange-400"
              rows={3}
              placeholder="Commentaire (optionnel)"
              value={ratingComment}
              onChange={e => setRatingComment(e.target.value)}
            />
            <Button onClick={handleRate} disabled={rating === 0} className="w-full mt-3 bg-orange-500 hover:bg-orange-600 rounded-xl h-12">
              Envoyer mon évaluation
            </Button>
          </div>
        )}

        {['pending', 'accepted'].includes(ride.status) && (
          <Button
            onClick={handleCancel}
            disabled={cancelling}
            variant="outline"
            className="w-full border-red-200 text-red-500 hover:bg-red-50 rounded-xl h-12"
          >
            <X className="w-4 h-4 mr-2" />
            {cancelling ? 'Annulation...' : 'Annuler la course'}
          </Button>
        )}
      </div>
    </div>
  )
}
