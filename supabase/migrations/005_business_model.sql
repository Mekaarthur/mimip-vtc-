-- ============================================================
-- MIMIP — Modèle économique final
-- Abonnement : 10 000 XAF/mois + 8% par course
-- Minimum : 20 courses/mois
-- Surge : +500 XAF fixe en heure de pointe
-- Prix uniques toute l'année (pas de saisonnalité)
-- ============================================================

-- ══════════════════════════════════════════════
-- 1. TARIFS SIMPLIFIÉS — Prix fixes toute l'année
-- ══════════════════════════════════════════════
delete from pricing;

insert into pricing
  (vehicle_type, city, base_fare, price_per_km, price_per_min, min_fare, surge_multiplier, season)
values
  -- YAOUNDÉ
  ('standard', 'Yaoundé', 660, 307, 0, 1800, 1.0, 'basse'),
  ('depot',    'Yaoundé', 660, 307, 0, 1800, 1.0, 'basse'),
  ('comfort',  'Yaoundé', 825, 384, 0, 2200, 1.0, 'basse'),
  ('van',      'Yaoundé', 990, 460, 0, 2700, 1.0, 'basse'),
  ('moto',     'Yaoundé', 400, 185, 0, 1100, 1.0, 'basse'),

  -- DOUALA
  ('standard', 'Douala', 660, 307, 0, 1800, 1.0, 'basse'),
  ('depot',    'Douala', 660, 307, 0, 1800, 1.0, 'basse'),
  ('comfort',  'Douala', 825, 384, 0, 2200, 1.0, 'basse'),
  ('van',      'Douala', 990, 460, 0, 2700, 1.0, 'basse'),
  ('moto',     'Douala', 400, 185, 0, 1100, 1.0, 'basse'),

  -- BAFOUSSAM
  ('standard', 'Bafoussam', 600, 280, 0, 1500, 1.0, 'basse'),
  ('depot',    'Bafoussam', 600, 280, 0, 1500, 1.0, 'basse'),
  ('moto',     'Bafoussam', 350, 160, 0,  900, 1.0, 'basse');

-- ══════════════════════════════════════════════
-- 2. ABONNEMENTS CHAUFFEUR
-- ══════════════════════════════════════════════
create table if not exists driver_subscriptions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references drivers on delete cascade not null,
  month integer not null check (month between 1 and 12),
  year integer not null,
  amount integer not null default 10000,          -- 10 000 XAF/mois
  commission_rate numeric(4,2) not null default 8.0, -- 8%
  status text check (status in ('pending','paid','overdue')) default 'pending',
  paid_at timestamptz,
  payment_method text check (payment_method in ('mtn_momo','orange_money','wallet')),
  created_at timestamptz default now(),
  unique(driver_id, month, year)
);

alter table driver_subscriptions enable row level security;
create policy "Chauffeur voir son abonnement"
  on driver_subscriptions for select using (
    driver_id in (select id from drivers where profile_id = auth.uid())
  );
create policy "Admin gérer abonnements"
  on driver_subscriptions for all using (has_role(auth.uid(), 'admin'));

-- ══════════════════════════════════════════════
-- 3. COMPTEUR MENSUEL DE COURSES PAR CHAUFFEUR
-- Se remet à zéro le 1er de chaque mois
-- ══════════════════════════════════════════════
create table if not exists driver_monthly_stats (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references drivers on delete cascade not null,
  month integer not null check (month between 1 and 12),
  year integer not null,
  total_rides integer not null default 0,
  total_earnings integer not null default 0,      -- XAF brut
  total_commission integer not null default 0,    -- 8% prélevé
  net_earnings integer not null default 0,        -- après commission
  alert_sent boolean default false,               -- alerte J25 envoyée
  updated_at timestamptz default now(),
  unique(driver_id, month, year)
);

alter table driver_monthly_stats enable row level security;
create policy "Chauffeur voir ses stats"
  on driver_monthly_stats for select using (
    driver_id in (select id from drivers where profile_id = auth.uid())
  );
create policy "Admin voir toutes stats"
  on driver_monthly_stats for select using (has_role(auth.uid(), 'admin'));

-- ══════════════════════════════════════════════
-- 4. TRIGGER — Mise à jour compteur après course
-- ══════════════════════════════════════════════
create or replace function update_monthly_stats_on_ride()
returns trigger language plpgsql as $$
declare
  v_month integer := extract(month from now());
  v_year  integer := extract(year  from now());
  v_commission integer;
  v_net integer;
begin
  -- Seulement quand une course passe à "completed"
  if new.status = 'completed' and old.status != 'completed' then
    v_commission := ((new.final_price * 0.08))::integer;
    v_net        := new.final_price - v_commission;

    insert into driver_monthly_stats
      (driver_id, month, year, total_rides, total_earnings, total_commission, net_earnings)
    values
      (new.driver_id, v_month, v_year, 1, new.final_price, v_commission, v_net)
    on conflict (driver_id, month, year) do update set
      total_rides      = driver_monthly_stats.total_rides + 1,
      total_earnings   = driver_monthly_stats.total_earnings + new.final_price,
      total_commission = driver_monthly_stats.total_commission + v_commission,
      net_earnings     = driver_monthly_stats.net_earnings + v_net,
      updated_at       = now();
  end if;
  return new;
end;
$$;

create trigger on_ride_completed
  after update on rides
  for each row execute function update_monthly_stats_on_ride();

-- ══════════════════════════════════════════════
-- 5. NOTIFICATIONS D'ALERTE (J25 < 20 courses)
-- ══════════════════════════════════════════════
create table if not exists driver_alerts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references drivers not null,
  type text check (type in ('rides_minimum', 'subscription_due', 'subscription_overdue')),
  message text not null,
  month integer,
  year integer,
  is_read boolean default false,
  created_at timestamptz default now()
);

alter table driver_alerts enable row level security;
create policy "Chauffeur voir ses alertes"
  on driver_alerts for select using (
    driver_id in (select id from drivers where profile_id = auth.uid())
  );
create policy "Chauffeur marquer lu"
  on driver_alerts for update using (
    driver_id in (select id from drivers where profile_id = auth.uid())
  );

-- ══════════════════════════════════════════════
-- 6. FONCTION — Calcul prix avec surge +500 XAF
-- Heure de pointe : 7h-9h et 17h-19h
-- Nuit           : 22h-5h → +500 XAF aussi
-- ══════════════════════════════════════════════
create or replace function calculate_ride_price(
  p_vehicle_type  text,
  p_city          text,
  p_distance_km   numeric,
  p_duration_min  integer  default 0,
  p_is_shared     boolean  default false,
  p_split_count   integer  default 1
)
returns jsonb
language plpgsql stable as $$
declare
  v_pricing       pricing%rowtype;
  v_base_price    numeric;
  v_surge         integer := 0;   -- +500 XAF fixe si heure de pointe
  v_hour          integer;
  v_total_price   integer;
  v_per_person    integer;
  v_commission    integer;
  v_driver_gets   integer;
  v_is_peak       boolean := false;
begin
  -- Récupérer tarif (prix unique toute l'année)
  select * into v_pricing
  from pricing
  where vehicle_type::text = p_vehicle_type
    and city = p_city
    and is_active = true
  limit 1;

  if not found then
    return jsonb_build_object('error', 'Tarif introuvable pour ' || p_vehicle_type || ' à ' || p_city);
  end if;

  -- Prix de base : forfait + km
  v_base_price := v_pricing.base_fare + (p_distance_km * v_pricing.price_per_km);

  -- Surge pricing FIXE +500 XAF (version douce)
  v_hour := extract(hour from now());
  if v_hour between 7 and 9 or v_hour between 17 and 19 then
    v_surge   := 500;
    v_is_peak := true;
  elsif v_hour >= 22 or v_hour <= 5 then
    v_surge   := 500;   -- nuit aussi +500 XAF
    v_is_peak := true;
  end if;

  -- Prix total = max(calcul, minimum garanti) + surge
  v_total_price := greatest(v_base_price::integer, v_pricing.min_fare) + v_surge;

  -- Commission 8%
  v_commission  := (v_total_price * 0.08)::integer;
  v_driver_gets := v_total_price - v_commission;

  -- Course partagée : diviser par nombre d'amis
  -- Le chauffeur reçoit toujours le plein tarif
  v_per_person := case
    when p_is_shared and p_split_count > 1
    then ceil(v_total_price::numeric / p_split_count)::integer
    else v_total_price
  end;

  return jsonb_build_object(
    'total_price',      v_total_price,
    'price_per_person', v_per_person,
    'commission',       v_commission,       -- 8%
    'driver_gets',      v_driver_gets,      -- 92%
    'surge',            v_surge,            -- 0 ou 500 XAF
    'is_peak_hour',     v_is_peak,
    'split_count',      p_split_count,
    'currency',         'XAF'
  );
end;
$$;

-- ══════════════════════════════════════════════
-- EXEMPLES DE RÉSULTATS
-- ══════════════════════════════════════════════
-- Heure normale :
-- select calculate_ride_price('standard', 'Yaoundé', 8, 0);
-- → total=3116, commission=249, driver_gets=2867
--
-- Heure de pointe :
-- select calculate_ride_price('standard', 'Yaoundé', 8, 0);
-- → total=3616, commission=289, driver_gets=3327, surge=500
--
-- Course partagée 3 amis, 15 km :
-- select calculate_ride_price('standard', 'Yaoundé', 15, 0, true, 3);
-- → total=5265, per_person=1755, driver_gets=4844
-- ══════════════════════════════════════════════
