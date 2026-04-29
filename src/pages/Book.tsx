import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Navigation, Clock,
  ArrowLeft, Users, Car, Bike, Tag, ChevronRight,
  UserPlus, Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useRide } from '@/hooks/useRide'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import {
  VehicleType, PaymentMethod, Pricing,
  CAMEROON_LANDMARKS, formatXAF
} from '@/integrations/supabase/types'

// ─── Types de véhicules ──────────────────────────────────────
const VEHICLES: {
  type: VehicleType
  label: string
  desc: string
  detail: string
  icon: typeof Car
  minPrice: number
}[] = [
  {
    type: 'depot',
    label: 'Dépôt',
    desc: 'Seul dans le véhicule',
    detail: 'Trajet direct, courte distance. Même prix qu\'un taxi.',
    icon: Car,
    minPrice: 2500,
  },
  {
    type: 'standard',
    label: 'Course',
    desc: 'Course privée normale',
    detail: 'Berline confortable. Prix aligné sur le taxi local.',
    icon: Car,
    minPrice: 3500,
  },
  {
    type: 'comfort',
    label: 'Confort',
    desc: 'Véhicule premium',
    detail: 'SUV ou berline haut de gamme. Pour vos sorties importantes.',
    icon: Car,
    minPrice: 4500,
  },
  {
    type: 'van',
    label: 'Van',
    desc: 'Grand groupe',
    detail: 'Minibus jusqu\'à 8 personnes. Idéal pour familles et groupes.',
    icon: Users,
    minPrice: 6000,
  },
  {
    type: 'moto',
    label: 'Moto',
    desc: 'Moto-taxi rapide',
    detail: 'Évitez les embouteillages. Idéal pour petits trajets urgents.',
    icon: Bike,
    minPrice: 700,
  },
]

const PAYMENT_METHODS: { method: PaymentMethod; label: string; color: string }[] = [
  { method: 'mtn_momo',     label: 'MTN MoMo',    color: 'bg-yellow-400 text-black' },
  { method: 'orange_money', label: 'Orange Money', color: 'bg-orange-500 text-white' },
  { method: 'wallet',       label: 'Portefeuille', color: 'bg-green-600 text-white' },
]

const ALL_LANDMARKS = [
  ...CAMEROON_LANDMARKS['Yaoundé'].map(l => ({ ...l, city: 'Yaoundé' })),
  ...CAMEROON_LANDMARKS['Douala'].map(l => ({ ...l, city: 'Douala' })),
]

// ─── Composant principal ──────────────────────────────────────
export default function Book() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { } = useAuth()
  const { createRide } = useRide()

  // Étapes : address → vehicle → confirm
  const [step, setStep] = useState<'address' | 'vehicle' | 'confirm'>('address')

  // Adresses
  const [pickup, setPickup] = useState('')
  const [dropoff, setDropoff] = useState('')
  const [pickupSuggestions, setPickupSuggestions]   = useState<typeof ALL_LANDMARKS>([])
  const [dropoffSuggestions, setDropoffSuggestions] = useState<typeof ALL_LANDMARKS>([])
  const [pickupCoords,  setPickupCoords]  = useState<{ lat: number; lng: number; city: string } | null>(null)
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null)

  // Options course
  const [vehicleType,    setVehicleType]    = useState<VehicleType>('standard')
  const [paymentMethod,  setPaymentMethod]  = useState<PaymentMethod>('mtn_momo')
  const [scheduledAt,    setScheduledAt]    = useState('')
  const [promoCode,      setPromoCode]      = useState('')

  // Course partagée entre amis
  const [isShared,    setIsShared]    = useState(false)
  const [splitCount,  setSplitCount]  = useState(2)

  // Tarifs et prix
  const [pricing,        setPricing]        = useState<Pricing[]>([])
  const [currentSeason,  setCurrentSeason]  = useState<string>('basse')
  const [priceResult,    setPriceResult]    = useState<{
    total_price: number
    price_per_person: number
    commission: number
    driver_gets: number
    is_peak_hour: boolean
  } | null>(null)

  const [loading, setLoading] = useState(false)

  // Charger tarifs et saison
  useEffect(() => {
    supabase.from('pricing').select('*').eq('is_active', true)
      .then(({ data }) => { if (data) setPricing(data) })
    supabase.rpc('get_current_season')
      .then(({ data }) => { if (data) setCurrentSeason(data) })
  }, [])

  // Calculer prix dès que les paramètres changent
  useEffect(() => {
    if (!pickupCoords || !dropoffCoords) return
    const city = pickupCoords.city ?? 'Yaoundé'
    // Estimation : 8 km, 20 min (sera remplacé par calcul GPS réel)
    const distKm = 8
    const durMin = 20
    supabase.rpc('calculate_ride_price', {
      p_vehicle_type: vehicleType,
      p_city: city,
      p_distance_km: distKm,
      p_duration_min: durMin,
      p_is_shared: isShared,
      p_split_count: isShared ? splitCount : 1,
    }).then(({ data }) => {
      if (data && !data.error) setPriceResult(data)
    })
  }, [vehicleType, pickupCoords, dropoffCoords, isShared, splitCount])

  const filterLandmarks = (q: string) =>
    ALL_LANDMARKS.filter(l => l.name.toLowerCase().includes(q.toLowerCase())).slice(0, 5)

  const handleBook = async () => {
    if (!pickupCoords || !dropoffCoords || !priceResult) return
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
      estimated_price: priceResult.total_price,
      scheduled_at: scheduledAt || undefined,
    })
    setLoading(false)
    if (error) {
      toast({ title: 'Erreur', description: String(error), variant: 'destructive' })
    } else if (data) {
      toast({ title: '🚗 Course créée !', description: 'Recherche d\'un chauffeur en cours...' })
      navigate(`/ride/${data.id}`)
    }
  }

  const SEASON_BADGE: Record<string, string> = {
    basse:   '🟢 Tarif normal',
    moyenne: '🟡 Période chargée +15%',
    haute:   '🔴 Haute saison +30%',
  }

  const selectedVehicle = VEHICLES.find(v => v.type === vehicleType)!

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => step === 'address' ? navigate('/') : setStep(step === 'confirm' ? 'vehicle' : 'address')}
            className="text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold text-gray-900 text-sm">
              {step === 'address' ? 'Où allez-vous ?' :
               step === 'vehicle' ? 'Type de course' : 'Confirmer'}
            </h1>
            <p className="text-xs text-gray-400">{SEASON_BADGE[currentSeason]}</p>
          </div>
        </div>
        {/* Barre de progression */}
        <div className="flex h-1">
          <div className={`flex-1 transition-all ${step !== 'address' ? 'bg-orange-500' : 'bg-gray-200'}`} />
          <div className={`flex-1 transition-all ${step === 'confirm' ? 'bg-orange-500' : 'bg-gray-200'}`} />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ════════════════════════════════════
            ÉTAPE 1 — ADRESSES
        ════════════════════════════════════ */}
        {step === 'address' && (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">

              {/* DÉPART */}
              <div className="relative">
                <div className={`flex items-center gap-3 border-2 rounded-xl px-4 h-12 transition-colors ${
                  pickupCoords ? 'border-orange-400' : 'border-gray-200 focus-within:border-orange-300'
                }`}>
                  <div className="w-3 h-3 rounded-full bg-orange-500 shrink-0" />
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
                  {pickupCoords && <span className="text-green-500 text-sm">✓</span>}
                </div>
                {pickupSuggestions.length > 0 && (
                  <div className="absolute top-14 left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-xl z-30 overflow-hidden">
                    {pickupSuggestions.map(l => (
                      <button key={l.name} onClick={() => {
                        setPickup(l.name)
                        setPickupCoords({ lat: l.lat, lng: l.lng, city: l.city })
                        setPickupSuggestions([])
                      }} className="w-full text-left px-4 py-3 hover:bg-orange-50 text-sm text-gray-700 flex items-center gap-3 border-b border-gray-50 last:border-0">
                        <MapPin className="w-4 h-4 text-orange-400 shrink-0" />
                        <span className="flex-1">{l.name}</span>
                        <span className="text-xs text-gray-400">{l.city}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* LIGNE DE CONNEXION */}
              <div className="ml-5 w-0.5 h-4 bg-gray-200" />

              {/* DESTINATION */}
              <div className="relative">
                <div className={`flex items-center gap-3 border-2 rounded-xl px-4 h-12 transition-colors ${
                  dropoffCoords ? 'border-green-400' : 'border-gray-200 focus-within:border-green-300'
                }`}>
                  <Navigation className="w-4 h-4 text-green-500 shrink-0" />
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
                  {dropoffCoords && <span className="text-green-500 text-sm">✓</span>}
                </div>
                {dropoffSuggestions.length > 0 && (
                  <div className="absolute top-14 left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-xl z-30 overflow-hidden">
                    {dropoffSuggestions.map(l => (
                      <button key={l.name} onClick={() => {
                        setDropoff(l.name)
                        setDropoffCoords({ lat: l.lat, lng: l.lng })
                        setDropoffSuggestions([])
                      }} className="w-full text-left px-4 py-3 hover:bg-green-50 text-sm text-gray-700 flex items-center gap-3 border-b border-gray-50 last:border-0">
                        <Navigation className="w-4 h-4 text-green-400 shrink-0" />
                        <span className="flex-1">{l.name}</span>
                        <span className="text-xs text-gray-400">{l.city}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* PLANIFIER */}
              <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 h-11 focus-within:border-orange-300 transition-colors">
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

            {/* PARTAGE ENTRE AMIS */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <button
                onClick={() => setIsShared(!isShared)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isShared ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    <UserPlus className={`w-5 h-5 ${isShared ? 'text-green-600' : 'text-gray-400'}`} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-900">Course partagée entre amis</p>
                    <p className="text-xs text-gray-500">Divisez le prix entre plusieurs personnes</p>
                  </div>
                </div>
                <div className={`w-11 h-6 rounded-full transition-colors relative ${isShared ? 'bg-green-500' : 'bg-gray-200'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${isShared ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </button>

              {isShared && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-2">Nombre de personnes (vous inclus)</p>
                  <div className="flex gap-2">
                    {[2, 3, 4, 5, 6].map(n => (
                      <button
                        key={n}
                        onClick={() => setSplitCount(n)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                          splitCount === n
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-100 text-gray-600 hover:border-gray-200'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex items-start gap-2 bg-blue-50 rounded-xl p-3">
                    <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-600">
                      Le chauffeur reçoit le <strong>plein tarif</strong>. Vous partagez uniquement le paiement entre amis.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={() => setStep('vehicle')}
              disabled={!pickupCoords || !dropoffCoords}
              className="w-full h-12 bg-orange-500 hover:bg-orange-600 rounded-xl font-semibold text-base"
            >
              Choisir le type de course <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </>
        )}

        {/* ════════════════════════════════════
            ÉTAPE 2 — TYPE DE VÉHICULE
        ════════════════════════════════════ */}
        {step === 'vehicle' && (
          <>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {VEHICLES.map((v, i) => {
                const selected = vehicleType === v.type
                const city = pickupCoords?.city ?? 'Yaoundé'
                const p = pricing.find(p => p.vehicle_type === v.type && p.city === city)
                return (
                  <button
                    key={v.type}
                    onClick={() => setVehicleType(v.type)}
                    className={`w-full flex items-center gap-4 px-5 py-4 transition-all ${
                      selected ? 'bg-orange-50' : 'hover:bg-gray-50'
                    } ${i > 0 ? 'border-t border-gray-50' : ''}`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      selected ? 'bg-orange-500' : 'bg-gray-100'
                    }`}>
                      <v.icon className={`w-6 h-6 ${selected ? 'text-white' : 'text-gray-500'}`} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{v.label}</span>
                        {v.type === 'depot' && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                            Prix taxi
                          </span>
                        )}
                        {v.type === 'standard' && (
                          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                            Populaire
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{v.detail}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-gray-900">
                        dès {formatXAF(p?.min_fare ?? v.minPrice)}
                      </p>
                      {isShared && splitCount > 1 && (
                        <p className="text-xs text-green-600">
                          ÷{splitCount} = dès {formatXAF(Math.ceil((p?.min_fare ?? v.minPrice) / splitCount))} /pers
                        </p>
                      )}
                    </div>
                    {selected && (
                      <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* PRIX ESTIMÉ */}
            {priceResult && (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h3 className="text-sm text-gray-500 mb-3">Estimation pour votre trajet</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Prix total de la course</span>
                    <span className="font-bold text-gray-900">{formatXAF(priceResult.total_price)}</span>
                  </div>
                  {isShared && splitCount > 1 && (
                    <div className="flex justify-between text-green-600">
                      <span>Votre part ({splitCount} personnes)</span>
                      <span className="font-bold">{formatXAF(priceResult.price_per_person)}</span>
                    </div>
                  )}
                  {priceResult.is_peak_hour && (
                    <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-2">
                      <Info className="w-3 h-3" />
                      Heure de pointe — majoration appliquée
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MODE DE PAIEMENT */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Paiement</h3>
              <div className="flex gap-2">
                {PAYMENT_METHODS.map(pm => (
                  <button
                    key={pm.method}
                    onClick={() => setPaymentMethod(pm.method)}
                    className={`flex-1 py-3 rounded-xl border-2 text-xs font-bold transition-all ${
                      paymentMethod === pm.method ? 'border-orange-400 ' + pm.color : 'border-gray-100 bg-gray-50 text-gray-600'
                    }`}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>

              {/* CODE PROMO */}
              <div className="mt-3 flex items-center gap-2 border border-gray-200 rounded-xl px-4 h-11 focus-within:border-orange-400 transition-colors">
                <Tag className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  className="flex-1 outline-none text-gray-900 placeholder-gray-400 text-sm bg-transparent uppercase"
                  placeholder="Code promo (optionnel)"
                  value={promoCode}
                  onChange={e => setPromoCode(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <Button
              onClick={() => setStep('confirm')}
              className="w-full h-12 bg-orange-500 hover:bg-orange-600 rounded-xl font-semibold text-base"
            >
              Voir le récapitulatif <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </>
        )}

        {/* ════════════════════════════════════
            ÉTAPE 3 — CONFIRMATION
        ════════════════════════════════════ */}
        {step === 'confirm' && priceResult && (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
              <h2 className="font-semibold text-gray-900">Récapitulatif</h2>

              {/* TRAJET */}
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-orange-500 shrink-0 mt-1" />
                  <div>
                    <p className="text-xs text-gray-400">Départ</p>
                    <p className="text-sm font-medium text-gray-900">{pickup}</p>
                  </div>
                </div>
                <div className="ml-1.5 w-0.5 h-4 bg-gray-200" />
                <div className="flex items-start gap-3">
                  <Navigation className="w-3 h-3 text-green-500 shrink-0 mt-1" />
                  <div>
                    <p className="text-xs text-gray-400">Destination</p>
                    <p className="text-sm font-medium text-gray-900">{dropoff}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Type de course</span>
                  <span className="font-medium text-gray-900">{selectedVehicle.label}</span>
                </div>
                {isShared && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Personnes</span>
                    <span className="font-medium text-gray-900">{splitCount} amis</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Paiement</span>
                  <span className="font-medium text-gray-900">
                    {PAYMENT_METHODS.find(p => p.method === paymentMethod)?.label}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Saison</span>
                  <span className="font-medium text-gray-900">{SEASON_BADGE[currentSeason]}</span>
                </div>
              </div>

              {/* PRIX FINAL */}
              <div className="border-t border-gray-100 pt-4">
                {isShared && splitCount > 1 ? (
                  <>
                    <div className="flex justify-between text-sm text-gray-500 mb-1">
                      <span>Prix total course</span>
                      <span>{formatXAF(priceResult.total_price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-900">Votre part ({splitCount} pers.)</span>
                      <span className="text-2xl font-bold text-orange-500">
                        {formatXAF(priceResult.price_per_person)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-900">Prix estimé</span>
                    <span className="text-2xl font-bold text-orange-500">
                      {formatXAF(priceResult.total_price)}
                    </span>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Prix basé sur le tarif taxi local. Le montant final dépend de la distance réelle.
                </p>
              </div>
            </div>

            <Button
              onClick={handleBook}
              disabled={loading}
              className="w-full h-14 bg-orange-500 hover:bg-orange-600 rounded-xl font-bold text-base"
            >
              {loading ? '🔍 Recherche d\'un chauffeur...' : '✅ Confirmer la course'}
            </Button>

            <p className="text-xs text-center text-gray-400">
              Le chauffeur reçoit toujours le plein tarif — Mimip ne réduit pas la rémunération du chauffeur.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
