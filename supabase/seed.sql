-- Seed Data for Vault Gaming POS

INSERT INTO public.stations (id, name, gaming_type, status, display_order) VALUES
('ps5-1', 'PS5 Station 01 (4K OLED)', 'ps5', 'available', 1),
('ps5-2', 'PS5 Station 02 (4K OLED)', 'ps5', 'available', 2),
('ps5-3', 'PS5 Station 03 (Gaming Chair)', 'ps5', 'available', 3),
('ps5-4', 'PS5 Station 04 (Dual Controller)', 'ps5', 'available', 4),
('pool-1', '8-Ball Pool Table A (Tournament)', 'pool', 'available', 5),
('pool-2', '8-Ball Pool Table B (Standard)', 'pool', 'available', 6)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.products (id, name, category, price_paise, is_active) VALUES
('snk-1', 'Red Bull Energy Drink (250ml)', 'Beverages', 12500, true),
('snk-2', 'Mountain Dew Can (300ml)', 'Beverages', 4000, true),
('snk-3', 'Coca-Cola Zero Can (300ml)', 'Beverages', 4000, true),
('snk-4', 'Kinley Mineral Water (500ml)', 'Beverages', 2000, true),
('snk-5', 'Lay''s Magic Masala (Large)', 'Chips & Savouries', 3000, true),
('snk-6', 'Doritos Cheese Supreme (75g)', 'Chips & Savouries', 5000, true),
('snk-7', 'Snickers Chocolate Bar', 'Chocolates', 5000, true),
('snk-8', 'Maggi Masala Double Bowl', 'Hot Items', 6000, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pricing_config (
  id, business_name, business_timezone, currency_symbol,
  ps5_hourly_rate_paise, ps5_multiplayer_hourly_rate_paise,
  ps5_fixed_plans, pool_hourly_rate_paise, pool_per_frame_rate_paise,
  rounding_rule, allow_custom_snacks, allow_partial_payments, max_employee_discount_paise
) VALUES (
  'cfg-default', 'Vault Gaming Centre & Pool Lounge', 'Asia/Kolkata', '₹',
  15000, 22000,
  '[
    {"id": "plan-30m", "name": "30-Min Rush Pass", "gamingType": "ps5", "durationMinutes": 30, "pricePaise": 8000},
    {"id": "plan-1h", "name": "1-Hour Fixed Pass", "gamingType": "ps5", "durationMinutes": 60, "pricePaise": 14000},
    {"id": "plan-2h", "name": "2-Hour Power Pack", "gamingType": "ps5", "durationMinutes": 120, "pricePaise": 26000}
  ]'::jsonb,
  18000, 5000,
  'nearest_5', true, true, 5000
)
ON CONFLICT (id) DO NOTHING;
