-- =============================================================================
-- UNAR — roles, permissions and row level security (RLS)
--
-- Every table has RLS enabled. Browser clients (anon key) can only read
-- published catalogue/content. Staff access is granted per permission, and the
-- application ALSO checks the same permissions on every server action.
-- The service-role key (server only) bypasses RLS for trusted operations such
-- as checkout and payment webhooks.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Role → permission matrix (single source of truth, read by the app too)
-- -----------------------------------------------------------------------------
insert into public.role_permissions (role, permission)
select r.role, p.permission
from (values
  ('owner'), ('admin')
) as r(role)
cross join (values
  ('dashboard.view'), ('products.read'), ('products.write'), ('inventory.read'), ('inventory.write'),
  ('orders.read'), ('orders.write'), ('orders.cancel'), ('orders.refund'), ('customers.read'),
  ('content.write'), ('media.write'), ('marketing.write'), ('reviews.moderate'), ('reports.view'),
  ('shipping.write'), ('settings.write'), ('audit.view')
) as p(permission)
on conflict do nothing;

insert into public.role_permissions (role, permission) values
  ('owner', 'staff.manage'),
  ('content_editor', 'dashboard.view'),
  ('content_editor', 'products.read'),
  ('content_editor', 'products.write'),
  ('content_editor', 'inventory.read'),
  ('content_editor', 'content.write'),
  ('content_editor', 'media.write'),
  ('content_editor', 'reviews.moderate'),
  ('fulfillment', 'dashboard.view'),
  ('fulfillment', 'products.read'),
  ('fulfillment', 'inventory.read'),
  ('fulfillment', 'inventory.write'),
  ('fulfillment', 'orders.read'),
  ('fulfillment', 'orders.write')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Helper functions
-- -----------------------------------------------------------------------------
create or replace function public.is_service_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role';
$$;

create or replace function public.has_permission(perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_members s
    join public.role_permissions rp on rp.role = s.role
    where s.user_id = (select auth.uid())
      and rp.permission = perm
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff_members where user_id = (select auth.uid()));
$$;

create or replace function public.my_staff_access()
returns table (role text, permissions text[])
language sql
stable
security definer
set search_path = ''
as $$
  select s.role, coalesce(array_agg(rp.permission order by rp.permission) filter (where rp.permission is not null), '{}')
  from public.staff_members s
  left join public.role_permissions rp on rp.role = s.role
  where s.user_id = (select auth.uid())
  group by s.role;
$$;

-- Raises an exception unless the caller is the service role or has `perm`.
create or replace function public.assert_permission(perm text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.is_service_role() then
    return;
  end if;
  if not public.has_permission(perm) then
    raise exception 'FORBIDDEN: missing permission %', perm using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.assert_permission(text) from public, anon;
grant execute on function public.has_permission(text) to anon, authenticated, service_role;
grant execute on function public.is_staff() to anon, authenticated, service_role;
grant execute on function public.my_staff_access() to authenticated;
grant execute on function public.assert_permission(text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere
-- -----------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end;
$$;

-- Explicit table privileges (RLS still applies on top of these).
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated;

grant select on
  public.categories, public.products, public.product_categories, public.product_variants,
  public.product_images, public.reviews, public.cms_sections, public.cms_pages, public.faqs,
  public.banners, public.instagram_posts, public.settings, public.shipping_zones
to anon;

grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.rate_limits from anon, authenticated;
revoke all on public.webhook_events from anon;
revoke insert, update, delete on public.webhook_events, public.notification_log from authenticated;
revoke insert, update, delete on public.role_permissions from authenticated;

-- -----------------------------------------------------------------------------
-- Policies
-- (select auth.uid()) / (select public.has_permission(..)) are wrapped in
-- sub-selects so Postgres evaluates them once per statement.
-- -----------------------------------------------------------------------------

-- profiles
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles: staff read" on public.profiles
  for select to authenticated using ((select public.has_permission('customers.read')) or (select public.has_permission('orders.read')));

-- role_permissions
create policy "role_permissions: staff read" on public.role_permissions
  for select to authenticated using ((select public.is_staff()));

-- staff_members
create policy "staff: read own" on public.staff_members
  for select to authenticated using (user_id = (select auth.uid()));
create policy "staff: owner manages" on public.staff_members
  for all to authenticated
  using ((select public.has_permission('staff.manage')))
  with check ((select public.has_permission('staff.manage')));

-- addresses
create policy "addresses: own" on public.addresses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "addresses: staff read" on public.addresses
  for select to authenticated using ((select public.has_permission('customers.read')));

-- categories
create policy "categories: public read active" on public.categories
  for select to anon, authenticated using (is_active);
create policy "categories: staff manage" on public.categories
  for all to authenticated
  using ((select public.has_permission('products.write')))
  with check ((select public.has_permission('products.write')));
create policy "categories: staff read" on public.categories
  for select to authenticated using ((select public.has_permission('products.read')));

-- products
create policy "products: public read published" on public.products
  for select to anon, authenticated using (status = 'published');
create policy "products: staff read" on public.products
  for select to authenticated using ((select public.has_permission('products.read')));
create policy "products: staff manage" on public.products
  for all to authenticated
  using ((select public.has_permission('products.write')))
  with check ((select public.has_permission('products.write')));

-- product_categories
create policy "product_categories: public read" on public.product_categories
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
create policy "product_categories: staff read" on public.product_categories
  for select to authenticated using ((select public.has_permission('products.read')));
create policy "product_categories: staff manage" on public.product_categories
  for all to authenticated
  using ((select public.has_permission('products.write')))
  with check ((select public.has_permission('products.write')));

-- product_variants
create policy "variants: public read" on public.product_variants
  for select to anon, authenticated
  using (is_active and exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
create policy "variants: staff read" on public.product_variants
  for select to authenticated using ((select public.has_permission('products.read')));
create policy "variants: staff manage" on public.product_variants
  for all to authenticated
  using ((select public.has_permission('products.write')))
  with check ((select public.has_permission('products.write')));

-- product_images
create policy "images: public read" on public.product_images
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
create policy "images: staff read" on public.product_images
  for select to authenticated using ((select public.has_permission('products.read')));
create policy "images: staff manage" on public.product_images
  for all to authenticated
  using ((select public.has_permission('products.write')))
  with check ((select public.has_permission('products.write')));

-- coupons & usages (never exposed publicly; validated server-side)
create policy "coupons: staff manage" on public.coupons
  for all to authenticated
  using ((select public.has_permission('marketing.write')))
  with check ((select public.has_permission('marketing.write')));
create policy "coupon_usages: staff read" on public.coupon_usages
  for select to authenticated
  using ((select public.has_permission('marketing.write')) or (select public.has_permission('orders.read')));

-- shipping zones
create policy "shipping_zones: public read active" on public.shipping_zones
  for select to anon, authenticated using (is_active);
create policy "shipping_zones: staff manage" on public.shipping_zones
  for all to authenticated
  using ((select public.has_permission('shipping.write')))
  with check ((select public.has_permission('shipping.write')));
create policy "shipping_zones: staff read" on public.shipping_zones
  for select to authenticated using ((select public.has_permission('orders.read')));

-- carts: only trusted server code (service role) reads/writes carts.
create policy "carts: staff read" on public.carts
  for select to authenticated using ((select public.has_permission('marketing.write')));
create policy "cart_items: staff read" on public.cart_items
  for select to authenticated using ((select public.has_permission('marketing.write')));

-- orders
create policy "orders: customer read own" on public.orders
  for select to authenticated using (user_id = (select auth.uid()));
create policy "orders: staff read" on public.orders
  for select to authenticated using ((select public.has_permission('orders.read')));
create policy "orders: staff update" on public.orders
  for update to authenticated
  using ((select public.has_permission('orders.write')))
  with check ((select public.has_permission('orders.write')));

create policy "order_items: customer read own" on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));
create policy "order_items: staff read" on public.order_items
  for select to authenticated using ((select public.has_permission('orders.read')));

create policy "order_events: customer read own" on public.order_events
  for select to authenticated
  using (visibility = 'customer' and exists (
    select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())
  ));
create policy "order_events: staff read" on public.order_events
  for select to authenticated using ((select public.has_permission('orders.read')));
create policy "order_events: staff insert" on public.order_events
  for insert to authenticated
  with check ((select public.has_permission('orders.write')) and actor_id = (select auth.uid()));

create policy "payments: staff read" on public.payments
  for select to authenticated using ((select public.has_permission('orders.read')));
create policy "refunds: staff read" on public.refunds
  for select to authenticated using ((select public.has_permission('orders.read')));

create policy "shipments: customer read own" on public.shipments
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));
create policy "shipments: staff read" on public.shipments
  for select to authenticated using ((select public.has_permission('orders.read')));
create policy "shipments: staff manage" on public.shipments
  for all to authenticated
  using ((select public.has_permission('orders.write')))
  with check ((select public.has_permission('orders.write')));

create policy "shipment_events: customer read own" on public.shipment_events
  for select to authenticated
  using (exists (
    select 1 from public.shipments s join public.orders o on o.id = s.order_id
    where s.id = shipment_id and o.user_id = (select auth.uid())
  ));
create policy "shipment_events: staff read" on public.shipment_events
  for select to authenticated using ((select public.has_permission('orders.read')));
create policy "shipment_events: staff manage" on public.shipment_events
  for all to authenticated
  using ((select public.has_permission('orders.write')))
  with check ((select public.has_permission('orders.write')));

-- inventory movements (written only by security-definer functions)
create policy "inventory_movements: staff read" on public.inventory_movements
  for select to authenticated using ((select public.has_permission('inventory.read')));

-- reviews
create policy "reviews: public read approved" on public.reviews
  for select to anon, authenticated using (status = 'approved');
create policy "reviews: author reads own" on public.reviews
  for select to authenticated using (user_id = (select auth.uid()));
create policy "reviews: staff moderate" on public.reviews
  for all to authenticated
  using ((select public.has_permission('reviews.moderate')))
  with check ((select public.has_permission('reviews.moderate')));

-- CMS
create policy "cms_sections: public read published" on public.cms_sections
  for select to anon, authenticated using (state = 'published' and is_visible);
create policy "cms_sections: staff manage" on public.cms_sections
  for all to authenticated
  using ((select public.has_permission('content.write')))
  with check ((select public.has_permission('content.write')));

create policy "cms_pages: public read published" on public.cms_pages
  for select to anon, authenticated using (state = 'published');
create policy "cms_pages: staff manage" on public.cms_pages
  for all to authenticated
  using ((select public.has_permission('content.write')))
  with check ((select public.has_permission('content.write')));

create policy "faqs: public read published" on public.faqs
  for select to anon, authenticated using (is_published);
create policy "faqs: staff manage" on public.faqs
  for all to authenticated
  using ((select public.has_permission('content.write')))
  with check ((select public.has_permission('content.write')));

create policy "banners: public read active" on public.banners
  for select to anon, authenticated
  using (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));
create policy "banners: staff manage" on public.banners
  for all to authenticated
  using ((select public.has_permission('content.write')))
  with check ((select public.has_permission('content.write')));

create policy "instagram: public read published" on public.instagram_posts
  for select to anon, authenticated using (is_published);
create policy "instagram: staff manage" on public.instagram_posts
  for all to authenticated
  using ((select public.has_permission('content.write')))
  with check ((select public.has_permission('content.write')));

create policy "media: staff read" on public.media_assets
  for select to authenticated
  using ((select public.has_permission('media.write')) or (select public.has_permission('products.write')));
create policy "media: staff manage" on public.media_assets
  for all to authenticated
  using ((select public.has_permission('media.write')))
  with check ((select public.has_permission('media.write')));

-- subscribers & contact messages (inserted by server code after validation)
create policy "subscribers: staff manage" on public.subscribers
  for all to authenticated
  using ((select public.has_permission('marketing.write')))
  with check ((select public.has_permission('marketing.write')));
create policy "contact_messages: staff manage" on public.contact_messages
  for all to authenticated
  using ((select public.has_permission('customers.read')))
  with check ((select public.has_permission('customers.read')));

-- settings
create policy "settings: public read" on public.settings
  for select to anon, authenticated using (is_public);
create policy "settings: staff read" on public.settings
  for select to authenticated using ((select public.is_staff()));
create policy "settings: staff manage" on public.settings
  for all to authenticated
  using ((select public.has_permission('settings.write')))
  with check ((select public.has_permission('settings.write')));

-- audit, webhooks, notifications
create policy "audit_logs: staff read" on public.audit_logs
  for select to authenticated using ((select public.has_permission('audit.view')));
create policy "webhook_events: staff read" on public.webhook_events
  for select to authenticated using ((select public.has_permission('settings.write')));
create policy "notification_log: staff read" on public.notification_log
  for select to authenticated using ((select public.has_permission('orders.read')));
