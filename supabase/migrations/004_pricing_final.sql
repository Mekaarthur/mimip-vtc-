-- ============================================================
-- MIMIP — Tarification finale
-- Formule : 660 XAF base + 307 XAF/km
-- Positionnement : entre Yango (~250/km) et taxi (~430/km)
-- Commission : TBD (à définir)
-- ============================================================

delete from pricing;

insert into pricing
  (vehicle_type, city, base_fare, price_per_km, price_per_min, min_fare, surge_multiplier, season)
values

  -- ══════════════════════════════════════
  -- STANDARD (course normale)
  -- Base : 660 + 307/km
  -- Exemples : 3km=1800 / 8km=3000 / 15km=5000 / 25km=8500
  -- ══════════════════════════════════════

  -- Yaoundé
  ('standard', 'Yaoundé', 660, 307, 0, 1800, 1.00, 'basse'),
  ('standard', 'Yaoundé', 660, 307, 0, 2000, 1.15, 'moyenne'),
  ('standard', 'Yaoundé', 660, 307, 0, 2300, 1.30, 'haute'),

  -- Douala
  ('standard', 'Douala',  660, 307, 0, 1800, 1.00, 'basse'),
  ('standard', 'Douala',  660, 307, 0, 2000, 1.15, 'moyenne'),
  ('standard', 'Douala',  660, 307, 0, 2300, 1.30, 'haute'),

  -- Bafoussam (marché légèrement inférieur)
  ('standard', 'Bafoussam', 600, 280, 0, 1500, 1.00, 'basse'),
  ('standard', 'Bafoussam', 600, 280, 0, 1700, 1.15, 'moyenne'),
  ('standard', 'Bafoussam', 600, 280, 0, 2000, 1.30, 'haute'),

  -- ══════════════════════════════════════
  -- DÉPÔT (seul, courte distance)
  -- Même formule, minimum plus bas
  -- ══════════════════════════════════════
  ('depot', 'Yaoundé', 660, 307, 0, 1800, 1.00, 'basse'),
  ('depot', 'Yaoundé', 660, 307, 0, 2000, 1.15, 'moyenne'),
  ('depot', 'Yaoundé', 660, 307, 0, 2300, 1.30, 'haute'),

  ('depot', 'Douala',  660, 307, 0, 1800, 1.00, 'basse'),
  ('depot', 'Douala',  660, 307, 0, 2000, 1.15, 'moyenne'),
  ('depot', 'Douala',  660, 307, 0, 2300, 1.30, 'haute'),

  ('depot', 'Bafoussam', 600, 280, 0, 1500, 1.00, 'basse'),
  ('depot', 'Bafoussam', 600, 280, 0, 1700, 1.15, 'moyenne'),
  ('depot', 'Bafoussam', 600, 280, 0, 2000, 1.30, 'haute'),

  -- ══════════════════════════════════════
  -- CONFORT (+25% sur le standard)
  -- ══════════════════════════════════════
  ('comfort', 'Yaoundé', 825, 384, 0, 2200, 1.00, 'basse'),
  ('comfort', 'Yaoundé', 825, 384, 0, 2500, 1.15, 'moyenne'),
  ('comfort', 'Yaoundé', 825, 384, 0, 2900, 1.30, 'haute'),

  ('comfort', 'Douala',  825, 384, 0, 2200, 1.00, 'basse'),
  ('comfort', 'Douala',  825, 384, 0, 2500, 1.15, 'moyenne'),
  ('comfort', 'Douala',  825, 384, 0, 2900, 1.30, 'haute'),

  -- ══════════════════════════════════════
  -- VAN (+50% sur le standard)
  -- ══════════════════════════════════════
  ('van', 'Yaoundé', 990, 460, 0, 2700, 1.00, 'basse'),
  ('van', 'Yaoundé', 990, 460, 0, 3100, 1.15, 'moyenne'),
  ('van', 'Yaoundé', 990, 460, 0, 3500, 1.30, 'haute'),

  ('van', 'Douala',  990, 460, 0, 2700, 1.00, 'basse'),
  ('van', 'Douala',  990, 460, 0, 3100, 1.15, 'moyenne'),
  ('van', 'Douala',  990, 460, 0, 3500, 1.30, 'haute'),

  -- ══════════════════════════════════════
  -- MOTO (-40% sur le standard)
  -- ══════════════════════════════════════
  ('moto', 'Yaoundé', 400, 185, 0, 1100, 1.00, 'basse'),
  ('moto', 'Yaoundé', 400, 185, 0, 1200, 1.15, 'moyenne'),
  ('moto', 'Yaoundé', 400, 185, 0, 1400, 1.30, 'haute'),

  ('moto', 'Douala',  400, 185, 0, 1100, 1.00, 'basse'),
  ('moto', 'Douala',  400, 185, 0, 1200, 1.15, 'moyenne'),
  ('moto', 'Douala',  400, 185, 0, 1400, 1.30, 'haute'),

  ('moto', 'Bafoussam', 350, 160, 0, 900, 1.00, 'basse'),
  ('moto', 'Bafoussam', 350, 160, 0, 1000, 1.15, 'moyenne'),
  ('moto', 'Bafoussam', 350, 160, 0, 1100, 1.30, 'haute');

-- ══════════════════════════════════════
-- TABLE DE RÉFÉRENCE (pour vérification)
-- Exemples de prix avec formule 660 + 307×km
-- ══════════════════════════════════════
-- 3  km → 660 + 921  = 1 581 → arrondi 1 800 XAF
-- 8  km → 660 + 2456 = 3 116 → arrondi 3 000 XAF
-- 15 km → 660 + 4605 = 5 265 → arrondi 5 000 XAF
-- 25 km → 660 + 7675 = 8 335 → arrondi 8 500 XAF
--
-- VS Yango estimé :
-- 3  km → ~1 200 XAF  | Mimip +50%
-- 8  km → ~2 800 XAF  | Mimip +7%
-- 15 km → ~4 500 XAF  | Mimip +11%
-- 25 km → ~7 500 XAF  | Mimip +13%
-- ══════════════════════════════════════
