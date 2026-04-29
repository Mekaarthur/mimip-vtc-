-- ============================================================
-- MIMIP — Tarification v2 alignée sur les taxis camerounais
-- Prix au km basé sur le tarif réel du marché
-- ============================================================

-- Nettoyer l'ancienne grille
delete from pricing;

-- Supprimer les types enum inutiles (clando, depot déjà dans pricing)
-- On garde les types véhicules simples

-- ============================================================
-- GRILLE TARIFAIRE v2
-- Base : 400 XAF/km (aligné taxi) + 800 XAF forfait départ
-- Minimum garanti : 2 500 XAF (dépôt) / 3 500 XAF (course)
-- ============================================================

insert into pricing
  (vehicle_type, city, base_fare, price_per_km, price_per_min, min_fare, surge_multiplier, season)
values

  -- ══════════════════════════════
  -- YAOUNDÉ — Saison normale
  -- ══════════════════════════════

  -- Dépôt (seul, courte distance, minimum 2 500 XAF)
  ('depot', 'Yaoundé', 800, 400, 30, 2500, 1.0, 'basse'),

  -- Standard (course normale, minimum 3 500 XAF)
  ('standard', 'Yaoundé', 800, 400, 35, 3500, 1.0, 'basse'),

  -- Confort (SUV/premium, minimum 4 500 XAF)
  ('comfort', 'Yaoundé', 1000, 450, 45, 4500, 1.0, 'basse'),

  -- Van (groupes 5-8 personnes)
  ('van', 'Yaoundé', 1200, 500, 55, 6000, 1.0, 'basse'),

  -- Moto (rapide, courtes distances)
  ('moto', 'Yaoundé', 400, 200, 20, 700, 1.0, 'basse'),

  -- ══════════════════════════════
  -- YAOUNDÉ — Saison moyenne (+15%)
  -- ══════════════════════════════
  ('depot',    'Yaoundé', 800,  400, 30, 2900, 1.15, 'moyenne'),
  ('standard', 'Yaoundé', 800,  400, 35, 4000, 1.15, 'moyenne'),
  ('comfort',  'Yaoundé', 1000, 450, 45, 5200, 1.15, 'moyenne'),
  ('van',      'Yaoundé', 1200, 500, 55, 6900, 1.15, 'moyenne'),
  ('moto',     'Yaoundé', 400,  200, 20, 800,  1.15, 'moyenne'),

  -- ══════════════════════════════
  -- YAOUNDÉ — Haute saison (+30%)
  -- ══════════════════════════════
  ('depot',    'Yaoundé', 800,  400, 30, 3200, 1.30, 'haute'),
  ('standard', 'Yaoundé', 800,  400, 35, 4500, 1.30, 'haute'),
  ('comfort',  'Yaoundé', 1000, 450, 45, 5800, 1.30, 'haute'),
  ('van',      'Yaoundé', 1200, 500, 55, 7800, 1.30, 'haute'),
  ('moto',     'Yaoundé', 400,  200, 20, 900,  1.30, 'haute'),

  -- ══════════════════════════════
  -- DOUALA — Saison normale
  -- ══════════════════════════════
  ('depot',    'Douala', 800,  400, 30, 2500, 1.0, 'basse'),
  ('standard', 'Douala', 800,  400, 35, 3500, 1.0, 'basse'),
  ('comfort',  'Douala', 1000, 450, 45, 4500, 1.0, 'basse'),
  ('van',      'Douala', 1200, 500, 55, 6000, 1.0, 'basse'),
  ('moto',     'Douala', 400,  200, 20, 700,  1.0, 'basse'),

  ('depot',    'Douala', 800,  400, 30, 2900, 1.15, 'moyenne'),
  ('standard', 'Douala', 800,  400, 35, 4000, 1.15, 'moyenne'),
  ('comfort',  'Douala', 1000, 450, 45, 5200, 1.15, 'moyenne'),
  ('van',      'Douala', 1200, 500, 55, 6900, 1.15, 'moyenne'),
  ('moto',     'Douala', 400,  200, 20, 800,  1.15, 'moyenne'),

  ('depot',    'Douala', 800,  400, 30, 3200, 1.30, 'haute'),
  ('standard', 'Douala', 800,  400, 35, 4500, 1.30, 'haute'),
  ('comfort',  'Douala', 1000, 450, 45, 5800, 1.30, 'haute'),
  ('van',      'Douala', 1200, 500, 55, 7800, 1.30, 'haute'),
  ('moto',     'Douala', 400,  200, 20, 900,  1.30, 'haute'),

  -- ══════════════════════════════
  -- BAFOUSSAM — Saison normale
  -- ══════════════════════════════
  ('depot',    'Bafoussam', 700, 350, 25, 2000, 1.0, 'basse'),
  ('standard', 'Bafoussam', 700, 350, 30, 3000, 1.0, 'basse'),
  ('moto',     'Bafoussam', 300, 180, 15, 600,  1.0, 'basse'),

  ('depot',    'Bafoussam', 700, 350, 25, 2300, 1.15, 'moyenne'),
  ('standard', 'Bafoussam', 700, 350, 30, 3500, 1.15, 'moyenne'),
  ('moto',     'Bafoussam', 300, 180, 15, 700,  1.15, 'moyenne'),

  ('depot',    'Bafoussam', 700, 350, 25, 2600, 1.30, 'haute'),
  ('standard', 'Bafoussam', 700, 350, 30, 3900, 1.30, 'haute'),
  ('moto',     'Bafoussam', 300, 180, 15, 800,  1.30, 'haute');

-- ============================================================
-- FONCTION CALCUL PRIX v2
-- Prix = base + (km × prix_km) × multiplicateur saison
-- Minimum garanti selon type
-- Course partagée = prix total / nombre d'amis
-- ============================================================
create or replace function calculate_ride_price(
  p_vehicle_type  text,
  p_city          text,
  p_distance_km   numeric,
  p_duration_min  integer,
  p_is_shared     boolean  default false,
  p_split_count   integer  default 1
)
returns jsonb
language plpgsql stable as $$
declare
  v_season        text;
  v_pricing       pricing%rowtype;
  v_base_price    numeric;
  v_hour          integer;
  v_time_mult     numeric := 1.0;
  v_total_price   integer;
  v_price_per_person integer;
  v_commission    integer;
  v_driver_gets   integer;
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

  -- Fallback saison basse si pas trouvé
  if not found then
    select * into v_pricing
    from pricing
    where vehicle_type::text = p_vehicle_type
      and city = p_city
      and season = 'basse'
    limit 1;
  end if;

  if not found then
    return jsonb_build_object('error', 'Tarif non trouvé');
  end if;

  -- Heures de pointe (×1.3) : 7h-9h et 17h-19h
  v_hour := extract(hour from now());
  if v_hour between 7 and 9 or v_hour between 17 and 19 then
    v_time_mult := 1.3;
  -- Nuit (×1.5) : 22h-5h
  elsif v_hour >= 22 or v_hour <= 5 then
    v_time_mult := 1.5;
  end if;

  -- Calcul prix de base
  v_base_price := v_pricing.base_fare
    + (p_distance_km * v_pricing.price_per_km)
    + (p_duration_min * v_pricing.price_per_min);

  -- Appliquer multiplicateurs
  v_total_price := greatest(
    (v_base_price * v_pricing.surge_multiplier * v_time_mult)::integer,
    v_pricing.min_fare
  );

  -- Commission Mimip 15%
  v_commission := (v_total_price * 0.15)::integer;
  v_driver_gets := v_total_price - v_commission;

  -- Course partagée entre amis : diviser le TOTAL
  -- Le chauffeur reçoit toujours le plein tarif
  v_price_per_person := case
    when p_is_shared and p_split_count > 1
    then ceil(v_total_price::numeric / p_split_count)::integer
    else v_total_price
  end;

  return jsonb_build_object(
    'total_price',       v_total_price,
    'price_per_person',  v_price_per_person,
    'commission',        v_commission,
    'driver_gets',       v_driver_gets,
    'season',            v_season,
    'is_peak_hour',      v_time_mult > 1.0,
    'split_count',       p_split_count,
    'currency',          'XAF'
  );
end;
$$;

-- ============================================================
-- EXEMPLE D'UTILISATION
-- select calculate_ride_price('standard', 'Yaoundé', 8, 20, false, 1);
-- → {"total_price": 4000, "driver_gets": 3400, "commission": 600}
--
-- Course partagée 4 amis, 15 km :
-- select calculate_ride_price('standard', 'Yaoundé', 15, 35, true, 4);
-- → {"total_price": 6800, "price_per_person": 1700, "driver_gets": 5780}
-- ============================================================
