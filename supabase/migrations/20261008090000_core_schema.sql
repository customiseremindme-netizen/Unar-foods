-- =============================================================================
-- UNAR — core schema
-- All money values are stored as integer PAISE (₹1 = 100 paise) to avoid
-- floating point rounding errors.
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- People: profiles, staff, addresses
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text check (full_name is null or char_length(full_name) <= 120),
  phone text check (phone is null or phone ~ '^[6-9][0-9]{9}$'),
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));

create table public.role_permissions (
  role text not null check (role in ('owner', 'admin', 'content_editor', 'fulfillment')),
  permission text not null,
  primary key (role, permission)
);

create table public.staff_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'content_editor', 'fulfillment')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text check (label is null or char_length(label) <= 40),
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  line1 text not null check (char_length(line1) between 3 and 200),
  line2 text check (line2 is null or char_length(line2) <= 200),
  landmark text check (landmark is null or char_length(landmark) <= 120),
  city text not null check (char_length(city) between 2 and 80),
  state text not null check (char_length(state) between 2 and 80),
  pincode text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  country text not null default 'IN',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_user_idx on public.addresses (user_id);

-- -----------------------------------------------------------------------------
-- Catalogue
-- -----------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  description text,
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 160),
  short_title text check (short_title is null or char_length(short_title) <= 80),
  subtitle text check (subtitle is null or char_length(subtitle) <= 120),
  short_description text check (short_description is null or char_length(short_description) <= 400),
  description_md text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  -- Label information (keep exactly as printed on the pack)
  ingredients text,
  allergens text,
  dietary_mark text,
  nutrition jsonb not null default '[]'::jsonb,
  nutrition_note text,
  -- Marketing / regulatory claims: [{ "label": "...", "approved": false }]
  -- Only approved claims are shown on the storefront.
  claims jsonb not null default '[]'::jsonb,
  benefits jsonb not null default '[]'::jsonb,
  storage_instructions text,
  shelf_life text,
  shelf_life_approved boolean not null default false,
  shipping_returns_md text,
  manufacturer_info text,
  fssai_license text,
  -- Tax (never invented: owner must enter)
  hsn_code text,
  gst_rate numeric(5, 2) check (gst_rate is null or (gst_rate >= 0 and gst_rate <= 40)),
  is_featured boolean not null default false,
  sort_order int not null default 0,
  seo_title text,
  seo_description text,
  og_image_url text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_nutrition_is_array check (jsonb_typeof(nutrition) = 'array'),
  constraint products_claims_is_array check (jsonb_typeof(claims) = 'array'),
  constraint products_benefits_is_array check (jsonb_typeof(benefits) = 'array')
);
create index products_status_idx on public.products (status, sort_order);

create table public.product_categories (
  product_id uuid not null references public.products (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (product_id, category_id)
);
create index product_categories_category_idx on public.product_categories (category_id);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  title text not null default '100 g' check (char_length(title) between 1 and 80),
  sku text not null unique check (sku ~ '^[A-Za-z0-9._-]{2,64}$'),
  barcode text check (barcode is null or char_length(barcode) <= 64),
  weight_grams int not null default 0 check (weight_grams >= 0),
  mrp_paise int not null check (mrp_paise >= 0),
  -- Selling price may never exceed MRP (Legal Metrology rules).
  price_paise int not null check (price_paise >= 0),
  stock int not null default 0 check (stock >= 0),
  low_stock_threshold int not null default 5 check (low_stock_threshold >= 0),
  is_demo_stock boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_price_le_mrp check (price_paise <= mrp_paise)
);
create index product_variants_product_idx on public.product_variants (product_id, sort_order);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  url text not null,
  storage_path text,
  alt text not null default '',
  kind text not null default 'packshot' check (kind in ('packshot', 'photo', 'front_label', 'back_label', 'lifestyle', 'other')),
  width int,
  height int,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, sort_order);

-- -----------------------------------------------------------------------------
-- Marketing: coupons
-- -----------------------------------------------------------------------------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,32}$'),
  description text,
  discount_type text not null check (discount_type in ('percent', 'fixed', 'free_shipping')),
  -- percent: 1-100 ; fixed: paise ; free_shipping: ignored
  discount_value int not null default 0 check (discount_value >= 0),
  min_subtotal_paise int not null default 0 check (min_subtotal_paise >= 0),
  max_discount_paise int check (max_discount_paise is null or max_discount_paise > 0),
  usage_limit int check (usage_limit is null or usage_limit > 0),
  per_customer_limit int check (per_customer_limit is null or per_customer_limit > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_percent_range check (discount_type <> 'percent' or discount_value between 1 and 100),
  constraint coupons_dates check (starts_at is null or ends_at is null or ends_at > starts_at)
);

-- -----------------------------------------------------------------------------
-- Shipping
-- -----------------------------------------------------------------------------
create table public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  is_active boolean not null default true,
  sort_order int not null default 0,
  match_type text not null default 'all' check (match_type in ('all', 'states', 'pincode_prefixes')),
  states text[] not null default '{}',
  pincode_prefixes text[] not null default '{}',
  rate_type text not null default 'flat' check (rate_type in ('flat', 'weight')),
  flat_rate_paise int not null default 0 check (flat_rate_paise >= 0),
  base_weight_grams int not null default 500 check (base_weight_grams > 0),
  base_rate_paise int not null default 0 check (base_rate_paise >= 0),
  additional_weight_step_grams int not null default 500 check (additional_weight_step_grams > 0),
  additional_rate_paise int not null default 0 check (additional_rate_paise >= 0),
  free_shipping_threshold_paise int check (free_shipping_threshold_paise is null or free_shipping_threshold_paise >= 0),
  cod_available boolean not null default false,
  -- Shown to customers only when the owner fills it in. Never promised by default.
  delivery_estimate text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Carts (server-side; accessed only through trusted server code)
-- -----------------------------------------------------------------------------
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  email text,
  recovery_consent boolean not null default false,
  status text not null default 'active' check (status in ('active', 'converted', 'merged')),
  coupon_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index carts_one_active_per_user on public.carts (user_id) where status = 'active' and user_id is not null;
create index carts_updated_idx on public.carts (status, updated_at);

create table public.cart_items (
  cart_id uuid not null references public.carts (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  quantity int not null check (quantity between 1 and 99),
  added_at timestamptz not null default now(),
  primary key (cart_id, variant_id)
);

-- -----------------------------------------------------------------------------
-- Orders
-- -----------------------------------------------------------------------------
create sequence public.order_number_seq start with 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('UNAR-' || lpad(nextval('public.order_number_seq')::text, 6, '0')),
  user_id uuid references auth.users (id) on delete set null,
  cart_id uuid references public.carts (id) on delete set null,
  email text not null check (char_length(email) <= 254),
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  shipping_address jsonb not null,
  billing_address jsonb,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'placed', 'cancelled', 'expired', 'payment_failed')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'failed', 'refunded', 'partially_refunded', 'cod_pending', 'cod_collected')),
  fulfillment_status text not null default 'unfulfilled'
    check (fulfillment_status in ('unfulfilled', 'processing', 'packed', 'shipped', 'delivered', 'returned', 'cancelled')),
  payment_method text not null check (payment_method in ('razorpay', 'cod')),
  currency text not null default 'INR' check (currency = 'INR'),
  subtotal_paise int not null check (subtotal_paise >= 0),
  discount_paise int not null default 0 check (discount_paise >= 0),
  shipping_paise int not null default 0 check (shipping_paise >= 0),
  cod_fee_paise int not null default 0 check (cod_fee_paise >= 0),
  tax_paise int not null default 0 check (tax_paise >= 0),
  prices_include_tax boolean not null default true,
  tax_breakdown jsonb not null default '{}'::jsonb,
  total_paise int not null check (total_paise >= 0),
  refunded_paise int not null default 0 check (refunded_paise >= 0),
  coupon_id uuid references public.coupons (id) on delete set null,
  coupon_code text,
  shipping_zone_id uuid references public.shipping_zones (id) on delete set null,
  shipping_method text,
  total_weight_grams int not null default 0,
  customer_note text check (customer_note is null or char_length(customer_note) <= 500),
  needs_attention boolean not null default false,
  attention_reason text,
  access_token_hash text not null,
  reservation_expires_at timestamptz,
  marketing_consent boolean not null default false,
  terms_accepted_at timestamptz,
  placed_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_email_idx on public.orders (lower(email));
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_payment_idx on public.orders (payment_status, paid_at);
create index orders_pending_expiry_idx on public.orders (reservation_expires_at) where status = 'pending_payment';

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  title text not null,
  variant_title text,
  sku text,
  image_url text,
  unit_price_paise int not null check (unit_price_paise >= 0),
  mrp_paise int not null check (mrp_paise >= 0),
  quantity int not null check (quantity > 0),
  line_total_paise int not null check (line_total_paise >= 0),
  weight_grams int not null default 0,
  hsn_code text,
  gst_rate numeric(5, 2),
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  type text not null,
  message text not null,
  visibility text not null default 'internal' check (visibility in ('customer', 'internal')),
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null check (provider in ('razorpay', 'cod')),
  provider_order_id text,
  provider_payment_id text unique,
  amount_paise int not null check (amount_paise >= 0),
  status text not null default 'created'
    check (status in ('created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded')),
  method text,
  error_code text,
  error_description text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);
create index payments_provider_order_idx on public.payments (provider_order_id);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  payment_id uuid references public.payments (id) on delete set null,
  provider text not null default 'razorpay' check (provider in ('razorpay', 'manual')),
  provider_refund_id text unique,
  amount_paise int not null check (amount_paise > 0),
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  reason text,
  restocked boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index refunds_order_idx on public.refunds (order_id);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null default 'manual' check (provider in ('manual', 'shiprocket')),
  carrier text,
  tracking_number text,
  tracking_url text check (tracking_url is null or tracking_url ~* '^https://'),
  status text not null default 'pending'
    check (status in ('pending', 'packed', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'returned', 'cancelled')),
  provider_order_id text,
  provider_shipment_id text,
  awb_code text,
  label_url text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shipments_order_idx on public.shipments (order_id);

create table public.shipment_events (
  id bigint generated always as identity primary key,
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  status text not null,
  description text,
  location text,
  source text not null default 'admin' check (source in ('admin', 'shiprocket')),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index shipment_events_shipment_idx on public.shipment_events (shipment_id, occurred_at);

create table public.coupon_usages (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  discount_paise int not null default 0,
  status text not null default 'reserved' check (status in ('reserved', 'used', 'released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coupon_usages_coupon_idx on public.coupon_usages (coupon_id, status);

create table public.inventory_movements (
  id bigint generated always as identity primary key,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  delta int not null,
  stock_after int not null,
  reason text not null check (reason in (
    'initial', 'restock', 'adjustment', 'correction', 'damage',
    'order_reserved', 'order_released', 'order_cancelled', 'return_restock', 'paid_after_expiry'
  )),
  order_id uuid references public.orders (id) on delete set null,
  note text,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);
create index inventory_movements_created_idx on public.inventory_movements (created_at desc);

-- -----------------------------------------------------------------------------
-- Reviews (moderated; never seeded)
-- -----------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  author_name text not null check (char_length(author_name) between 2 and 60),
  rating int not null check (rating between 1 and 5),
  title text check (title is null or char_length(title) <= 120),
  body text not null check (char_length(body) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'spam')),
  is_verified_purchase boolean not null default false,
  admin_reply text check (admin_reply is null or char_length(admin_reply) <= 1000),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index reviews_one_per_user_product on public.reviews (product_id, user_id) where user_id is not null;
create index reviews_product_status_idx on public.reviews (product_id, status, created_at desc);

-- -----------------------------------------------------------------------------
-- Content management (draft + published rows)
-- -----------------------------------------------------------------------------
create table public.cms_sections (
  id uuid primary key default gen_random_uuid(),
  page text not null default 'home' check (page ~ '^[a-z0-9_-]+$'),
  key text not null check (key ~ '^[a-z0-9_-]+$'),
  type text not null check (type ~ '^[a-z0-9_]+$'),
  state text not null check (state in ('draft', 'published')),
  sort_order int not null default 0,
  is_visible boolean not null default true,
  content jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page, key, state)
);

create table public.cms_pages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null default gen_random_uuid(),
  kind text not null check (kind in ('page', 'policy', 'post')),
  state text not null check (state in ('draft', 'published')),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 160),
  excerpt text check (excerpt is null or char_length(excerpt) <= 400),
  body_md text not null default '',
  cover_image_url text,
  cover_image_alt text,
  author_name text,
  seo_title text,
  seo_description text,
  requires_owner_review boolean not null default false,
  published_at timestamptz,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, state)
);
create unique index cms_pages_published_slug on public.cms_pages (kind, slug) where state = 'published';
create unique index cms_pages_draft_slug on public.cms_pages (kind, slug) where state = 'draft';

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) between 3 and 300),
  answer_md text not null check (char_length(answer_md) between 1 and 4000),
  category text not null default 'General',
  sort_order int not null default 0,
  is_published boolean not null default true,
  show_on_home boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.banners (
  id uuid primary key default gen_random_uuid(),
  placement text not null check (placement in ('announcement', 'home_promo', 'shop_top')),
  title text not null check (char_length(title) between 1 and 160),
  body text check (body is null or char_length(body) <= 400),
  cta_label text,
  cta_url text,
  image_url text,
  image_alt text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.instagram_posts (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  image_alt text not null default '',
  permalink text not null check (permalink ~* '^https://(www\.)?instagram\.com/'),
  caption text,
  is_published boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes int not null,
  width int,
  height int,
  alt text not null default '',
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Customers contacting the business
-- -----------------------------------------------------------------------------
create table public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and char_length(email) <= 254),
  status text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed')),
  consent_text text not null,
  consent_at timestamptz not null default now(),
  source text,
  unsubscribe_token text not null unique,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) <= 254),
  phone text,
  subject text check (subject is null or char_length(subject) <= 160),
  message text not null check (char_length(message) between 10 and 4000),
  status text not null default 'new' check (status in ('new', 'read', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Settings, audit, integrations
-- -----------------------------------------------------------------------------
create table public.settings (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text,
  diff jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text,
  payload jsonb,
  status text not null default 'received' check (status in ('received', 'processed', 'failed', 'ignored')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);

create table public.notification_log (
  id bigint generated always as identity primary key,
  order_id uuid references public.orders (id) on delete cascade,
  template text not null,
  recipient text not null,
  channel text not null default 'email' check (channel in ('email', 'whatsapp')),
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider_message_id text,
  error text,
  created_at timestamptz not null default now()
);
create index notification_log_order_idx on public.notification_log (order_id);

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'staff_members', 'addresses', 'categories', 'products', 'product_variants',
    'coupons', 'shipping_zones', 'carts', 'orders', 'payments', 'refunds', 'shipments',
    'coupon_usages', 'reviews', 'cms_sections', 'cms_pages', 'faqs', 'banners',
    'instagram_posts', 'subscribers', 'contact_messages'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t
    );
  end loop;
end;
$$;

-- Settings has updated_at but no other columns needing the generic trigger name clash
create trigger settings_set_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- New auth users get a profile row automatically
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    lower(new.email),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();
