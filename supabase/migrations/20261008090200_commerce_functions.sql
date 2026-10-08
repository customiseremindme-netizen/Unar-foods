-- =============================================================================
-- UNAR — transactional commerce functions
--
-- These functions run inside a single database transaction each, with row
-- locks (SELECT ... FOR UPDATE) so that concurrent checkouts, webhook retries
-- and admin actions can never oversell stock or apply a payment twice.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Internal helpers (not callable through the API)
-- -----------------------------------------------------------------------------
create or replace function public._order_event(p_order_id uuid, p_type text, p_message text, p_visibility text, p_actor uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.order_events (order_id, type, message, visibility, actor_id)
  values (p_order_id, p_type, p_message, p_visibility, p_actor);
$$;

-- Returns all reserved items of an order to stock.
create or replace function public._restock_order_items(p_order_id uuid, p_reason text, p_note text, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_stock int;
begin
  for v_item in
    select variant_id, sum(quantity)::int as quantity
    from public.order_items
    where order_id = p_order_id and variant_id is not null
    group by variant_id
    order by variant_id
  loop
    update public.product_variants
      set stock = stock + v_item.quantity
      where id = v_item.variant_id
      returning stock into v_stock;
    if found then
      insert into public.inventory_movements (variant_id, delta, stock_after, reason, order_id, note, actor_id)
      values (v_item.variant_id, v_item.quantity, v_stock, p_reason, p_order_id, p_note, p_actor);
    end if;
  end loop;
end;
$$;

-- Empties the cart an order was placed from (after payment / COD placement).
create or replace function public._clear_order_cart(p_order_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.cart_items where cart_id = (select cart_id from public.orders where id = p_order_id);
  update public.carts set status = 'converted', coupon_code = null
    where id = (select cart_id from public.orders where id = p_order_id) and status = 'active';
$$;

revoke execute on function public._order_event(uuid, text, text, text, uuid) from public, anon, authenticated, service_role;
revoke execute on function public._restock_order_items(uuid, text, text, uuid) from public, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- create_order: validates prices & stock, reserves stock, records coupon usage.
-- Called only by trusted server code (service role) after it has computed the
-- quote from database prices. Re-verifies everything under row locks.
-- -----------------------------------------------------------------------------
create or replace function public.create_order(p_order jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
  v_variant record;
  v_qty int;
  v_subtotal int := 0;
  v_weight int := 0;
  v_is_cod boolean := (p_order ->> 'payment_method') = 'cod';
  v_email text := lower(trim(p_order ->> 'email'));
  v_user_id uuid := nullif(p_order ->> 'user_id', '')::uuid;
  v_coupon record;
  v_count int;
  v_minutes int := greatest(5, least(120, coalesce((p_order ->> 'reservation_minutes')::int, 30)));
  v_prices_include_tax boolean := coalesce((p_order ->> 'prices_include_tax')::boolean, true);
  v_discount int := coalesce((p_order ->> 'discount_paise')::int, 0);
  v_shipping int := coalesce((p_order ->> 'shipping_paise')::int, 0);
  v_cod_fee int := coalesce((p_order ->> 'cod_fee_paise')::int, 0);
  v_tax int := coalesce((p_order ->> 'tax_paise')::int, 0);
  v_total int := (p_order ->> 'total_paise')::int;
  v_expected_total int;
begin
  if not public.is_service_role() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'TOO_MANY_ITEMS';
  end if;

  insert into public.orders (
    user_id, cart_id, email, phone, customer_name, shipping_address, billing_address,
    status, payment_status, payment_method,
    subtotal_paise, discount_paise, shipping_paise, cod_fee_paise, tax_paise,
    prices_include_tax, tax_breakdown, total_paise,
    coupon_id, coupon_code, shipping_zone_id, shipping_method,
    customer_note, access_token_hash, reservation_expires_at,
    marketing_consent, terms_accepted_at, placed_at
  ) values (
    v_user_id, nullif(p_order ->> 'cart_id', '')::uuid, v_email, p_order ->> 'phone', p_order ->> 'customer_name',
    p_order -> 'shipping_address', p_order -> 'billing_address',
    case when v_is_cod then 'placed' else 'pending_payment' end,
    case when v_is_cod then 'cod_pending' else 'unpaid' end,
    case when v_is_cod then 'cod' else 'razorpay' end,
    0, v_discount, v_shipping, v_cod_fee, v_tax,
    v_prices_include_tax, coalesce(p_order -> 'tax_breakdown', '{}'::jsonb), coalesce(v_total, 0),
    nullif(p_order ->> 'coupon_id', '')::uuid, nullif(p_order ->> 'coupon_code', ''),
    nullif(p_order ->> 'shipping_zone_id', '')::uuid, p_order ->> 'shipping_method',
    nullif(p_order ->> 'customer_note', ''), p_order ->> 'access_token_hash',
    case when v_is_cod then null else now() + make_interval(mins => v_minutes) end,
    coalesce((p_order ->> 'marketing_consent')::boolean, false),
    case when coalesce((p_order ->> 'terms_accepted')::boolean, false) then now() end,
    case when v_is_cod then now() end
  )
  returning id, order_number into v_order_id, v_order_number;

  -- Lock variants in a consistent order to avoid deadlocks between checkouts.
  for v_item in
    select value from jsonb_array_elements(p_items) order by value ->> 'variant_id'
  loop
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 99 then
      raise exception 'INVALID_QUANTITY';
    end if;

    select
      pv.id, pv.sku, pv.title as variant_title, pv.price_paise, pv.mrp_paise, pv.stock,
      pv.weight_grams, pv.is_active, p.id as product_id, p.title as product_title,
      p.status as product_status, p.hsn_code, p.gst_rate,
      (select pi.url from public.product_images pi where pi.product_id = p.id order by pi.sort_order, pi.created_at limit 1) as image_url
    into v_variant
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = (v_item ->> 'variant_id')::uuid
    for update of pv;

    if not found then
      raise exception 'UNAVAILABLE:%', v_item ->> 'variant_id';
    end if;
    if not v_variant.is_active or v_variant.product_status <> 'published' then
      raise exception 'UNAVAILABLE:%', v_variant.sku;
    end if;
    if v_variant.price_paise <> (v_item ->> 'unit_price_paise')::int then
      raise exception 'PRICE_CHANGED:%', v_variant.sku;
    end if;
    if v_variant.stock < v_qty then
      raise exception 'INSUFFICIENT_STOCK:%', v_variant.sku;
    end if;

    update public.product_variants set stock = stock - v_qty where id = v_variant.id;

    insert into public.order_items (
      order_id, product_id, variant_id, title, variant_title, sku, image_url,
      unit_price_paise, mrp_paise, quantity, line_total_paise, weight_grams, hsn_code, gst_rate
    ) values (
      v_order_id, v_variant.product_id, v_variant.id, v_variant.product_title, v_variant.variant_title,
      v_variant.sku, v_variant.image_url, v_variant.price_paise, v_variant.mrp_paise, v_qty,
      v_variant.price_paise * v_qty, v_variant.weight_grams * v_qty, v_variant.hsn_code, v_variant.gst_rate
    );

    insert into public.inventory_movements (variant_id, delta, stock_after, reason, order_id, note)
    values (v_variant.id, -v_qty, v_variant.stock - v_qty, 'order_reserved', v_order_id, 'Reserved for ' || v_order_number);

    v_subtotal := v_subtotal + v_variant.price_paise * v_qty;
    v_weight := v_weight + v_variant.weight_grams * v_qty;
  end loop;

  if v_subtotal <> (p_order ->> 'subtotal_paise')::int then
    raise exception 'TOTAL_MISMATCH';
  end if;
  if v_discount > v_subtotal then
    raise exception 'TOTAL_MISMATCH';
  end if;
  v_expected_total := v_subtotal - v_discount + v_shipping + v_cod_fee;
  if not v_prices_include_tax then
    v_expected_total := v_expected_total + v_tax;
  end if;
  if v_total is null or v_total <> v_expected_total then
    raise exception 'TOTAL_MISMATCH';
  end if;

  update public.orders
    set subtotal_paise = v_subtotal, total_weight_grams = v_weight
    where id = v_order_id;

  -- Coupon: re-validated under lock so usage limits are race-safe.
  if nullif(p_order ->> 'coupon_id', '') is not null then
    select * into v_coupon from public.coupons where id = (p_order ->> 'coupon_id')::uuid for update;
    if not found or not v_coupon.is_active
       or (v_coupon.starts_at is not null and v_coupon.starts_at > now())
       or (v_coupon.ends_at is not null and v_coupon.ends_at <= now())
       or v_subtotal < v_coupon.min_subtotal_paise then
      raise exception 'COUPON_INVALID';
    end if;
    if v_coupon.usage_limit is not null then
      select count(*) into v_count from public.coupon_usages
        where coupon_id = v_coupon.id and status in ('reserved', 'used');
      if v_count >= v_coupon.usage_limit then
        raise exception 'COUPON_LIMIT_REACHED';
      end if;
    end if;
    if v_coupon.per_customer_limit is not null then
      select count(*) into v_count from public.coupon_usages
        where coupon_id = v_coupon.id and status in ('reserved', 'used')
          and (lower(email) = v_email or (v_user_id is not null and user_id = v_user_id));
      if v_count >= v_coupon.per_customer_limit then
        raise exception 'COUPON_CUSTOMER_LIMIT';
      end if;
    end if;
    insert into public.coupon_usages (coupon_id, order_id, user_id, email, discount_paise, status)
    values (v_coupon.id, v_order_id, v_user_id, v_email, v_discount, case when v_is_cod then 'used' else 'reserved' end);
  end if;

  if v_is_cod then
    insert into public.payments (order_id, provider, amount_paise, status, method)
    values (v_order_id, 'cod', v_total, 'created', 'cod');
    perform public._order_event(v_order_id, 'placed', 'Order placed — Cash on Delivery.', 'customer', null);
    perform public._clear_order_cart(v_order_id);
  else
    perform public._order_event(v_order_id, 'created', 'Order created. Waiting for online payment.', 'internal', null);
  end if;

  return jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number);
end;
$$;

-- -----------------------------------------------------------------------------
-- attach_provider_order: stores the Razorpay order id against our order.
-- -----------------------------------------------------------------------------
create or replace function public.attach_provider_order(p_order_id uuid, p_provider_order_id text, p_amount_paise int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_service_role() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.payments (order_id, provider, provider_order_id, amount_paise, status)
  values (p_order_id, 'razorpay', p_provider_order_id, p_amount_paise, 'created');
end;
$$;

-- -----------------------------------------------------------------------------
-- mark_order_paid: idempotent. Safe to call from the browser-verification
-- endpoint AND the webhook for the same payment, in any order, many times.
-- Returns: paid | already_paid | paid_needs_attention | amount_mismatch
-- -----------------------------------------------------------------------------
create or replace function public.mark_order_paid(
  p_order_id uuid,
  p_provider_order_id text,
  p_provider_payment_id text,
  p_amount_paise int,
  p_method text,
  p_payment_status text,
  p_raw jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_payment_id uuid;
  v_item record;
  v_stock int;
  v_can_reserve boolean := true;
  v_status text := case when p_payment_status = 'authorized' then 'authorized' else 'captured' end;
begin
  if not public.is_service_role() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  -- Record the payment (one row per provider payment id).
  select id into v_payment_id from public.payments where provider_payment_id = p_provider_payment_id;
  if v_payment_id is null then
    select id into v_payment_id from public.payments
      where order_id = p_order_id and provider = 'razorpay'
        and provider_order_id = p_provider_order_id and provider_payment_id is null
      order by created_at
      limit 1;
  end if;

  if v_payment_id is null then
    insert into public.payments (order_id, provider, provider_order_id, provider_payment_id, amount_paise, status, method, raw)
    values (p_order_id, 'razorpay', p_provider_order_id, p_provider_payment_id, p_amount_paise, v_status, p_method, p_raw);
  else
    update public.payments
      set provider_payment_id = p_provider_payment_id,
          amount_paise = p_amount_paise,
          status = case when status in ('refunded', 'partially_refunded') then status else v_status end,
          method = coalesce(p_method, method),
          raw = coalesce(p_raw, raw),
          error_code = null,
          error_description = null
      where id = v_payment_id;
  end if;

  if v_order.payment_status in ('paid', 'refunded', 'partially_refunded') then
    if exists (
      select 1 from public.payments
      where order_id = p_order_id and status in ('captured', 'authorized')
        and provider_payment_id is not null and provider_payment_id <> p_provider_payment_id
    ) then
      update public.orders
        set needs_attention = true,
            attention_reason = 'More than one successful payment was received for this order. Refund the duplicate payment.'
        where id = p_order_id and not needs_attention;
    end if;
    return 'already_paid';
  end if;

  if p_amount_paise <> v_order.total_paise then
    update public.orders
      set needs_attention = true,
          attention_reason = format('Payment amount (%s paise) does not match the order total (%s paise). Check this payment in Razorpay.', p_amount_paise, v_order.total_paise)
      where id = p_order_id;
    perform public._order_event(p_order_id, 'payment_mismatch', 'Payment amount did not match the order total.', 'internal', null);
    return 'amount_mismatch';
  end if;

  if v_order.status = 'pending_payment' then
    update public.orders
      set status = 'placed', payment_status = 'paid', paid_at = now(), placed_at = now(),
          reservation_expires_at = null
      where id = p_order_id;
    update public.coupon_usages set status = 'used' where order_id = p_order_id;
    perform public._order_event(p_order_id, 'paid', 'Payment received. Your order is confirmed.', 'customer', null);
    perform public._clear_order_cart(p_order_id);
    return 'paid';
  end if;

  -- The reservation had already been released (expired / failed / cancelled)
  -- but the customer's payment went through. Try to re-reserve the stock.
  for v_item in
    select variant_id, sum(quantity)::int as quantity
    from public.order_items where order_id = p_order_id and variant_id is not null
    group by variant_id order by variant_id
  loop
    select stock into v_stock from public.product_variants where id = v_item.variant_id for update;
    if v_stock is null or v_stock < v_item.quantity then
      v_can_reserve := false;
    end if;
  end loop;

  if v_can_reserve then
    for v_item in
      select variant_id, sum(quantity)::int as quantity
      from public.order_items where order_id = p_order_id and variant_id is not null
      group by variant_id order by variant_id
    loop
      update public.product_variants set stock = stock - v_item.quantity
        where id = v_item.variant_id returning stock into v_stock;
      insert into public.inventory_movements (variant_id, delta, stock_after, reason, order_id, note)
      values (v_item.variant_id, -v_item.quantity, v_stock, 'paid_after_expiry', p_order_id,
              'Stock re-reserved: payment arrived after reservation was released');
    end loop;
  end if;

  update public.coupon_usages set status = 'used' where order_id = p_order_id;
  update public.orders
    set status = 'placed', payment_status = 'paid', paid_at = now(), placed_at = coalesce(placed_at, now()),
        fulfillment_status = 'unfulfilled', cancelled_at = null, cancel_reason = null,
        reservation_expires_at = null,
        needs_attention = not v_can_reserve,
        attention_reason = case when v_can_reserve then null
          else 'Payment arrived after the stock reservation expired and there is not enough stock left. Restock or refund this order.' end
    where id = p_order_id;
  perform public._order_event(p_order_id, 'paid', 'Payment received. Your order is confirmed.', 'customer', null);
  perform public._clear_order_cart(p_order_id);
  return case when v_can_reserve then 'paid' else 'paid_needs_attention' end;
end;
$$;

-- -----------------------------------------------------------------------------
-- record_payment_failure: logs a failed attempt. The order stays open so the
-- customer can retry until the reservation expires.
-- -----------------------------------------------------------------------------
create or replace function public.record_payment_failure(
  p_order_id uuid,
  p_provider_order_id text,
  p_provider_payment_id text,
  p_error_code text,
  p_error_description text,
  p_raw jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_service_role() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_provider_payment_id is not null then
    insert into public.payments (order_id, provider, provider_order_id, provider_payment_id, amount_paise, status, error_code, error_description, raw)
    select p_order_id, 'razorpay', p_provider_order_id, p_provider_payment_id, o.total_paise, 'failed',
           left(p_error_code, 100), left(p_error_description, 500), p_raw
    from public.orders o where o.id = p_order_id
    on conflict (provider_payment_id) do update
      set status = case when public.payments.status in ('captured', 'authorized', 'refunded', 'partially_refunded')
                        then public.payments.status else 'failed' end,
          error_code = excluded.error_code,
          error_description = excluded.error_description;
  end if;
  perform public._order_event(p_order_id, 'payment_failed',
    'Payment attempt failed: ' || coalesce(left(p_error_description, 200), 'unknown reason'), 'internal', null);
end;
$$;

-- -----------------------------------------------------------------------------
-- release_order: returns reserved stock for an unpaid order.
-- p_new_status: expired | payment_failed | cancelled
-- -----------------------------------------------------------------------------
create or replace function public.release_order(p_order_id uuid, p_new_status text, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_service_role() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_new_status not in ('expired', 'payment_failed', 'cancelled') then
    raise exception 'INVALID_STATUS';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.status <> 'pending_payment' or v_order.payment_status = 'paid' then
    return false;
  end if;

  perform public._restock_order_items(p_order_id, 'order_released', 'Released: ' || p_new_status, null);
  update public.coupon_usages set status = 'released' where order_id = p_order_id;
  update public.orders
    set status = p_new_status,
        payment_status = case when p_new_status = 'payment_failed' then 'failed' else payment_status end,
        cancelled_at = now(),
        cancel_reason = left(p_reason, 300),
        reservation_expires_at = null
    where id = p_order_id;
  perform public._order_event(p_order_id, p_new_status,
    case p_new_status
      when 'expired' then 'Order expired because payment was not completed in time.'
      when 'payment_failed' then 'Payment was not completed. The order was not placed.'
      else 'Order cancelled before payment.'
    end, 'customer', null);
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- admin_cancel_order: cancels a placed order (before shipping).
-- Refunds are handled separately (record_refund) after the Razorpay API call.
-- -----------------------------------------------------------------------------
create or replace function public.admin_cancel_order(p_order_id uuid, p_reason text, p_restock boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_actor uuid := auth.uid();
begin
  perform public.assert_permission('orders.cancel');

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.status in ('cancelled', 'expired', 'payment_failed') then
    return 'already_closed';
  end if;
  if v_order.fulfillment_status in ('shipped', 'delivered', 'returned') then
    raise exception 'CANNOT_CANCEL_SHIPPED';
  end if;

  if v_order.status = 'pending_payment' or p_restock then
    perform public._restock_order_items(p_order_id,
      case when v_order.status = 'pending_payment' then 'order_released' else 'order_cancelled' end,
      'Cancelled by staff', v_actor);
  end if;

  update public.coupon_usages set status = 'released' where order_id = p_order_id;
  update public.orders
    set status = 'cancelled',
        fulfillment_status = 'cancelled',
        payment_status = case when payment_status = 'cod_pending' then 'unpaid' else payment_status end,
        cancelled_at = now(),
        cancel_reason = left(p_reason, 300),
        reservation_expires_at = null
    where id = p_order_id;
  perform public._order_event(p_order_id, 'cancelled',
    'Order cancelled' || case when coalesce(p_reason, '') <> '' then ': ' || left(p_reason, 200) else '.' end,
    'customer', v_actor);
  return 'cancelled';
end;
$$;

-- -----------------------------------------------------------------------------
-- set_fulfillment_status: validated status changes with timeline entries.
-- -----------------------------------------------------------------------------
create or replace function public.set_fulfillment_status(p_order_id uuid, p_status text, p_message text, p_customer_visible boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_actor uuid := auth.uid();
begin
  perform public.assert_permission('orders.write');
  if p_status not in ('unfulfilled', 'processing', 'packed', 'shipped', 'delivered', 'returned') then
    raise exception 'INVALID_STATUS';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'placed' then
    raise exception 'ORDER_NOT_PLACED';
  end if;
  if v_order.payment_method = 'razorpay' and v_order.payment_status not in ('paid', 'partially_refunded') then
    raise exception 'ORDER_NOT_PAID';
  end if;

  update public.orders
    set fulfillment_status = p_status,
        shipped_at = case when p_status = 'shipped' then coalesce(shipped_at, now()) else shipped_at end,
        delivered_at = case when p_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end
    where id = p_order_id;

  perform public._order_event(
    p_order_id,
    'fulfillment_' || p_status,
    coalesce(nullif(trim(p_message), ''), 'Order status updated: ' || replace(p_status, '_', ' ') || '.'),
    case when p_customer_visible then 'customer' else 'internal' end,
    v_actor
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- mark_cod_collected
-- -----------------------------------------------------------------------------
create or replace function public.mark_cod_collected(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  perform public.assert_permission('orders.write');
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.payment_method <> 'cod' or v_order.payment_status <> 'cod_pending' then
    raise exception 'NOT_COD_PENDING';
  end if;
  update public.orders set payment_status = 'cod_collected', paid_at = now() where id = p_order_id;
  update public.payments set status = 'captured' where order_id = p_order_id and provider = 'cod';
  perform public._order_event(p_order_id, 'cod_collected', 'Cash on Delivery payment collected.', 'internal', auth.uid());
end;
$$;

-- -----------------------------------------------------------------------------
-- record_refund: called after a successful refund API call (or for a manual
-- refund made outside Razorpay). Idempotent per provider refund id.
-- -----------------------------------------------------------------------------
create or replace function public.record_refund(
  p_order_id uuid,
  p_provider text,
  p_provider_refund_id text,
  p_amount_paise int,
  p_status text,
  p_reason text,
  p_restock boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_refund_id uuid;
  v_payment_id uuid;
  v_new_refunded int;
  v_already_restocked boolean;
begin
  perform public.assert_permission('orders.refund');
  if p_amount_paise is null or p_amount_paise <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if p_status not in ('pending', 'processed') then
    raise exception 'INVALID_STATUS';
  end if;

  if p_provider_refund_id is not null then
    select id into v_refund_id from public.refunds where provider_refund_id = p_provider_refund_id;
    if v_refund_id is not null then
      return v_refund_id;
    end if;
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.payment_status not in ('paid', 'partially_refunded', 'cod_collected') then
    raise exception 'ORDER_NOT_PAID';
  end if;
  if v_order.refunded_paise + p_amount_paise > v_order.total_paise then
    raise exception 'REFUND_EXCEEDS_TOTAL';
  end if;

  select id into v_payment_id from public.payments
    where order_id = p_order_id and status in ('captured', 'authorized', 'partially_refunded')
    order by created_at desc limit 1;

  select exists (select 1 from public.refunds where order_id = p_order_id and restocked) into v_already_restocked;

  insert into public.refunds (order_id, payment_id, provider, provider_refund_id, amount_paise, status, reason, restocked, created_by)
  values (p_order_id, v_payment_id, p_provider, p_provider_refund_id, p_amount_paise, p_status, left(p_reason, 300),
          coalesce(p_restock, false) and not v_already_restocked, auth.uid())
  returning id into v_refund_id;

  v_new_refunded := v_order.refunded_paise + p_amount_paise;
  update public.orders
    set refunded_paise = v_new_refunded,
        payment_status = case when v_new_refunded >= total_paise then 'refunded' else 'partially_refunded' end
    where id = p_order_id;
  if v_payment_id is not null then
    update public.payments
      set status = case when v_new_refunded >= v_order.total_paise then 'refunded' else 'partially_refunded' end
      where id = v_payment_id;
  end if;

  if coalesce(p_restock, false) and not v_already_restocked then
    perform public._restock_order_items(p_order_id, 'return_restock', 'Restocked with refund', auth.uid());
  end if;

  perform public._order_event(p_order_id, 'refund',
    format('Refund of ₹%s %s.', to_char(p_amount_paise / 100.0, 'FM999999990.00'),
      case when p_status = 'processed' then 'processed' else 'initiated' end),
    'customer', auth.uid());
  return v_refund_id;
end;
$$;

-- Webhook: refund status updates from Razorpay.
create or replace function public.update_refund_status(p_provider_refund_id text, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund public.refunds%rowtype;
  v_order public.orders%rowtype;
  v_new_refunded int;
begin
  if not public.is_service_role() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into v_refund from public.refunds where provider_refund_id = p_provider_refund_id for update;
  if not found or v_refund.status = p_status or v_refund.status = 'failed' then
    return;
  end if;
  update public.refunds set status = p_status where id = v_refund.id;
  if p_status = 'failed' then
    select * into v_order from public.orders where id = v_refund.order_id for update;
    v_new_refunded := greatest(0, v_order.refunded_paise - v_refund.amount_paise);
    update public.orders
      set refunded_paise = v_new_refunded,
          payment_status = case when v_new_refunded = 0 then 'paid' else 'partially_refunded' end,
          needs_attention = true,
          attention_reason = 'A refund failed at Razorpay. Check the refund in your Razorpay dashboard.'
      where id = v_order.id;
    perform public._order_event(v_order.id, 'refund_failed', 'Refund failed at the payment provider.', 'internal', null);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Inventory adjustments with an audit trail
-- -----------------------------------------------------------------------------
create or replace function public.adjust_stock(p_variant_id uuid, p_delta int, p_reason text, p_note text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock int;
begin
  perform public.assert_permission('inventory.write');
  if p_reason not in ('initial', 'restock', 'adjustment', 'correction', 'damage', 'return_restock') then
    raise exception 'INVALID_REASON';
  end if;
  if p_delta = 0 then
    raise exception 'ZERO_DELTA';
  end if;
  select stock into v_stock from public.product_variants where id = p_variant_id for update;
  if not found then
    raise exception 'VARIANT_NOT_FOUND';
  end if;
  if v_stock + p_delta < 0 then
    raise exception 'NEGATIVE_STOCK';
  end if;
  update public.product_variants
    set stock = stock + p_delta,
        is_demo_stock = false
    where id = p_variant_id
    returning stock into v_stock;
  insert into public.inventory_movements (variant_id, delta, stock_after, reason, note, actor_id)
  values (p_variant_id, p_delta, v_stock, p_reason, left(p_note, 300), auth.uid());
  return v_stock;
end;
$$;

-- -----------------------------------------------------------------------------
-- Rate limiting (fixed window, shared across all server instances)
-- -----------------------------------------------------------------------------
create or replace function public.check_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count int;
begin
  if not public.is_service_role() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.rate_limits (key, window_start, count)
  values (left(p_key, 200), v_window, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;

create or replace function public.cleanup_rate_limits()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.rate_limits where window_start < now() - interval '1 day';
$$;

-- -----------------------------------------------------------------------------
-- Content publishing
-- -----------------------------------------------------------------------------
create or replace function public.publish_sections(p_page text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_permission('content.write');
  delete from public.cms_sections where page = p_page and state = 'published';
  insert into public.cms_sections (page, key, type, state, sort_order, is_visible, content, updated_by, published_at)
  select page, key, type, 'published', sort_order, is_visible, content, auth.uid(), now()
  from public.cms_sections
  where page = p_page and state = 'draft';
end;
$$;

create or replace function public.discard_section_drafts(p_page text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_permission('content.write');
  delete from public.cms_sections where page = p_page and state = 'draft';
  insert into public.cms_sections (page, key, type, state, sort_order, is_visible, content, updated_by)
  select page, key, type, 'draft', sort_order, is_visible, content, auth.uid()
  from public.cms_sections
  where page = p_page and state = 'published';
end;
$$;

create or replace function public.publish_cms_page(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.cms_pages%rowtype;
  v_first_published timestamptz;
begin
  perform public.assert_permission('content.write');
  select * into v_draft from public.cms_pages where group_id = p_group_id and state = 'draft';
  if not found then
    raise exception 'DRAFT_NOT_FOUND';
  end if;
  select published_at into v_first_published from public.cms_pages where group_id = p_group_id and state = 'published';
  delete from public.cms_pages where group_id = p_group_id and state = 'published';
  insert into public.cms_pages (
    group_id, kind, state, slug, title, excerpt, body_md, cover_image_url, cover_image_alt, author_name,
    seo_title, seo_description, requires_owner_review, published_at, updated_by
  ) values (
    v_draft.group_id, v_draft.kind, 'published', v_draft.slug, v_draft.title, v_draft.excerpt, v_draft.body_md,
    v_draft.cover_image_url, v_draft.cover_image_alt, v_draft.author_name, v_draft.seo_title,
    v_draft.seo_description, v_draft.requires_owner_review, coalesce(v_first_published, now()), auth.uid()
  );
end;
$$;

create or replace function public.unpublish_cms_page(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_permission('content.write');
  delete from public.cms_pages where group_id = p_group_id and state = 'published';
end;
$$;

-- -----------------------------------------------------------------------------
-- Audit log
-- -----------------------------------------------------------------------------
create or replace function public.log_admin_action(
  p_action text, p_entity_type text, p_entity_id text, p_summary text, p_diff jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.audit_logs (actor_id, actor_email, action, entity_type, entity_id, summary, diff)
  values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    left(p_action, 80), left(p_entity_type, 80), left(p_entity_id, 120), left(p_summary, 500), p_diff
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- First owner account (run once from the Supabase SQL editor)
--   select public.bootstrap_owner('you@example.com');
-- -----------------------------------------------------------------------------
create or replace function public.bootstrap_owner(p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if exists (select 1 from public.staff_members where role = 'owner') then
    raise exception 'An owner already exists. Add more staff from Admin → Staff.';
  end if;
  select id into v_user_id from auth.users
    where lower(email) = lower(trim(p_email)) and email_confirmed_at is not null;
  if v_user_id is null then
    raise exception 'No confirmed account found for %. Sign up on the website and confirm your email first.', p_email;
  end if;
  insert into public.staff_members (user_id, role) values (v_user_id, 'owner');
  return 'Owner access granted to ' || lower(trim(p_email));
end;
$$;

-- -----------------------------------------------------------------------------
-- Reports (owner/admin). All amounts are in paise. Dates use India time.
-- Revenue is recognised when payment is received (paid_at).
-- -----------------------------------------------------------------------------
create or replace function public.report_summary(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform public.assert_permission('reports.view');
  select jsonb_build_object(
    'paid_orders', (select count(*) from public.orders
                    where paid_at >= p_from and paid_at < p_to
                      and payment_status in ('paid', 'partially_refunded', 'refunded', 'cod_collected')),
    'gross_revenue_paise', (select coalesce(sum(total_paise), 0) from public.orders
                    where paid_at >= p_from and paid_at < p_to
                      and payment_status in ('paid', 'partially_refunded', 'refunded', 'cod_collected')),
    'refunds_paise', (select coalesce(sum(amount_paise), 0) from public.refunds
                    where created_at >= p_from and created_at < p_to and status <> 'failed'),
    'discounts_paise', (select coalesce(sum(discount_paise), 0) from public.orders
                    where paid_at >= p_from and paid_at < p_to
                      and payment_status in ('paid', 'partially_refunded', 'refunded', 'cod_collected')),
    'shipping_collected_paise', (select coalesce(sum(shipping_paise), 0) from public.orders
                    where paid_at >= p_from and paid_at < p_to
                      and payment_status in ('paid', 'partially_refunded', 'refunded', 'cod_collected')),
    'orders_to_fulfil', (select count(*) from public.orders
                    where status = 'placed' and fulfillment_status in ('unfulfilled', 'processing', 'packed')
                      and payment_status in ('paid', 'partially_refunded', 'cod_pending')),
    'awaiting_payment', (select count(*) from public.orders where status = 'pending_payment'),
    'cod_pending_orders', (select count(*) from public.orders where status = 'placed' and payment_status = 'cod_pending'),
    'cod_pending_paise', (select coalesce(sum(total_paise), 0) from public.orders where status = 'placed' and payment_status = 'cod_pending'),
    'needs_attention', (select count(*) from public.orders where needs_attention),
    'low_stock_variants', (select count(*) from public.product_variants where is_active and stock <= low_stock_threshold),
    'new_customers', (select count(*) from public.profiles where created_at >= p_from and created_at < p_to)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.report_daily_sales(p_from timestamptz, p_to timestamptz)
returns table (day date, revenue_paise bigint, orders bigint, refunds_paise bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_permission('reports.view');
  return query
  with days as (
    select generate_series(
      (p_from at time zone 'Asia/Kolkata')::date,
      ((p_to - interval '1 second') at time zone 'Asia/Kolkata')::date,
      interval '1 day'
    )::date as day
  ),
  paid as (
    select (paid_at at time zone 'Asia/Kolkata')::date as day, sum(total_paise)::bigint as revenue, count(*)::bigint as n
    from public.orders
    where paid_at >= p_from and paid_at < p_to
      and payment_status in ('paid', 'partially_refunded', 'refunded', 'cod_collected')
    group by 1
  ),
  ref as (
    select (created_at at time zone 'Asia/Kolkata')::date as day, sum(amount_paise)::bigint as refunded
    from public.refunds
    where created_at >= p_from and created_at < p_to and status <> 'failed'
    group by 1
  )
  select d.day, coalesce(p.revenue, 0), coalesce(p.n, 0), coalesce(r.refunded, 0)
  from days d
  left join paid p on p.day = d.day
  left join ref r on r.day = d.day
  order by d.day;
end;
$$;

create or replace function public.report_product_sales(p_from timestamptz, p_to timestamptz)
returns table (product_id uuid, title text, sku text, units bigint, revenue_paise bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_permission('reports.view');
  return query
  select oi.product_id, max(oi.title), oi.sku, sum(oi.quantity)::bigint, sum(oi.line_total_paise)::bigint
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.paid_at >= p_from and o.paid_at < p_to
    and o.payment_status in ('paid', 'partially_refunded', 'refunded', 'cod_collected')
  group by oi.product_id, oi.sku
  order by 5 desc;
end;
$$;

create or replace function public.report_coupon_usage(p_from timestamptz, p_to timestamptz)
returns table (code text, uses bigint, discount_paise bigint, revenue_paise bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_permission('reports.view');
  return query
  select o.coupon_code, count(*)::bigint, sum(o.discount_paise)::bigint, sum(o.total_paise)::bigint
  from public.orders o
  where o.coupon_code is not null and o.paid_at >= p_from and o.paid_at < p_to
    and o.payment_status in ('paid', 'partially_refunded', 'refunded', 'cod_collected')
  group by o.coupon_code
  order by 2 desc;
end;
$$;

-- Customers: registered accounts and guest checkouts, with spend totals.
create or replace function public.admin_customers(p_search text, p_limit int, p_offset int)
returns table (
  email text, full_name text, phone text, user_id uuid, is_registered boolean,
  orders_count bigint, paid_orders bigint, total_spent_paise bigint, last_order_at timestamptz,
  created_at timestamptz, marketing_consent boolean, total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_permission('customers.read');
  return query
  with people as (
    select lower(p.email) as email, p.full_name, p.phone, p.id as user_id, true as is_registered,
           p.created_at, p.marketing_consent
    from public.profiles p
    where p.email is not null
    union all
    (
      select distinct on (lower(o.email)) lower(o.email), o.customer_name, o.phone, null::uuid, false,
             o.created_at, o.marketing_consent
      from public.orders o
      where not exists (select 1 from public.profiles p2 where lower(p2.email) = lower(o.email))
      order by lower(o.email), o.created_at desc
    )
  ),
  stats as (
    select lower(o.email) as email,
           count(*) filter (where o.status in ('placed', 'cancelled')) as orders_count,
           count(*) filter (where o.payment_status in ('paid', 'partially_refunded', 'refunded', 'cod_collected')) as paid_orders,
           coalesce(sum(o.total_paise - o.refunded_paise) filter (
             where o.payment_status in ('paid', 'partially_refunded', 'refunded', 'cod_collected')), 0) as spent,
           max(o.created_at) as last_order_at
    from public.orders o
    group by lower(o.email)
  ),
  filtered as (
    select pe.*, coalesce(s.orders_count, 0) as orders_count, coalesce(s.paid_orders, 0) as paid_orders,
           coalesce(s.spent, 0)::bigint as spent, s.last_order_at
    from people pe left join stats s on s.email = pe.email
    where coalesce(p_search, '') = ''
       or pe.email ilike '%' || p_search || '%'
       or pe.full_name ilike '%' || p_search || '%'
       or pe.phone ilike '%' || p_search || '%'
  )
  select f.email, f.full_name, f.phone, f.user_id, f.is_registered, f.orders_count, f.paid_orders, f.spent,
         f.last_order_at, f.created_at, f.marketing_consent, count(*) over ()
  from filtered f
  order by f.last_order_at desc nulls last, f.created_at desc
  limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset);
end;
$$;

-- -----------------------------------------------------------------------------
-- Function privileges
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;

grant execute on function public.has_permission(text) to anon, authenticated, service_role;
grant execute on function public.is_staff() to anon, authenticated, service_role;
grant execute on function public.is_service_role() to anon, authenticated, service_role;
grant execute on function public.my_staff_access() to authenticated;
grant execute on function public.assert_permission(text) to authenticated, service_role;

-- service-role only
revoke execute on function public.create_order(jsonb, jsonb) from authenticated;
revoke execute on function public.attach_provider_order(uuid, text, int) from authenticated;
revoke execute on function public.mark_order_paid(uuid, text, text, int, text, text, jsonb) from authenticated;
revoke execute on function public.record_payment_failure(uuid, text, text, text, text, jsonb) from authenticated;
revoke execute on function public.release_order(uuid, text, text) from authenticated;
revoke execute on function public.update_refund_status(text, text) from authenticated;
revoke execute on function public.check_rate_limit(text, int, int) from authenticated;
revoke execute on function public.cleanup_rate_limits() from authenticated;
revoke execute on function public.bootstrap_owner(text) from authenticated;
grant execute on function public.create_order(jsonb, jsonb) to service_role;
grant execute on function public.attach_provider_order(uuid, text, int) to service_role;
grant execute on function public.mark_order_paid(uuid, text, text, int, text, text, jsonb) to service_role;
grant execute on function public.record_payment_failure(uuid, text, text, text, text, jsonb) to service_role;
grant execute on function public.release_order(uuid, text, text) to service_role;
grant execute on function public.update_refund_status(text, text) to service_role;
grant execute on function public.check_rate_limit(text, int, int) to service_role;
grant execute on function public.cleanup_rate_limits() to service_role;

-- staff (permission checked inside each function)
grant execute on function public.admin_cancel_order(uuid, text, boolean) to authenticated, service_role;
grant execute on function public.set_fulfillment_status(uuid, text, text, boolean) to authenticated, service_role;
grant execute on function public.mark_cod_collected(uuid) to authenticated, service_role;
grant execute on function public.record_refund(uuid, text, text, int, text, text, boolean) to authenticated, service_role;
grant execute on function public.adjust_stock(uuid, int, text, text) to authenticated, service_role;
grant execute on function public.publish_sections(text) to authenticated;
grant execute on function public.discard_section_drafts(text) to authenticated;
grant execute on function public.publish_cms_page(uuid) to authenticated;
grant execute on function public.unpublish_cms_page(uuid) to authenticated;
grant execute on function public.log_admin_action(text, text, text, text, jsonb) to authenticated;
grant execute on function public.report_summary(timestamptz, timestamptz) to authenticated;
grant execute on function public.report_daily_sales(timestamptz, timestamptz) to authenticated;
grant execute on function public.report_product_sales(timestamptz, timestamptz) to authenticated;
grant execute on function public.report_coupon_usage(timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_customers(text, int, int) to authenticated;

-- internal helpers stay private
revoke execute on function public._order_event(uuid, text, text, text, uuid) from public, anon, authenticated, service_role;
revoke execute on function public._restock_order_items(uuid, text, text, uuid) from public, anon, authenticated, service_role;
revoke execute on function public._clear_order_cart(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.handle_new_user() from public, anon, authenticated, service_role;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated, service_role;
