-- ============================================================
-- MIMIP — Tarification réelle Cameroun + Saisons
-- ============================================================

-- Ajouter le type clando (course partagée à 300 XAF)
alter type vehicle_type add value if not exists 'clando';
alter type vehicle_type add value if not exists 'depot';

-- Ajouter les colonnes saison et partage sur pricing
alter table pricing
  add column if not exists season text check (season in ('basse', 'moyenne', 'haute')) default 'basse',
  add column if not exists peak_multiplier numeric(3,1) default 1.3,
  add column if not exists night_multiplier numeric(3,1) default 1.5;

-- Ajouter colonnes courses partagées sur rides
alter table rides
  add column if not exists is_shared boolean default false,
  add column if not exists max_passengers integer default 1,
  add column if not exists current_passengers integer default 1,
  add column if not exists shared_passenger_ids uuid[] default '{}',
  add column if not exists price_per_passenger integer;

-- ============================================================
-- TABLE SAISONS
-- ============================================================
create table if not exists seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level text not null check (level in ('basse', 'moyenne', 'haute')),
  start_date text not null,  -- format MM-DD (ex: '09-01')
  end_date text not null,    -- format MM-DD
  multiplier numeric(3,2) not null default 1.0,
  description text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Données saisons Cameroun
insert into seasons (name, level, start_date, end_date, multiplier, description) values
  ('Saison normale',          'basse',   '02-01', '04-30', 1.00, 'Période calme'),
  ('Saison normale',          'basse',   '10-01', '10-31', 1.00, 'Période calme'),
  ('Saison intermédiaire',    'moyenne', '01-01', '01-31', 1.15, 'Nouvel an'),
  ('Saison intermédiaire',    'moyenne', '05-01', '06-30', 1.15, 'Fête nationale + vacances'),
  ('Saison intermédiaire',    'moyenne', '07-01', '08-31', 1.15, 'Vacances scolaires'),
  ('Saison intermédiaire',    'moyenne', '11-01', '11-30', 1.15, 'Fin d''année approche'),
  ('Rentrée scolaire',        'haute',   '09-01', '09-15', 1.30, 'Forte demande rentrée'),
  ('Fêtes de fin d''année',   'haute',   '12-20', '12-31', 1.30, 'Noël et réveillon'),
  ('Pâques',                  'haute',   '03-28', '04-02', 1.30, 'Fêtes de Pâques'),
  ('Fête nationale',          'haute',   '05-20', '05-21', 1.30, 'Fête nationale Cameroun');

-- ============================================================
-- GRILLE TARIFAIRE RÉELLE CAMEROUN
-- ============================================================
delete from pricing;

insert into pricing
  (vehicle_type, city, base_fare, price_per_km, price_per_min, min_fare, surge_multiplier, season)
values
  -- ==================
  -- YAOUNDÉ
  -- ==================

  -- Clando (course partagée) — 300 XAF fixe par personne
  ('clando', 'Yaoundé', 300, 0,   0,  300,  1.0, 'basse'),
  ('clando', 'Yaoundé', 300, 0,   0,  300,  1.0, 'moyenne'),
  ('clando', 'Yaoundé', 300, 0,   0,  400,  1.0, 'haute'),

  -- Dépôt (seul, courte distance)
  ('depot',  'Yaoundé', 800, 180, 30, 2500, 1.0, 'basse'),
  ('depot',  'Yaoundé', 800, 180, 30, 2700, 1.0, 'moyenne'),
  ('depot',  'Yaoundé', 800, 180, 30, 3000, 1.0, 'haute'),

  -- Standard (course privée normale)
  ('standard', 'Yaoundé', 1000, 250, 40, 3500, 1.0, 'basse'),
  ('standard', 'Yaoundé', 1000, 250, 40, 4000, 1.0, 'moyenne'),
  ('standard', 'Yaoundé', 1000, 250, 40, 4500, 1.0, 'haute'),

  -- Confort
  ('comfort', 'Yaoundé', 1200, 320, 55, 4500, 1.0, 'basse'),
  ('comfort', 'Yaoundé', 1200, 320, 55, 5000, 1.0, 'moyenne'),
  ('comfort', 'Yaoundé', 1200, 320, 55, 5800, 1.0, 'haute'),

  -- Van / Minibus
  ('van', 'Yaoundé', 1500, 380, 65, 6000, 1.0, 'basse'),
  ('van', 'Yaoundé', 1500, 380, 65, 7000, 1.0, 'moyenne'),
  ('van', 'Yaoundé', 1500, 380, 65, 8000, 1.0, 'haute'),

  -- Moto
  ('moto', 'Yaoundé', 300, 120, 20, 500,  1.0, 'basse'),
  ('moto', 'Yaoundé', 300, 120, 20, 600,  1.0, 'moyenne'),
  ('moto', 'Yaoundé', 300, 120, 20, 700,  1.0, 'haute'),

  -- ==================
  -- DOUALA
  -- ==================
  ('clando',   'Douala', 300,  0,   0,  300,  1.0, 'basse'),
  ('clando',   'Douala', 300,  0,   0,  300,  1.0, 'moyenne'),
  ('clando',   'Douala', 300,  0,   0,  400,  1.0, 'haute'),
  ('depot',    'Douala', 800,  180, 30, 2500, 1.0, 'basse'),
  ('depot',    'Douala', 800,  180, 30, 2800, 1.0, 'moyenne'),
  ('depot',    'Douala', 800,  180, 30, 3200, 1.0, 'haute'),
  ('standard', 'Douala', 1000, 250, 40, 3500, 1.0, 'basse'),
  ('standard', 'Douala', 1000, 250, 40, 4000, 1.0, 'moyenne'),
  ('standard', 'Douala', 1000, 250, 40, 4500, 1.0, 'haute'),
  ('comfort',  'Douala', 1200, 320, 55, 4500, 1.0, 'basse'),
  ('comfort',  'Douala', 1200, 320, 55, 5200, 1.0, 'moyenne'),
  ('comfort',  'Douala', 1200, 320, 55, 6000, 1.0, 'haute'),
  ('van',      'Douala', 1500, 380, 65, 6000, 1.0, 'basse'),
  ('van',      'Douala', 1500, 380, 65, 7000, 1.0, 'moyenne'),
  ('van',      'Douala', 1500, 380, 65, 8500, 1.0, 'haute'),
  ('moto',     'Douala', 300,  120, 20, 500,  1.0, 'basse'),
  ('moto',     'Douala', 300,  120, 20, 600,  1.0, 'moyenne'),
  ('moto',     'Douala', 300,  120, 20, 700,  1.0, 'haute'),

  -- ==================
  -- BAFOUSSAM
  -- ==================
  ('clando',   'Bafoussam', 200, 0,   0,  200,  1.0, 'basse'),
  ('clando',   'Bafoussam', 200, 0,   0,  200,  1.0, 'moyenne'),
  ('clando',   'Bafoussam', 200, 0,   0,  300,  1.0, 'haute'),
  ('depot',    'Bafoussam', 600, 150, 25, 2000, 1.0, 'basse'),
  ('depot',    'Bafoussam', 600, 150, 25, 2300, 1.0, 'moyenne'),
  ('depot',    'Bafoussam', 600, 150, 25, 2700, 1.0, 'haute'),
  ('standard', 'Bafoussam', 800, 220, 35, 3000, 1.0, 'basse'),
  ('standard', 'Bafoussam', 800, 220, 35, 3500, 1.0, 'moyenne'),
  ('standard', 'Bafoussam', 800, 220, 35, 4000, 1.0, 'haute'),
  ('moto',     'Bafoussam', 200, 100, 15, 400,  1.0, 'basse'),
  ('moto',     'Bafoussam', 200, 100, 15, 500,  1.0, 'moyenne'),
  ('moto',     'Bafoussam', 200, 100, 15, 600,  1.0, 'haute');

-- ============================================================
-- FONCTION : Calcul automatique de la saison active
-- ============================================================
create or replace function get_current_season()
returns text
language plpgsql stable as $$
declare
  today text := to_char(now(), 'MM-DD');
  result text := 'basse';
begin
  select level into result
  from seasons
  where is_active = true
    and (
      (start_date <= end_date and today between start_date and end_date)
      or
      (start_date > end_date and (today >= start_date or today <= end_date))
    )
  order by multiplier desc
  limit 1;
  return coalesce(result, 'basse');
end;
$$;

-- ============================================================
-- FONCTION : Calcul du prix d'une course
-- ============================================================
create or replace function calculate_ride_price(
  p_vehicle_type text,
  p_city text,
  p_distance_km numeric,
  p_duration_min integer,
  p_is_shared boolean default false,
  p_passenger_count integer default 1
)
returns integer
language plpgsql stable as $$
declare
  v_season text;
  v_pricing pricing%rowtype;
  v_base_price numeric;
  v_season_multiplier numeric;
  v_hour integer;
  v_time_multiplier numeric := 1.0;
  v_final_price integer;
begin
  -- Saison actuelle
  v_season := get_current_season();

  -- Récupérer tarif
  select * into v_pricing
  from pricing
  where vehicle_type::text = p_vehicle_type
    and city = p_city
    and season = v_season
    and is_active = true
  limit 1;

  if not found then
    -- Fallback sur saison basse
    select * into v_pricing
    from pricing
    where vehicle_type::text = p_vehicle_type
      and city = p_city
      and season = 'basse'
    limit 1;
  end if;

  -- Clando : prix fixe par personne
  if p_vehicle_type = 'clando' then
    return v_pricing.min_fare * p_passenger_count;
  end if;

  -- Calcul prix de base
  v_base_price := v_pricing.base_fare
    + (p_distance_km * v_pricing.price_per_km)
    + (p_duration_min * v_pricing.price_per_min);

  -- Multiplicateur heure de pointe
  v_hour := extract(hour from now());
  if v_hour between 7 and 9 or v_hour between 17 and 19 then
    v_time_multiplier := v_pricing.peak_multiplier;
  elsif v_hour >= 22 or v_hour <= 5 then
    v_time_multiplier := v_pricing.night_multiplier;
  end if;

  -- Récupérer multiplicateur saison
  select multiplier into v_season_multiplier
  from seasons
  where level = v_season
  limit 1;

  v_season_multiplier := coalesce(v_season_multiplier, 1.0);

  -- Prix final
  v_final_price := greatest(
    (v_base_price * v_time_multiplier * v_season_multiplier)::integer,
    v_pricing.min_fare
  );

  -- Cours partagée : diviser par nombre de passagers
  if p_is_shared and p_passenger_count > 1 then
    v_final_price := (v_final_price / p_passenger_count)::integer;
    -- Minimum 500 XAF par personne même en partagé
    v_final_price := greatest(v_final_price, 500);
  end if;

  return v_final_price;
end;
$$;

-- ============================================================
-- TABLE : Commission chauffeur (évolutive)
-- ============================================================
create table if not exists driver_commission_tiers (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  min_days integer not null,
  max_days integer,           -- null = illimité
  commission_rate numeric(4,2) not null,
  description text,
  created_at timestamptz default now()
);

insert into driver_commission_tiers (label, min_days, max_days, commission_rate, description) values
  ('Débutant',    0,   90,  10.0, '10% les 3 premiers mois pour attirer les chauffeurs'),
  ('Standard',    91,  365, 15.0, '15% après 3 mois'),
  ('Fidèle',      366, 730, 13.0, '13% après 1 an de fidélité'),
  ('Premium',     731, null, 12.0, '12% après 2 ans — récompense fidélité');

-- RLS sur nouvelles tables
alter table seasons enable row level security;
alter table driver_commission_tiers enable row level security;

create policy "Voir saisons" on seasons for select using (true);
create policy "Voir commissions" on driver_commission_tiers for select using (true);
create policy "Admin gérer saisons" on seasons for all using (has_role(auth.uid(), 'admin'));
