import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Navigation, Clock, Smartphone, Wallet,
  ArrowLeft, Users, Car, Bike, Tag, Info, ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useRide } from '@/hooks/useRide'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import {
  VehicleType, PaymentMethod, Pricing,
  CAMEROON_LANDMARKS, formatXAF, VEHICLE_DESCRIPTIONS
} from '@/integrations/supabase/types'

// ─── Groupes de véhicules ────────────────────────────────────
const VEHICLE_GROUPS = [
  {
    group: 'Partagé',
    desc: 'Vous partagez le taxi avec d\'autres passagers',
    color: 'bg-green-50 border-green-200',
    activeColor: 'border-green-500 bg-green-50',
    badge: 'bg-green-100 text-green-700',
    types: ['clando'] as VehicleType[],
  },
  {
    group: 'Dépôt',
    desc: 'Seul dans le véhicule, trajet direct',
    color: 'bg-blue-50 border-blue-200',
    activeColor: 'border-blue-500 bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
    types: ['depot'] as VehicleType[],
  },
  {
    group: 'Course privée',
    desc: 'Votre chauffeur rien que pour vous',
    color: 'bg-orange-50 border-orange-200',
    activeColor: 'border-orange-500 bg-orange-50',
    badge: 'bg-orange-100 text-orange-700',
    types: ['standard', 'comfort', 'van', 'moto'] as VehicleType[],
  },
]

const VEHICLE_ICONS: Record<VehicleType, typeof Car> = {
  clando: Users,
  depot: Car,
  standard: Car,
  comfort: Car,
  van: Users,
  moto: Bike,
}

const PAYMENT_METHODS: { method: PaymentMethod; label: string; color: string; icon: typeof Smartphone }[] = [
  { method: 'mtn_momo',     label: 'MTN MoMo',      color: 'bg-yellow-400 text-black', icon: Smartphone },
  { method: 'orange_money', label: 'Orange Money',   color: 'bg-orange-500 text-white', icon: Smartphone },
  { method: 'wallet',       label: 'Portefeuille',   color: 'bg-green-500 text-white',  icon: Wallet },
]

const CITY_LANDMARKS = [
  ...CAMEROON_LANDMARKS['Yaoundé'].map(l => ({ ...l, city: 'Yaoundé' })),
  ...CAMEROON_LANDMARKS['Douala'].map(l => ({ ...l, city: 'Douala' })),
]

// ─── Composant ────────────────────────────────────────────────
export default function Book() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { } = useAuth()
  const { createRide } = useRide()

  const [pickup, setPickup] = useState('')
  const [dropoff, setDropoff] = useState('')
  const [pickupSuggestions, setPickupSuggestions] = useState<typeof CITY_LANDMARKS>([])
  const [dropoffSuggestions, setDropoffSuggestions] = useState<typeof CITY_LANDMARKS>([])
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number; city: string } | null>(null)
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [vehicleType, setVehicleType] = useState<VehicleType>('standard')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mtn_momo')
  const [promoCode, setPromoCode] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [passengerCount, setPassengerCount] = useState(1)
  const [pricing, setPricing] = useState<Pricing[]>([])
  const [currentSeason, setCurrentSeason] = useState<string>('basse')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'address' | 'vehicle' | 'payment'>('address')

  useEffect(() => {
    supabase.from('pricing').select('*').eq('is_active', true)
      .then(({ data }) => { if (data) setPricing(data) })

    supabase.rpc('get_current_season')
      .then(({ data }) => { if (data) setCurrentSeason(data) })
  }, [])

  // Prix de la course sélectionnée
  const getPrice = (type: VehicleType) => {
    const city = pickupCoords?.city ?? 'Yaoundé'
    const p = pricing.find(p => p.vehicle_type === type && p.city === city && p.season === currentSeason)
      ?? pricing.find(p => p.vehicle_type === type && p.city === city)
    if (!p) return null
    if (type === 'clando') return p.min_fare * passengerCount
    // Estimation sur 5km, 15min
    return Math.max(p.base_fare + 5 * p.price_per_km + 15 * p.price_per_min, p.min_fare)
  }

  const filterLandmarks = (q: string) =>
    CITY_LANDMARKS.filter(l => l.name.toLowerCase().includes(q.toLowerCase())).slice(0, 5)

  const handleBook = async () => {
    if (!pickupCoords || !dropoffCoords) {
      toast({ title: 'Adresse manquante', description: 'Sélectionnez un point de départ et une destination.', variant: 'destructive' })
      return
    }
    setLoading(true)
    const price = getPrice(vehicleType) ?? 0
    const { data, error } = await createRide({
      pickup_address: pickup,
      dropoff_address: dropoff,
      pickup_lat: pickupCoords.lat,
      pickup_lng: pickupCoords.lng,
      dropoff_lat: dropoffCoords.lat,
      dropoff_lng: dropoffCoords.lng,
      vehicle_type: vehicleType,
      payment_method: paymentMethod,
      estimated_price: vehicleType === 'clando' ? price : price,
      scheduled_at: scheduledAt || undefined,
    })
    setLoading(false)
    if (error) {
      toast({ title: 'Erreur', description: String(error), variant: 'destructive' })
    } else if (data) {
      toast({ title: '🚗 Course créée !', description: 'Recherche d\'un chauffeur...' })
      navigate(`/ride/${data.id}`)
    }
  }

  const SEASON_LABEL: Record<string, { label: string; color: string }> = {
    basse:   { label: 'Tarif normal',          color: 'bg-gray-100 text-gray-600' },
    moyenne: { label: 'Période chargée +15%',  color: 'bg-blue-100 text-blue-600' },
    haute:   { label: 'Haute saison +30%',     color: 'bg-red-100 text-red-600' },
  }
  const seasonInfo = SEASON_LABEL[currentSeason]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-gray-900">Réserver une course</h1>
          {seasonInfo && (
            <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${seasonInfo.color}`}>
              {seasonInfo.label}
            </span>
          )}
        </div>

        {/* ÉTAPES */}
        <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-1">
          {(['address', 'vehicle', 'payment'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={`h-1 flex-1 rounded-full transition-all ${
                step === s || (i === 0 && step !== 'address') || (i === 1 && step === 'payment')
                  ? 'bg-orange-500' : 'bg-gray-200'
              }`} />
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ─── ÉTAPE 1 : ADRESSES ─── */}
        {step === 'address' && (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
              <h2 className="font-semibold text-gray-900 mb-1">Où allez-vous ?</h2>

              {/* DÉPART */}
              <div className="relative">
                <div className={`flex items-center gap-3 border-2 rounded-xl px-4 h-12 transition-colors ${
                  pickupCoords ? 'border-orange-400 bg-orange-50' : 'border-gray-200 focus-within:border-orange-300'
                }`}>
                  <MapPin className="w-5 h-5 text-orange-500 shrink-0" />
                  <input
                    className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-400 text-sm"
                    placeholder="Point de départ"
                    value={pickup}
                    onChange={e => {
                      setPickup(e.target.value)
                      setPickupCoords(null)
                      setPickupSuggestions(e.target.value.length > 1 ? filterLandmarks(e.target.value) : [])
                    }}
                  />
                  {pickupCoords && <span className="text-xs text-orange-500">✓</span>}
                </div>
                {pickupSuggestions.length > 0 && (
                  <div className="absolute top-14 left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg z-30">
                    {pickupSuggestions.map(l => (
                      <button key={l.name} onClick={() => {
                        setPickup(l.name)
                        setPickupCoords({ lat: l.lat, lng: l.lng, city: l.city })
                        setPickupSuggestions([])
                      }} className="w-full text-left px-4 py-3 hover:bg-orange-50 text-sm text-gray-700 flex items-center gap-2 first:rounded-t-xl last:rounded-b-xl">
                        <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                        <span>{l.name}</span>
                        <span className="ml-auto text-xs text-gray-400">{l.city}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* DESTINATION */}
              <div className="relative">
                <div className={`flex items-center gap-3 border-2 rounded-xl px-4 h-12 transition-colors ${
                  dropoffCoords ? 'border-green-400 bg-green-50' : 'border-gray-200 focus-within:border-green-300'
                }`}>
                  <Navigation className="w-5 h-5 text-green-500 shrink-0" />
                  <input
                    className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-400 text-sm"
                    placeholder="Destination"
                    value={dropoff}
                    onChange={e => {
                      setDropoff(e.target.value)
                      setDropoffCoords(null)
                      setDropoffSuggestions(e.target.value.length > 1 ? filterLandmarks(e.target.value) : [])
                    }}
                  />
                  {dropoffCoords && <span className="text-xs text-green-500">✓</span>}
                </div>
                {dropoffSuggestions.length > 0 && (
                  <div className="absolute top-14 left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg z-30">
                    {dropoffSuggestions.map(l => (
                      <button key={l.name} onClick={() => {
                        setDropoff(l.name)
                        setDropoffCoords({ lat: l.lat, lng: l.lng })
                        setDropoffSuggestions([])
                      }} className="w-full text-left px-4 py-3 hover:bg-green-50 text-sm text-gray-700 flex items-center gap-2 first:rounded-t-xl last:rounded-b-xl">
                        <Navigation className="w-3 h-3 text-gray-400 shrink-0" />
                        <span>{l.name}</span>
                        <span className="ml-auto text-xs text-gray-400">{l.city}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* PLANIFIER */}
              <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 h-12">
                <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="datetime-local"
                  className="flex-1 outline-none text-gray-600 text-sm bg-transparent"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
            </div>

            <Button
              onClick={() => setStep('vehicle')}
              disabled={!pickupCoords || !dropoffCoords}
              className="w-full h-12 bg-orange-500 hover:bg-orange-600 rounded-xl font-semibold"
            >
              Choisir le type de course →
            </Button>
          </>
        )}

        {/* ─── ÉTAPE 2 : VÉHICULE ─── */}
        {step === 'vehicle' && (
          <>
            <div className="space-y-4">
              {VEHICLE_GROUPS.map(group => (
                <div key={group.group} className="bg-white rounded-2xl shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{group.group}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{group.desc}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${group.badge}`}>
                      {group.group === 'Partagé' ? '300 XAF/pers' :
                       group.group === 'Dépôt' ? 'dès 2 500 XAF' : 'dès 3 500 XAF'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {group.types.map(type => {
                      const info = VEHICLE_DESCRIPTIONS[type]
                      const price = getPrice(type)
                      const Icon = VEHICLE_ICONS[type]
                      const selected = vehicleType === type
                      return (
                        <button
                          key={type}
                          onClick={() => {
                            setVehicleType(type)
                            if (type === 'clando') setPassengerCount(1)
                          }}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            selected
                              ? group.activeColor + ' border-opacity-100'
                              : 'border-gray-100 hover:border-gray-200'
                          }`}
                        >
                          <Icon className={`w-5 h-5 mb-2 ${selected ? 'text-orange-500' : 'text-gray-400'}`} />
                          <div className="text-sm font-semibold text-gray-900">{info.label}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{info.desc}</div>
                          {price !== null && (
                            <div className={`text-sm font-bold mt-2 ${selected ? 'text-orange-500' : 'text-gray-600'}`}>
                              {type === 'clando' ? `${formatXAF(price)}/pers` : `~${formatXAF(price)}`}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Nombre de passagers pour clando */}
                  {group.group === 'Partagé' && vehicleType === 'clando' && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-2">Nombre de places</p>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4].map(n => (
                          <button
                            key={n}
                            onClick={() => setPassengerCount(n)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                              passengerCount === n
                                ? 'border-green-500 bg-green-50 text-green-700'
                                : 'border-gray-100 text-gray-600'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Total : <strong className="text-green-600">{formatXAF(300 * passengerCount)}</strong>
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* INFO SAISON */}
            {currentSeason !== 'basse' && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  {currentSeason === 'haute'
                    ? '🔴 Haute saison : les tarifs sont majorés de +30% (Noël, Pâques, rentrée...)'
                    : '🔵 Période chargée : les tarifs sont majorés de +15%'}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={() => setStep('address')} variant="outline" className="flex-1 rounded-xl h-12">
                ← Retour
              </Button>
              <Button onClick={() => setStep('payment')} className="flex-1 bg-orange-500 hover:bg-orange-600 rounded-xl h-12 font-semibold">
                Paiement →
              </Button>
            </div>
          </>
        )}

        {/* ─── ÉTAPE 3 : PAIEMENT ─── */}
        {step === 'payment' && (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Mode de paiement</h2>
              <div className="space-y-2">
                {PAYMENT_METHODS.map(pm => (
                  <button
                    key={pm.method}
                    onClick={() => setPaymentMethod(pm.method)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                      paymentMethod === pm.method ? 'border-orange-400' : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <span className={`text-xs px-3 py-1.5 rounded-lg font-bold ${pm.color}`}>{pm.label}</span>
                    <span className="flex-1 text-left text-sm text-gray-600">
                      {pm.method === 'mtn_momo' && 'Paiement MTN Mobile Money'}
                      {pm.method === 'orange_money' && 'Paiement Orange Money'}
                      {pm.method === 'wallet' && 'Débit depuis votre portefeuille Mimip'}
                    </span>
                    {paymentMethod === pm.method && <span className="text-orange-500 font-bold">✓</span>}
                  </button>
                ))}
              </div>

              {/* CODE PROMO */}
              <div className="mt-4 flex items-center gap-2 border border-gray-200 rounded-xl px-4 h-11 focus-within:border-orange-400">
                <Tag className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  className="flex-1 outline-none text-gray-900 placeholder-gray-400 text-sm uppercase bg-transparent"
                  placeholder="Code promo (optionnel)"
                  value={promoCode}
                  onChange={e => setPromoCode(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            {/* RÉCAPITULATIF */}
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
              <h2 className="font-semibold text-gray-900">Récapitulatif</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Départ</span>
                  <span className="font-medium text-gray-900 text-right max-w-40 truncate">{pickup}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Destination</span>
                  <span className="font-medium text-gray-900 text-right max-w-40 truncate">{dropoff}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Type</span>
                  <span className="font-medium text-gray-900">{VEHICLE_DESCRIPTIONS[vehicleType].label}</span>
                </div>
                {vehicleType === 'clando' && (
                  <div className="flex justify-between text-gray-600">
                    <span>Passagers</span>
                    <span className="font-medium text-gray-900">{passengerCount}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>Paiement</span>
                  <span className="font-medium text-gray-900">
                    {PAYMENT_METHODS.find(p => p.method === paymentMethod)?.label}
                  </span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="text-gray-600">Prix estimé</span>
                  <span className="text-xl font-bold text-orange-500">
                    {getPrice(vehicleType) !== null ? formatXAF(getPrice(vehicleType)!) : '—'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-400">Prix indicatif — le montant final dépend de la distance réelle.</p>
            </div>

            <div className="flex gap-3">
              <Button onClick={() => setStep('vehicle')} variant="outline" className="flex-1 rounded-xl h-12">
                ← Retour
              </Button>
              <Button
                onClick={handleBook}
                disabled={loading}
                className="flex-1 h-12 bg-orange-500 hover:bg-orange-600 rounded-xl font-semibold"
              >
                {loading ? 'Recherche...' : 'Confirmer →'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
