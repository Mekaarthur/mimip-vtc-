import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Navigation, Car, Bike, Users, Clock, CreditCard, Smartphone, Wallet, Tag, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useRide } from '@/hooks/useRide'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { VehicleType, PaymentMethod, Pricing, CAMEROON_LANDMARKS, formatXAF, estimatePrice } from '@/integrations/supabase/types'

const VEHICLES: { type: VehicleType; icon: typeof Car; label: string; seats: number; desc: string }[] = [
  { type: 'standard', icon: Car, label: 'Standard', seats: 4, desc: 'Berline confortable' },
  { type: 'comfort', icon: Car, label: 'Confort', seats: 4, desc: 'Véhicule premium' },
  { type: 'van', icon: Users, label: 'Van', seats: 6, desc: 'Idéal pour groupes' },
  { type: 'moto', icon: Bike, label: 'Moto', seats: 1, desc: 'Rapide en ville' },
]

const PAYMENT_METHODS: { method: PaymentMethod; label: string; icon: typeof CreditCard; color: string }[] = [
  { method: 'cash', label: 'Cash', icon: CreditCard, color: 'bg-gray-100 text-gray-700' },
  { method: 'mtn_momo', label: 'MTN MoMo', icon: Smartphone, color: 'bg-yellow-100 text-yellow-700' },
  { method: 'orange_money', label: 'Orange Money', icon: Smartphone, color: 'bg-orange-100 text-orange-700' },
  { method: 'wallet', label: 'Portefeuille', icon: Wallet, color: 'bg-green-100 text-green-700' },
]

const CITY_LANDMARKS = [...CAMEROON_LANDMARKS['Yaoundé'], ...CAMEROON_LANDMARKS['Douala']]

export default function Book() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const { createRide } = useRide()

  const [pickup, setPickup] = useState('')
  const [dropoff, setDropoff] = useState('')
  const [pickupSuggestions, setPickupSuggestions] = useState<typeof CITY_LANDMARKS>([])
  const [dropoffSuggestions, setDropoffSuggestions] = useState<typeof CITY_LANDMARKS>([])
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [vehicleType, setVehicleType] = useState<VehicleType>('standard')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [promoCode, setPromoCode] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [pricing, setPricing] = useState<Pricing[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('pricing').select('*').eq('is_active', true).then(({ data }) => {
      if (data) setPricing(data)
    })
  }, [])

  const currentPricing = pricing.find(p => p.vehicle_type === vehicleType)

  const estimatedPrice = pickupCoords && dropoffCoords && currentPricing
    ? estimatePrice(currentPricing, 5, 15)
    : null

  const filterLandmarks = (query: string) =>
    CITY_LANDMARKS.filter(l => l.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5)

  const handlePickupChange = (v: string) => {
    setPickup(v)
    setPickupSuggestions(v.length > 1 ? filterLandmarks(v) : [])
  }

  const handleDropoffChange = (v: string) => {
    setDropoff(v)
    setDropoffSuggestions(v.length > 1 ? filterLandmarks(v) : [])
  }

  const selectPickup = (l: typeof CITY_LANDMARKS[0]) => {
    setPickup(l.name)
    setPickupCoords({ lat: l.lat, lng: l.lng })
    setPickupSuggestions([])
  }

  const selectDropoff = (l: typeof CITY_LANDMARKS[0]) => {
    setDropoff(l.name)
    setDropoffCoords({ lat: l.lat, lng: l.lng })
    setDropoffSuggestions([])
  }

  const handleBook = async () => {
    if (!pickup || !dropoff) {
      toast({ title: 'Champs manquants', description: 'Remplissez le départ et la destination', variant: 'destructive' })
      return
    }
    if (!pickupCoords || !dropoffCoords) {
      toast({ title: 'Adresse non reconnue', description: 'Sélectionnez une suggestion de la liste', variant: 'destructive' })
      return
    }
    setLoading(true)
    const { data, error } = await createRide({
      pickup_address: pickup,
      dropoff_address: dropoff,
      pickup_lat: pickupCoords.lat,
      pickup_lng: pickupCoords.lng,
      dropoff_lat: dropoffCoords.lat,
      dropoff_lng: dropoffCoords.lng,
      vehicle_type: vehicleType,
      payment_method: paymentMethod,
      estimated_price: estimatedPrice ?? 1000,
      scheduled_at: scheduledAt || undefined,
    })
    setLoading(false)
    if (error) {
      toast({ title: 'Erreur', description: String(error), variant: 'destructive' })
    } else if (data) {
      toast({ title: 'Course créée !', description: 'Recherche d\'un chauffeur en cours...' })
      navigate(`/ride/${data.id}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-gray-900">Réserver une course</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* ADRESSES */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Itinéraire</h2>

          {/* DÉPART */}
          <div className="relative">
            <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 h-12 focus-within:border-orange-400 transition-colors">
              <MapPin className="w-5 h-5 text-orange-500 shrink-0" />
              <input
                className="flex-1 outline-none text-gray-900 placeholder-gray-400 text-sm"
                placeholder="Point de départ"
                value={pickup}
                onChange={e => handlePickupChange(e.target.value)}
              />
            </div>
            {pickupSuggestions.length > 0 && (
              <div className="absolute top-14 left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg z-20">
                {pickupSuggestions.map(l => (
                  <button key={l.name} onClick={() => selectPickup(l)}
                    className="w-full text-left px-4 py-3 hover:bg-orange-50 text-sm text-gray-700 first:rounded-t-xl last:rounded-b-xl flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" /> {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* DESTINATION */}
          <div className="relative">
            <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 h-12 focus-within:border-green-400 transition-colors">
              <Navigation className="w-5 h-5 text-green-500 shrink-0" />
              <input
                className="flex-1 outline-none text-gray-900 placeholder-gray-400 text-sm"
                placeholder="Destination"
                value={dropoff}
                onChange={e => handleDropoffChange(e.target.value)}
              />
            </div>
            {dropoffSuggestions.length > 0 && (
              <div className="absolute top-14 left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg z-20">
                {dropoffSuggestions.map(l => (
                  <button key={l.name} onClick={() => selectDropoff(l)}
                    className="w-full text-left px-4 py-3 hover:bg-green-50 text-sm text-gray-700 first:rounded-t-xl last:rounded-b-xl flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-gray-400" /> {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PLANIFIER */}
          <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 h-12">
            <Clock className="w-5 h-5 text-gray-400 shrink-0" />
            <input
              type="datetime-local"
              className="flex-1 outline-none text-gray-700 text-sm"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>
        </div>

        {/* TYPE DE VÉHICULE */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Type de véhicule</h2>
          <div className="grid grid-cols-2 gap-3">
            {VEHICLES.map(v => {
              const p = pricing.find(p => p.vehicle_type === v.type)
              return (
                <button
                  key={v.type}
                  onClick={() => setVehicleType(v.type)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    vehicleType === v.type ? 'border-orange-400 bg-orange-50' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <v.icon className={`w-6 h-6 mb-2 ${vehicleType === v.type ? 'text-orange-500' : 'text-gray-400'}`} />
                  <div className="font-semibold text-gray-900 text-sm">{v.label}</div>
                  <div className="text-xs text-gray-500">{v.desc}</div>
                  {p && <div className="text-xs font-medium text-orange-500 mt-1">dès {formatXAF(p.min_fare)}</div>}
                </button>
              )
            })}
          </div>
        </div>

        {/* PAIEMENT */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Mode de paiement</h2>
          <div className="grid grid-cols-2 gap-3">
            {PAYMENT_METHODS.map(pm => (
              <button
                key={pm.method}
                onClick={() => setPaymentMethod(pm.method)}
                className={`p-3 rounded-xl border-2 flex items-center gap-2 transition-all ${
                  paymentMethod === pm.method ? 'border-orange-400 bg-orange-50' : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <span className={`text-xs px-2 py-1 rounded-lg font-medium ${pm.color}`}>{pm.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* CODE PROMO */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Code promo</h2>
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 h-12 focus-within:border-orange-400">
            <Tag className="w-5 h-5 text-gray-400 shrink-0" />
            <input
              className="flex-1 outline-none text-gray-900 placeholder-gray-400 text-sm uppercase"
              placeholder="Entrez votre code"
              value={promoCode}
              onChange={e => setPromoCode(e.target.value.toUpperCase())}
            />
          </div>
        </div>

        {/* RÉCAP PRIX + BOUTON */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          {estimatedPrice && (
            <div className="flex justify-between items-center mb-4 pb-4 border-b">
              <span className="text-gray-600">Prix estimé</span>
              <span className="text-2xl font-bold text-orange-500">{formatXAF(estimatedPrice)}</span>
            </div>
          )}
          <Button
            onClick={handleBook}
            disabled={loading || !pickup || !dropoff}
            className="w-full h-14 bg-orange-500 hover:bg-orange-600 rounded-xl text-base font-semibold"
          >
            {loading ? 'Recherche d\'un chauffeur...' : 'Confirmer la réservation →'}
          </Button>
          <p className="text-xs text-gray-400 text-center mt-3">
            Le prix final peut varier selon le trafic et la distance réelle.
          </p>
        </div>
      </div>
    </div>
  )
}
