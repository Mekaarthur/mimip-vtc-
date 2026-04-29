-- ============================================================
-- MIMIP VTC CAMEROUN — Schéma Supabase complet
-- ============================================================

-- Extensions
create extension if not exists postgis;
create extension if not exists "uuid-ossp";

-- ============================================================
-- TYPES ENUM
-- ============================================================
create type user_role as enum ('passenger', 'driver', 'admin');
create type driver_status as enum ('offline', 'available', 'busy');
create type ride_status as enum ('pending', 'accepted', 'arriving', 'ongoing', 'completed', 'cancelled');
create type payment_method as enum ('cash', 'mtn_momo', 'orange_money', 'wallet');
create type payment_status as enum ('pending', 'success', 'failed', 'refunded');
create type vehicle_type as enum ('standard', 'comfort', 'van', 'moto');
create type transaction_type as enum ('ride', 'topup', 'withdrawal', 'commission', 'refund', 'split');
create type verification_status as enum ('pending', 'approved', 'rejected');

-- ============================================================
-- PROFILES
-- ============================================================
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  phone text unique,
  email text,
  avatar_url text,
  city text default 'Yaoundé',
  preferred_language text default 'fr' check (preferred_language in ('fr', 'en')),
  push_token text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- USER ROLES
-- ============================================================
create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade not null,
  role user_role not null default 'passenger',
  created_at timestamptz default now(),
  unique(user_id, role)
);

-- Fonction helper pour vérifier le rôle
create or replace function has_role(user_id uuid, check_role user_role)
returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from user_roles
    where user_roles.user_id = $1
    and user_roles.role = $2
  );
$$;

-- ============================================================
-- CONTACTS D'URGENCE
-- ============================================================
create table emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade not null,
  name text not null,
  phone text not null,
  relationship text,
  created_at timestamptz default now()
);

-- ============================================================
-- TARIFS
-- ============================================================
create table pricing (
  id uuid primary key default gen_random_uuid(),
  vehicle_type vehicle_type not null,
  city text not null default 'Yaoundé',
  base_fare integer not null default 500,       -- XAF
  price_per_km integer not null default 300,    -- XAF
  price_per_min integer not null default 50,    -- XAF
  min_fare integer not null default 1000,       -- XAF
  surge_multiplier numeric(3,1) default 1.0,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(vehicle_type, city)
);

-- Données initiales de tarifs
insert into pricing (vehicle_type, city, base_fare, price_per_km, price_per_min, min_fare) values
  ('standard', 'Yaoundé', 500, 250, 40, 1000),
  ('comfort',  'Yaoundé', 700, 350, 60, 1500),
  ('van',      'Yaoundé', 800, 400, 70, 2000),
  ('moto',     'Yaoundé', 300, 150, 30, 600),
  ('standard', 'Douala',  500, 250, 40, 1000),
  ('comfort',  'Douala',  700, 350, 60, 1500),
  ('van',      'Douala',  800, 400, 70, 2000),
  ('moto',     'Douala',  300, 150, 30, 600);

-- ============================================================
-- CHAUFFEURS
-- ============================================================
create table drivers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles on delete cascade unique not null,
  vehicle_type vehicle_type not null default 'standard',
  vehicle_brand text,
  vehicle_model text,
  vehicle_color text,
  plate_number text unique,
  vehicle_year integer,
  status driver_status default 'offline',
  current_lat double precision,
  current_lng double precision,
  current_city text default 'Yaoundé',
  rating numeric(3,2) default 5.0,
  total_rides integer default 0,
  total_earnings integer default 0,  -- XAF
  is_verified boolean default false,
  verification_level integer default 0 check (verification_level between 0 and 5),
  commission_rate numeric(4,2) default 15.0,  -- %
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- DOCUMENTS CHAUFFEUR
-- ============================================================
create table driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references drivers on delete cascade not null,
  type text not null check (type in ('cni', 'permis', 'assurance', 'carte_grise', 'visite_technique', 'photo_vehicule')),
  file_url text not null,
  status verification_status default 'pending',
  reviewed_by uuid references profiles,
  reviewed_at timestamptz,
  rejection_reason text,
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- VÉRIFICATIONS CHAUFFEUR
-- ============================================================
create table driver_verifications (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references drivers on delete cascade not null,
  level integer not null check (level between 1 and 5),
  status verification_status default 'pending',
  completed_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- INCIDENTS CHAUFFEUR
-- ============================================================
create table driver_incidents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references drivers not null,
  ride_id uuid,
  type text not null check (type in ('accident', 'plainte', 'fraude', 'conduite_dangereuse', 'autre')),
  description text,
  severity text check (severity in ('low', 'medium', 'high', 'critical')) default 'low',
  resolved boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- COURSES
-- ============================================================
create table rides (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid references profiles not null,
  driver_id uuid references drivers,
  vehicle_type vehicle_type not null default 'standard',
  pickup_address text not null,
  dropoff_address text not null,
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  dropoff_lat double precision not null,
  dropoff_lng double precision not null,
  status ride_status default 'pending',
  estimated_price integer,          -- XAF
  final_price integer,              -- XAF
  distance_km numeric(8,2),
  duration_min integer,
  payment_method payment_method default 'cash',
  payment_status payment_status default 'pending',
  promo_code text,
  discount_amount integer default 0,
  notes text,
  scheduled_at timestamptz,         -- null = maintenant
  accepted_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  cancelled_by uuid references profiles,
  created_at timestamptz default now()
);

-- ============================================================
-- PIN DE VÉRIFICATION COURSE
-- ============================================================
create table ride_verification_pins (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid references rides on delete cascade unique not null,
  pin text not null,
  verified_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- PARTAGE DE TRAJET (lien public)
-- ============================================================
create table ride_shares (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid references rides on delete cascade not null,
  token text unique not null default encode(gen_random_bytes(16), 'hex'),
  shared_by uuid references profiles not null,
  expires_at timestamptz default (now() + interval '24 hours'),
  created_at timestamptz default now()
);

-- ============================================================
-- ANOMALIES DE COURSE
-- ============================================================
create table ride_anomalies (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid references rides not null,
  type text not null check (type in ('detour', 'arret_anormal', 'vitesse_excessive', 'zone_dangereuse')),
  detected_at timestamptz default now(),
  lat double precision,
  lng double precision,
  resolved boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- ALERTES SOS
-- ============================================================
create table sos_alerts (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid references rides not null,
  triggered_by uuid references profiles not null,
  lat double precision,
  lng double precision,
  status text check (status in ('active', 'resolved', 'false_alarm')) default 'active',
  resolved_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- ÉVALUATIONS
-- ============================================================
create table ratings (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid references rides not null,
  score integer not null check (score between 1 and 5),
  comment text,
  from_user_id uuid references profiles not null,
  to_user_id uuid references profiles not null,
  created_at timestamptz default now(),
  unique(ride_id, from_user_id)
);

-- ============================================================
-- PORTEFEUILLES
-- ============================================================
create table wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade unique not null,
  balance integer not null default 0 check (balance >= 0),  -- XAF
  currency text default 'XAF',
  updated_at timestamptz default now()
);

-- ============================================================
-- TRANSACTIONS PORTEFEUILLE
-- ============================================================
create table wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid references wallets not null,
  type transaction_type not null,
  amount integer not null,   -- XAF (positif = crédit, négatif = débit)
  balance_after integer not null,
  description text,
  ride_id uuid references rides,
  status payment_status default 'success',
  created_at timestamptz default now()
);

-- ============================================================
-- TRANSACTIONS MOBILE MONEY
-- ============================================================
create table mobile_money_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  wallet_id uuid references wallets,
  operator text not null check (operator in ('mtn_momo', 'orange_money')),
  phone text not null,
  amount integer not null,   -- XAF
  type text not null check (type in ('topup', 'withdrawal')),
  status payment_status default 'pending',
  operator_reference text,   -- référence de l'opérateur
  failure_reason text,
  initiated_at timestamptz default now(),
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- PAIEMENTS PARTAGÉS
-- ============================================================
create table split_payments (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid references rides not null,
  total_amount integer not null,   -- XAF
  initiator_id uuid references profiles not null,
  status text check (status in ('pending', 'completed', 'cancelled')) default 'pending',
  created_at timestamptz default now()
);

create table split_payment_participants (
  id uuid primary key default gen_random_uuid(),
  split_payment_id uuid references split_payments on delete cascade not null,
  user_id uuid references profiles not null,
  amount integer not null,         -- XAF
  status payment_status default 'pending',
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- ADRESSES FAVORITES
-- ============================================================
create table favorite_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade not null,
  label text not null check (label in ('home', 'work', 'other')),
  address text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz default now()
);

-- ============================================================
-- ABONNEMENTS PUSH
-- ============================================================
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  unique(user_id, endpoint)
);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-création profil à l'inscription
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    new.phone
  );

  insert into user_roles (user_id, role) values (new.id, 'passenger');

  insert into wallets (user_id, balance) values (new.id, 0);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Auto-génération PIN course
create or replace function generate_ride_pin()
returns trigger language plpgsql as $$
begin
  insert into ride_verification_pins (ride_id, pin)
  values (new.id, lpad(floor(random() * 10000)::text, 4, '0'));
  return new;
end;
$$;

create trigger on_ride_created
  after insert on rides
  for each row execute function generate_ride_pin();

-- Mise à jour rating chauffeur après évaluation
create or replace function update_driver_rating()
returns trigger language plpgsql as $$
declare
  driver_profile_id uuid;
begin
  select driver_id into driver_profile_id from rides where id = new.ride_id;
  update drivers
  set rating = (
    select round(avg(r.score)::numeric, 2)
    from ratings r
    join rides ri on ri.id = r.ride_id
    where ri.driver_id = driver_profile_id
  )
  where id = driver_profile_id;
  return new;
end;
$$;

create trigger on_rating_created
  after insert on ratings
  for each row execute function update_driver_rating();

-- Mise à jour updated_at automatique
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on profiles
  for each row execute function update_updated_at();

create trigger drivers_updated_at before update on drivers
  for each row execute function update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table user_roles enable row level security;
alter table emergency_contacts enable row level security;
alter table drivers enable row level security;
alter table driver_documents enable row level security;
alter table driver_verifications enable row level security;
alter table driver_incidents enable row level security;
alter table rides enable row level security;
alter table ride_verification_pins enable row level security;
alter table ride_shares enable row level security;
alter table ride_anomalies enable row level security;
alter table sos_alerts enable row level security;
alter table ratings enable row level security;
alter table wallets enable row level security;
alter table wallet_transactions enable row level security;
alter table mobile_money_transactions enable row level security;
alter table split_payments enable row level security;
alter table split_payment_participants enable row level security;
alter table favorite_addresses enable row level security;
alter table push_subscriptions enable row level security;
alter table pricing enable row level security;

-- PROFILES
create policy "Voir son profil" on profiles for select using (auth.uid() = id);
create policy "Modifier son profil" on profiles for update using (auth.uid() = id);
create policy "Créer son profil" on profiles for insert with check (auth.uid() = id);
create policy "Admin voir tous profils" on profiles for select using (has_role(auth.uid(), 'admin'));

-- USER ROLES
create policy "Voir ses rôles" on user_roles for select using (auth.uid() = user_id);

-- EMERGENCY CONTACTS
create policy "Gérer ses contacts urgence" on emergency_contacts for all using (auth.uid() = user_id);

-- DRIVERS
create policy "Voir chauffeurs disponibles" on drivers for select using (status = 'available' or profile_id = auth.uid() or has_role(auth.uid(), 'admin'));
create policy "Modifier son profil chauffeur" on drivers for update using (profile_id = auth.uid());
create policy "Créer profil chauffeur" on drivers for insert with check (profile_id = auth.uid());

-- DOCUMENTS CHAUFFEUR
create policy "Gérer ses documents" on driver_documents for all using (
  driver_id in (select id from drivers where profile_id = auth.uid())
);
create policy "Admin voir documents" on driver_documents for select using (has_role(auth.uid(), 'admin'));

-- RIDES
create policy "Voir ses courses" on rides for select using (
  passenger_id = auth.uid()
  or driver_id in (select id from drivers where profile_id = auth.uid())
  or has_role(auth.uid(), 'admin')
);
create policy "Créer une course" on rides for insert with check (passenger_id = auth.uid());
create policy "Modifier sa course" on rides for update using (
  passenger_id = auth.uid()
  or driver_id in (select id from drivers where profile_id = auth.uid())
  or has_role(auth.uid(), 'admin')
);

-- RIDE SHARES (public via token)
create policy "Voir partage de trajet" on ride_shares for select using (true);
create policy "Créer partage" on ride_shares for insert with check (shared_by = auth.uid());

-- RATINGS
create policy "Voir évaluations" on ratings for select using (
  from_user_id = auth.uid() or to_user_id = auth.uid()
);
create policy "Créer évaluation" on ratings for insert with check (from_user_id = auth.uid());

-- WALLETS
create policy "Voir son portefeuille" on wallets for select using (user_id = auth.uid());

-- WALLET TRANSACTIONS
create policy "Voir ses transactions" on wallet_transactions for select using (
  wallet_id in (select id from wallets where user_id = auth.uid())
);

-- MOBILE MONEY
create policy "Voir ses transactions MoMo" on mobile_money_transactions for select using (user_id = auth.uid());
create policy "Créer transaction MoMo" on mobile_money_transactions for insert with check (user_id = auth.uid());

-- FAVORITE ADDRESSES
create policy "Gérer ses adresses favorites" on favorite_addresses for all using (user_id = auth.uid());

-- PUSH SUBSCRIPTIONS
create policy "Gérer ses abonnements push" on push_subscriptions for all using (user_id = auth.uid());

-- PRICING (lecture publique)
create policy "Voir les tarifs" on pricing for select using (true);
create policy "Admin modifier tarifs" on pricing for all using (has_role(auth.uid(), 'admin'));

-- SOS
create policy "Voir ses SOS" on sos_alerts for select using (
  triggered_by = auth.uid() or has_role(auth.uid(), 'admin')
);
create policy "Créer SOS" on sos_alerts for insert with check (true);

-- ============================================================
-- STORAGE BUCKET (documents chauffeurs)
-- ============================================================
insert into storage.buckets (id, name, public) values ('driver-documents', 'driver-documents', false);

create policy "Chauffeur upload ses documents" on storage.objects
  for insert with check (bucket_id = 'driver-documents' and auth.role() = 'authenticated');

create policy "Chauffeur voir ses documents" on storage.objects
  for select using (bucket_id = 'driver-documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Admin voir tous les documents" on storage.objects
  for select using (bucket_id = 'driver-documents' and has_role(auth.uid(), 'admin'));

-- ============================================================
-- REALTIME (activer pour courses et chauffeurs)
-- ============================================================
alter publication supabase_realtime add table rides;
alter publication supabase_realtime add table drivers;
alter publication supabase_realtime add table sos_alerts;
