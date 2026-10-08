-- =============================================================================
-- LOCAL DEVELOPMENT / AUTOMATED TEST DATA ONLY
-- This file runs only on a local Supabase (`supabase db reset`). It is never
-- applied to the production database.
--
-- It publishes the two products with clearly-marked DEMO stock and demo
-- shipping rates so the full checkout flow can be exercised locally.
-- =============================================================================

update public.products set status = 'published', published_at = now();

update public.products
  set claims = (select jsonb_agg(c || '{"approved": true}'::jsonb) from jsonb_array_elements(claims) c),
      shelf_life_approved = true;

update public.product_variants set stock = 25, is_demo_stock = true;

insert into public.inventory_movements (variant_id, delta, stock_after, reason, note)
select id, 25, 25, 'initial', 'LOCAL DEMO STOCK — not real inventory'
from public.product_variants;

update public.shipping_zones
  set is_active = true,
      flat_rate_paise = 6000,
      free_shipping_threshold_paise = 49900,
      cod_available = true,
      notes = 'LOCAL DEMO RATES — not real business rates';

update public.cms_sections set is_visible = true where key = 'trust';

update public.settings
  set value = value || '{"cod_enabled": true}'::jsonb
  where key = 'checkout';
