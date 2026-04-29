export type UserRole = 'passenger' | 'driver' | 'admin'
export type DriverStatus = 'offline' | 'available' | 'busy'
export type RideStatus = 'pending' | 'accepted' | 'arriving' | 'ongoing' | 'completed' | 'cancelled'
export type PaymentMethod = 'cash' | 'mtn_momo' | 'orange_money' | 'wallet'
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded'
export type VehicleType = 'standard' | 'comfort' | 'van' | 'moto'
export type TransactionType = 'ride' | 'topup' | 'withdrawal' | 'commission' | 'refund' | 'split'
export type VerificationStatus = 'pending' | 'approved' | 'rejected'
export type MomoOperator = 'mtn_momo' | 'orange_money'

export interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  email: string | null
  avatar_url: string | null
  city: string
  preferred_language: 'fr' | 'en'
  push_token: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UserRoleRecord {
  id: string
  user_id: string
  role: UserRole
  created_at: string
}

export interface EmergencyContact {
  id: string
  user_id: string
  name: string
  phone: string
  relationship: string | null
  created_at: string
}

export interface Pricing {
  id: string
  vehicle_type: VehicleType
  city: string
  base_fare: number
  price_per_km: number
  price_per_min: number
  min_fare: number
  surge_multiplier: number
  is_active: boolean
  created_at: string
}

export interface Driver {
  id: string
  profile_id: string
  vehicle_type: VehicleType
  vehicle_brand: string | null
  vehicle_model: string | null
  vehicle_color: string | null
  plate_number: string | null
  vehicle_year: number | null
  status: DriverStatus
  current_lat: number | null
  current_lng: number | null
  current_city: string
  rating: number
  total_rides: number
  total_earnings: number
  is_verified: boolean
  verification_level: number
  commission_rate: number
  created_at: string
  updated_at: string
  profiles?: Profile
}

export interface DriverDocument {
  id: string
  driver_id: string
  type: 'cni' | 'permis' | 'assurance' | 'carte_grise' | 'visite_technique' | 'photo_vehicule'
  file_url: string
  status: VerificationStatus
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  expires_at: string | null
  created_at: string
}

export interface DriverVerification {
  id: string
  driver_id: string
  level: number
  status: VerificationStatus
  completed_at: string | null
  notes: string | null
  created_at: string
}

export interface Ride {
  id: string
  passenger_id: string
  driver_id: string | null
  vehicle_type: VehicleType
  pickup_address: string
  dropoff_address: string
  pickup_lat: number
  pickup_lng: number
  dropoff_lat: number
  dropoff_lng: number
  status: RideStatus
  estimated_price: number | null
  final_price: number | null
  distance_km: number | null
  duration_min: number | null
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  promo_code: string | null
  discount_amount: number
  notes: string | null
  scheduled_at: string | null
  accepted_at: string | null
  arrived_at: string | null
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  cancelled_by: string | null
  created_at: string
  profiles?: Profile
  drivers?: Driver & { profiles?: Profile }
}

export interface RideVerificationPin {
  id: string
  ride_id: string
  pin: string
  verified_at: string | null
  created_at: string
}

export interface RideShare {
  id: string
  ride_id: string
  token: string
  shared_by: string
  expires_at: string
  created_at: string
  rides?: Ride
}

export interface Rating {
  id: string
  ride_id: string
  score: number
  comment: string | null
  from_user_id: string
  to_user_id: string
  created_at: string
}

export interface Wallet {
  id: string
  user_id: string
  balance: number
  currency: string
  updated_at: string
}

export interface WalletTransaction {
  id: string
  wallet_id: string
  type: TransactionType
  amount: number
  balance_after: number
  description: string | null
  ride_id: string | null
  status: PaymentStatus
  created_at: string
}

export interface MobileMoneyTransaction {
  id: string
  user_id: string
  wallet_id: string | null
  operator: MomoOperator
  phone: string
  amount: number
  type: 'topup' | 'withdrawal'
  status: PaymentStatus
  operator_reference: string | null
  failure_reason: string | null
  initiated_at: string
  completed_at: string | null
  created_at: string
}

export interface SplitPayment {
  id: string
  ride_id: string
  total_amount: number
  initiator_id: string
  status: 'pending' | 'completed' | 'cancelled'
  created_at: string
  participants?: SplitPaymentParticipant[]
}

export interface SplitPaymentParticipant {
  id: string
  split_payment_id: string
  user_id: string
  amount: number
  status: PaymentStatus
  paid_at: string | null
  created_at: string
  profiles?: Profile
}

export interface FavoriteAddress {
  id: string
  user_id: string
  label: 'home' | 'work' | 'other'
  address: string
  lat: number
  lng: number
  created_at: string
}

export interface SosAlert {
  id: string
  ride_id: string
  triggered_by: string
  lat: number | null
  lng: number | null
  status: 'active' | 'resolved' | 'false_alarm'
  resolved_at: string | null
  notes: string | null
  created_at: string
}

// Landmarks Cameroun
export const CAMEROON_LANDMARKS = {
  Yaoundé: [
    { name: 'Aéroport de Nsimalen', lat: 3.7224, lng: 11.5533 },
    { name: 'Palais de l\'Unité', lat: 3.8667, lng: 11.5167 },
    { name: 'Marché Central', lat: 3.8667, lng: 11.5167 },
    { name: 'Université de Yaoundé I', lat: 3.8720, lng: 11.5123 },
    { name: 'Nlongkak', lat: 3.8750, lng: 11.5012 },
    { name: 'Bastos', lat: 3.8800, lng: 11.5200 },
    { name: 'Mvan', lat: 3.8300, lng: 11.5400 },
    { name: 'Biyem-Assi', lat: 3.8400, lng: 11.4900 },
    { name: 'Omnisports', lat: 3.8600, lng: 11.5000 },
    { name: 'Etoudi', lat: 3.9000, lng: 11.5300 },
  ],
  Douala: [
    { name: 'Aéroport de Douala', lat: 4.0061, lng: 9.7197 },
    { name: 'Akwa', lat: 4.0500, lng: 9.7000 },
    { name: 'Bonanjo', lat: 4.0400, lng: 9.7100 },
    { name: 'Bassa', lat: 4.0200, lng: 9.7500 },
    { name: 'Ndokoti', lat: 4.0600, lng: 9.7300 },
    { name: 'Bonabéri', lat: 4.0800, lng: 9.6500 },
  ],
} as const

// Formatage prix XAF
export const formatXAF = (amount: number): string => {
  return new Intl.NumberFormat('fr-CM', {
    style: 'currency',
    currency: 'XAF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Calcul estimation prix
export const estimatePrice = (
  pricing: Pricing,
  distanceKm: number,
  durationMin: number
): number => {
  const price = pricing.base_fare +
    (distanceKm * pricing.price_per_km) +
    (durationMin * pricing.price_per_min)
  return Math.max(price * pricing.surge_multiplier, pricing.min_fare)
}
