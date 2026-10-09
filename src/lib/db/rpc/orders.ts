import type { Pool } from "mysql2/promise";
import { raise, type DbContext } from "../rest/context";
import {
  actorId,
  all,
  bool,
  clearOrderCart,
  exec,
  insertRow,
  int,
  left,
  one,
  orderEvent,
  requirePerm,
  requireService,
  restockOrderItems,
  str,
  tx,
} from "./helpers";

/**
 * Orders, payments, refunds and stock — each function runs in ONE database
 * transaction and locks the rows it changes (SELECT ... FOR UPDATE), so two
 * checkouts can never sell the same last pack and a payment confirmed twice
 * (browser + webhook) is only applied once.
 *
 * Error messages (e.g. "INSUFFICIENT_STOCK:SKU") are what the app shows
 * friendly text for.
 */

async function nextOrderNumber(pool: Pool): Promise<string> {
  const conn = await pool.getConnection();
  try {
    await conn.query(
      "INSERT INTO counters (name, value) VALUES ('order_number', LAST_INSERT_ID(1001)) ON DUPLICATE KEY UPDATE value = LAST_INSERT_ID(value + 1)",
    );
    const row = await one(conn, "SELECT LAST_INSERT_ID() AS n");
    return `UNAR-${String(Number(row!.n)).padStart(6, "0")}`;
  } finally {
    conn.release();
  }
}

export async function create_order(ctx: DbContext, args: Record<string, unknown>, pool: Pool) {
  requireService(ctx);
  const order = (args.p_order ?? {}) as Record<string, unknown>;
  const items = args.p_items;
  if (!Array.isArray(items) || items.length === 0) raise("EMPTY_CART");
  if (items.length > 50) raise("TOO_MANY_ITEMS");

  const isCod = order.payment_method === "cod";
  const email = String(order.email ?? "").trim().toLowerCase();
  const userId = str(order.user_id);
  const minutes = Math.max(5, Math.min(120, int(order.reservation_minutes) ?? 30));
  const pricesIncludeTax = bool(order.prices_include_tax, true);
  const discount = int(order.discount_paise) ?? 0;
  const shipping = int(order.shipping_paise) ?? 0;
  const codFee = int(order.cod_fee_paise) ?? 0;
  const tax = int(order.tax_paise) ?? 0;
  const total = int(order.total_paise);
  const now = new Date().toISOString();
  const orderNumber = await nextOrderNumber(pool);

  return tx(pool, async (conn) => {
    const orderId = (await insertRow(conn, "orders", {
      order_number: orderNumber,
      user_id: userId,
      cart_id: str(order.cart_id),
      email,
      phone: order.phone,
      customer_name: order.customer_name,
      shipping_address: order.shipping_address,
      billing_address: order.billing_address ?? null,
      status: isCod ? "placed" : "pending_payment",
      payment_status: isCod ? "cod_pending" : "unpaid",
      payment_method: isCod ? "cod" : "razorpay",
      subtotal_paise: 0,
      discount_paise: discount,
      shipping_paise: shipping,
      cod_fee_paise: codFee,
      tax_paise: tax,
      prices_include_tax: pricesIncludeTax,
      tax_breakdown: order.tax_breakdown ?? {},
      total_paise: total ?? 0,
      coupon_id: str(order.coupon_id),
      coupon_code: str(order.coupon_code),
      shipping_zone_id: str(order.shipping_zone_id),
      shipping_method: order.shipping_method ?? null,
      customer_note: str(order.customer_note),
      access_token_hash: order.access_token_hash,
      reservation_expires_at: isCod ? null : new Date(Date.now() + minutes * 60_000).toISOString(),
      marketing_consent: bool(order.marketing_consent),
      terms_accepted_at: bool(order.terms_accepted) ? now : null,
      placed_at: isCod ? now : null,
    })) as string;

    // Lock variants in a consistent order to avoid deadlocks between checkouts.
    const sorted = [...(items as Record<string, unknown>[])].sort((a, b) => String(a.variant_id).localeCompare(String(b.variant_id)));
    let subtotal = 0;
    let weight = 0;
    for (const item of sorted) {
      const qty = int(item.quantity);
      if (qty === null || qty < 1 || qty > 99) raise("INVALID_QUANTITY");
      const v = await one(
        conn,
        `SELECT pv.id, pv.sku, pv.title AS variant_title, pv.price_paise, pv.mrp_paise, pv.stock, pv.weight_grams, pv.is_active,
                p.id AS product_id, p.title AS product_title, p.status AS product_status, p.hsn_code, p.gst_rate
           FROM product_variants pv JOIN products p ON p.id = pv.product_id
          WHERE pv.id = ? FOR UPDATE`,
        [String(item.variant_id ?? "")],
      );
      if (!v) raise(`UNAVAILABLE:${String(item.variant_id ?? "")}`);
      if (!Number(v.is_active) || v.product_status !== "published") raise(`UNAVAILABLE:${v.sku}`);
      if (Number(v.price_paise) !== int(item.unit_price_paise)) raise(`PRICE_CHANGED:${v.sku}`);
      if (Number(v.stock) < qty) raise(`INSUFFICIENT_STOCK:${v.sku}`);

      const image = await one(conn, "SELECT url FROM product_images WHERE product_id = ? ORDER BY sort_order, created_at LIMIT 1", [v.product_id]);
      await exec(conn, "UPDATE product_variants SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?", [qty, v.id]);
      await insertRow(conn, "order_items", {
        order_id: orderId,
        product_id: v.product_id,
        variant_id: v.id,
        title: v.product_title,
        variant_title: v.variant_title,
        sku: v.sku,
        image_url: image?.url ?? null,
        unit_price_paise: Number(v.price_paise),
        mrp_paise: Number(v.mrp_paise),
        quantity: qty,
        line_total_paise: Number(v.price_paise) * qty,
        weight_grams: Number(v.weight_grams) * qty,
        hsn_code: v.hsn_code,
        gst_rate: v.gst_rate,
      });
      await insertRow(conn, "inventory_movements", {
        variant_id: v.id,
        delta: -qty,
        stock_after: Number(v.stock) - qty,
        reason: "order_reserved",
        order_id: orderId,
        note: `Reserved for ${orderNumber}`,
      });
      subtotal += Number(v.price_paise) * qty;
      weight += Number(v.weight_grams) * qty;
    }

    if (subtotal !== int(order.subtotal_paise)) raise("TOTAL_MISMATCH");
    if (discount > subtotal) raise("TOTAL_MISMATCH");
    let expected = subtotal - discount + shipping + codFee;
    if (!pricesIncludeTax) expected += tax;
    if (total === null || total !== expected) raise("TOTAL_MISMATCH");

    await exec(conn, "UPDATE orders SET subtotal_paise = ?, total_weight_grams = ? WHERE id = ?", [subtotal, weight, orderId]);

    // Coupon: re-validated under lock so usage limits are race-safe.
    const couponId = str(order.coupon_id);
    if (couponId) {
      const c = await one(conn, "SELECT * FROM coupons WHERE id = ? FOR UPDATE", [couponId]);
      const nowMs = Date.now();
      const starts = c?.starts_at ? Date.parse(`${String(c.starts_at).replace(" ", "T")}Z`) : null;
      const ends = c?.ends_at ? Date.parse(`${String(c.ends_at).replace(" ", "T")}Z`) : null;
      if (!c || !Number(c.is_active) || (starts !== null && starts > nowMs) || (ends !== null && ends <= nowMs) || subtotal < Number(c.min_subtotal_paise)) {
        raise("COUPON_INVALID");
      }
      if (c.usage_limit !== null) {
        const used = await one(conn, "SELECT COUNT(*) AS n FROM coupon_usages WHERE coupon_id = ? AND status IN ('reserved', 'used') FOR UPDATE", [c.id]);
        if (Number(used!.n) >= Number(c.usage_limit)) raise("COUPON_LIMIT_REACHED");
      }
      if (c.per_customer_limit !== null) {
        const used = await one(
          conn,
          "SELECT COUNT(*) AS n FROM coupon_usages WHERE coupon_id = ? AND status IN ('reserved', 'used') AND (LOWER(email) = ? OR (? IS NOT NULL AND user_id = ?)) FOR UPDATE",
          [c.id, email, userId, userId],
        );
        if (Number(used!.n) >= Number(c.per_customer_limit)) raise("COUPON_CUSTOMER_LIMIT");
      }
      await insertRow(conn, "coupon_usages", {
        coupon_id: c.id,
        order_id: orderId,
        user_id: userId,
        email,
        discount_paise: discount,
        status: isCod ? "used" : "reserved",
      });
    }

    if (isCod) {
      await insertRow(conn, "payments", { order_id: orderId, provider: "cod", amount_paise: total, status: "created", method: "cod" });
      await orderEvent(conn, orderId, "placed", "Order placed — Cash on Delivery.", "customer", null);
      await clearOrderCart(conn, orderId);
    } else {
      await orderEvent(conn, orderId, "created", "Order created. Waiting for online payment.", "internal", null);
    }
    return { order_id: orderId, order_number: orderNumber };
  });
}

export async function attach_provider_order(ctx: DbContext, args: Record<string, unknown>, pool: Pool) {
  requireService(ctx);
  await insertRow(pool, "payments", {
    order_id: args.p_order_id,
    provider: "razorpay",
    provider_order_id: args.p_provider_order_id,
    amount_paise: int(args.p_amount_paise),
    status: "created",
  });
  return null;
}

/** Idempotent: returns paid | already_paid | paid_needs_attention | amount_mismatch */
export async function mark_order_paid(ctx: DbContext, args: Record<string, unknown>, pool: Pool) {
  requireService(ctx);
  const orderId = String(args.p_order_id ?? "");
  const providerOrderId = str(args.p_provider_order_id);
  const providerPaymentId = str(args.p_provider_payment_id);
  const amount = int(args.p_amount_paise);
  const method = str(args.p_method);
  const status = args.p_payment_status === "authorized" ? "authorized" : "captured";
  const raw = args.p_raw ?? null;

  return tx(pool, async (conn) => {
    const order = await one(conn, "SELECT * FROM orders WHERE id = ? FOR UPDATE", [orderId]);
    if (!order) raise("ORDER_NOT_FOUND");

    // Record the payment (one row per provider payment id).
    let payment = await one(conn, "SELECT id FROM payments WHERE provider_payment_id = ? FOR UPDATE", [providerPaymentId]);
    if (!payment) {
      payment = await one(
        conn,
        "SELECT id FROM payments WHERE order_id = ? AND provider = 'razorpay' AND provider_order_id = ? AND provider_payment_id IS NULL ORDER BY created_at LIMIT 1 FOR UPDATE",
        [orderId, providerOrderId],
      );
    }
    if (!payment) {
      await insertRow(conn, "payments", {
        order_id: orderId,
        provider: "razorpay",
        provider_order_id: providerOrderId,
        provider_payment_id: providerPaymentId,
        amount_paise: amount,
        status,
        method,
        raw,
      });
    } else {
      await exec(
        conn,
        `UPDATE payments
            SET provider_payment_id = ?, amount_paise = ?,
                status = IF(status IN ('refunded', 'partially_refunded'), status, ?),
                method = COALESCE(?, method), raw = COALESCE(?, raw),
                error_code = NULL, error_description = NULL, updated_at = CURRENT_TIMESTAMP(3)
          WHERE id = ?`,
        [providerPaymentId, amount, status, method, raw === null ? null : JSON.stringify(raw), payment.id],
      );
    }

    if (["paid", "refunded", "partially_refunded"].includes(order.payment_status)) {
      const other = await one(
        conn,
        "SELECT 1 AS x FROM payments WHERE order_id = ? AND status IN ('captured', 'authorized') AND provider_payment_id IS NOT NULL AND provider_payment_id <> ? LIMIT 1",
        [orderId, providerPaymentId],
      );
      if (other && !Number(order.needs_attention)) {
        await exec(conn, "UPDATE orders SET needs_attention = 1, attention_reason = ? WHERE id = ?", [
          "More than one successful payment was received for this order. Refund the duplicate payment.",
          orderId,
        ]);
      }
      return "already_paid";
    }

    if (amount !== Number(order.total_paise)) {
      await exec(conn, "UPDATE orders SET needs_attention = 1, attention_reason = ? WHERE id = ?", [
        `Payment amount (${amount} paise) does not match the order total (${order.total_paise} paise). Check this payment in Razorpay.`,
        orderId,
      ]);
      await orderEvent(conn, orderId, "payment_mismatch", "Payment amount did not match the order total.", "internal", null);
      return "amount_mismatch";
    }

    if (order.status === "pending_payment") {
      await exec(
        conn,
        "UPDATE orders SET status = 'placed', payment_status = 'paid', paid_at = UTC_TIMESTAMP(3), placed_at = UTC_TIMESTAMP(3), reservation_expires_at = NULL WHERE id = ?",
        [orderId],
      );
      await exec(conn, "UPDATE coupon_usages SET status = 'used' WHERE order_id = ?", [orderId]);
      await orderEvent(conn, orderId, "paid", "Payment received. Your order is confirmed.", "customer", null);
      await clearOrderCart(conn, orderId);
      return "paid";
    }

    // The reservation had already been released (expired / failed / cancelled)
    // but the customer's payment went through. Try to re-reserve the stock.
    const lines = await all(
      conn,
      "SELECT variant_id, SUM(quantity) AS quantity FROM order_items WHERE order_id = ? AND variant_id IS NOT NULL GROUP BY variant_id ORDER BY variant_id",
      [orderId],
    );
    let canReserve = true;
    const stockNow = new Map<string, number>();
    for (const line of lines) {
      const v = await one(conn, "SELECT stock FROM product_variants WHERE id = ? FOR UPDATE", [line.variant_id]);
      if (!v || Number(v.stock) < Number(line.quantity)) canReserve = false;
      else stockNow.set(String(line.variant_id), Number(v.stock));
    }
    if (canReserve) {
      for (const line of lines) {
        const qty = Number(line.quantity);
        await exec(conn, "UPDATE product_variants SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?", [qty, line.variant_id]);
        await insertRow(conn, "inventory_movements", {
          variant_id: line.variant_id,
          delta: -qty,
          stock_after: stockNow.get(String(line.variant_id))! - qty,
          reason: "paid_after_expiry",
          order_id: orderId,
          note: "Stock re-reserved: payment arrived after reservation was released",
        });
      }
    }
    await exec(conn, "UPDATE coupon_usages SET status = 'used' WHERE order_id = ?", [orderId]);
    await exec(
      conn,
      `UPDATE orders
          SET status = 'placed', payment_status = 'paid', paid_at = UTC_TIMESTAMP(3), placed_at = COALESCE(placed_at, UTC_TIMESTAMP(3)),
              fulfillment_status = 'unfulfilled', cancelled_at = NULL, cancel_reason = NULL, reservation_expires_at = NULL,
              needs_attention = ?, attention_reason = ?
        WHERE id = ?`,
      [
        canReserve ? 0 : 1,
        canReserve ? null : "Payment arrived after the stock reservation expired and there is not enough stock left. Restock or refund this order.",
        orderId,
      ],
    );
    await orderEvent(conn, orderId, "paid", "Payment received. Your order is confirmed.", "customer", null);
    await clearOrderCart(conn, orderId);
    return canReserve ? "paid" : "paid_needs_attention";
  });
}

export async function record_payment_failure(ctx: DbContext, args: Record<string, unknown>, pool: Pool) {
  requireService(ctx);
  const orderId = String(args.p_order_id ?? "");
  const description = left(args.p_error_description, 500);
  await tx(pool, async (conn) => {
    const providerPaymentId = str(args.p_provider_payment_id);
    if (providerPaymentId) {
      const order = await one(conn, "SELECT total_paise FROM orders WHERE id = ?", [orderId]);
      if (order) {
        const existing = await one(conn, "SELECT id FROM payments WHERE provider_payment_id = ? FOR UPDATE", [providerPaymentId]);
        if (existing) {
          await exec(
            conn,
            `UPDATE payments SET status = IF(status IN ('captured', 'authorized', 'refunded', 'partially_refunded'), status, 'failed'),
                    error_code = ?, error_description = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?`,
            [left(args.p_error_code, 100), description, existing.id],
          );
        } else {
          await insertRow(conn, "payments", {
            order_id: orderId,
            provider: "razorpay",
            provider_order_id: str(args.p_provider_order_id),
            provider_payment_id: providerPaymentId,
            amount_paise: Number(order.total_paise),
            status: "failed",
            error_code: left(args.p_error_code, 100),
            error_description: description,
            raw: args.p_raw ?? null,
          });
        }
      }
    }
    await orderEvent(conn, orderId, "payment_failed", `Payment attempt failed: ${(description ?? "unknown reason").slice(0, 200)}`, "internal", null);
  });
  return null;
}

/** Returns reserved stock for an unpaid order. New status: expired | payment_failed | cancelled */
export async function release_order(ctx: DbContext, args: Record<string, unknown>, pool: Pool) {
  requireService(ctx);
  const status = String(args.p_new_status ?? "");
  if (!["expired", "payment_failed", "cancelled"].includes(status)) raise("INVALID_STATUS");
  const orderId = String(args.p_order_id ?? "");
  return tx(pool, async (conn) => {
    const order = await one(conn, "SELECT status, payment_status FROM orders WHERE id = ? FOR UPDATE", [orderId]);
    if (!order || order.status !== "pending_payment" || order.payment_status === "paid") return false;
    await restockOrderItems(conn, orderId, "order_released", `Released: ${status}`, null);
    await exec(conn, "UPDATE coupon_usages SET status = 'released' WHERE order_id = ?", [orderId]);
    await exec(
      conn,
      `UPDATE orders SET status = ?, payment_status = IF(? = 'payment_failed', 'failed', payment_status),
              cancelled_at = UTC_TIMESTAMP(3), cancel_reason = ?, reservation_expires_at = NULL WHERE id = ?`,
      [status, status, left(args.p_reason, 300), orderId],
    );
    const message =
      status === "expired"
        ? "Order expired because payment was not completed in time."
        : status === "payment_failed"
          ? "Payment was not completed. The order was not placed."
          : "Order cancelled before payment.";
    await orderEvent(conn, orderId, status, message, "customer", null);
    return true;
  });
}

/** Cancels a placed order (before shipping). Refunds are recorded separately. */
export async function admin_cancel_order(ctx: DbContext, args: Record<string, unknown>, pool: Pool) {
  requirePerm(ctx, "orders.cancel");
  const orderId = String(args.p_order_id ?? "");
  const reason = str(args.p_reason);
  const actor = actorId(ctx);
  return tx(pool, async (conn) => {
    const order = await one(conn, "SELECT status, fulfillment_status FROM orders WHERE id = ? FOR UPDATE", [orderId]);
    if (!order) raise("ORDER_NOT_FOUND");
    if (["cancelled", "expired", "payment_failed"].includes(order.status)) return "already_closed";
    if (["shipped", "delivered", "returned"].includes(order.fulfillment_status)) raise("CANNOT_CANCEL_SHIPPED");
    if (order.status === "pending_payment" || bool(args.p_restock)) {
      await restockOrderItems(conn, orderId, order.status === "pending_payment" ? "order_released" : "order_cancelled", "Cancelled by staff", actor);
    }
    await exec(conn, "UPDATE coupon_usages SET status = 'released' WHERE order_id = ?", [orderId]);
    await exec(
      conn,
      `UPDATE orders SET status = 'cancelled', fulfillment_status = 'cancelled',
              payment_status = IF(payment_status = 'cod_pending', 'unpaid', payment_status),
              cancelled_at = UTC_TIMESTAMP(3), cancel_reason = ?, reservation_expires_at = NULL WHERE id = ?`,
      [left(reason, 300), orderId],
    );
    await orderEvent(conn, orderId, "cancelled", `Order cancelled${reason ? `: ${reason.slice(0, 200)}` : "."}`, "customer", actor);
    return "cancelled";
  });
}

export async function set_fulfillment_status(ctx: DbContext, args: Record<string, unknown>, pool: Pool) {
  requirePerm(ctx, "orders.write");
  const status = String(args.p_status ?? "");
  if (!["unfulfilled", "processing", "packed", "shipped", "delivered", "returned"].includes(status)) raise("INVALID_STATUS");
  const orderId = String(args.p_order_id ?? "");
  await tx(pool, async (conn) => {
    const order = await one(conn, "SELECT status, payment_method, payment_status FROM orders WHERE id = ? FOR UPDATE", [orderId]);
    if (!order) raise("ORDER_NOT_FOUND");
    if (order.status !== "placed") raise("ORDER_NOT_PLACED");
    if (order.payment_method === "razorpay" && !["paid", "partially_refunded"].includes(order.payment_status)) raise("ORDER_NOT_PAID");
    await exec(
      conn,
      `UPDATE orders SET fulfillment_status = ?,
              shipped_at = IF(? = 'shipped', COALESCE(shipped_at, UTC_TIMESTAMP(3)), shipped_at),
              delivered_at = IF(? = 'delivered', COALESCE(delivered_at, UTC_TIMESTAMP(3)), delivered_at)
        WHERE id = ?`,
      [status, status, status, orderId],
    );
    const message = String(args.p_message ?? "").trim() || `Order status updated: ${status.replace(/_/g, " ")}.`;
    await orderEvent(conn, orderId, `fulfillment_${status}`, message, bool(args.p_customer_visible) ? "customer" : "internal", actorId(ctx));
  });
  return null;
}

export async function mark_cod_collected(ctx: DbContext, args: Record<string, unknown>, pool: Pool) {
  requirePerm(ctx, "orders.write");
  const orderId = String(args.p_order_id ?? "");
  await tx(pool, async (conn) => {
    const order = await one(conn, "SELECT payment_method, payment_status FROM orders WHERE id = ? FOR UPDATE", [orderId]);
    if (!order || order.payment_method !== "cod" || order.payment_status !== "cod_pending") raise("NOT_COD_PENDING");
    await exec(conn, "UPDATE orders SET payment_status = 'cod_collected', paid_at = UTC_TIMESTAMP(3) WHERE id = ?", [orderId]);
    await exec(conn, "UPDATE payments SET status = 'captured' WHERE order_id = ? AND provider = 'cod'", [orderId]);
    await orderEvent(conn, orderId, "cod_collected", "Cash on Delivery payment collected.", "internal", actorId(ctx));
  });
  return null;
}

/** Called after a successful refund API call (or a manual refund). Idempotent per provider refund id. */
export async function record_refund(ctx: DbContext, args: Record<string, unknown>, pool: Pool) {
  requirePerm(ctx, "orders.refund");
  const amount = int(args.p_amount_paise);
  if (amount === null || amount <= 0) raise("INVALID_AMOUNT");
  const status = String(args.p_status ?? "");
  if (!["pending", "processed"].includes(status)) raise("INVALID_STATUS");
  const orderId = String(args.p_order_id ?? "");
  const providerRefundId = str(args.p_provider_refund_id);
  const restock = bool(args.p_restock);
  const actor = actorId(ctx);

  return tx(pool, async (conn) => {
    if (providerRefundId) {
      const existing = await one(conn, "SELECT id FROM refunds WHERE provider_refund_id = ? FOR UPDATE", [providerRefundId]);
      if (existing) return existing.id as string;
    }
    const order = await one(conn, "SELECT payment_status, refunded_paise, total_paise FROM orders WHERE id = ? FOR UPDATE", [orderId]);
    if (!order) raise("ORDER_NOT_FOUND");
    if (!["paid", "partially_refunded", "cod_collected"].includes(order.payment_status)) raise("ORDER_NOT_PAID");
    const total = Number(order.total_paise);
    const newRefunded = Number(order.refunded_paise) + amount;
    if (newRefunded > total) raise("REFUND_EXCEEDS_TOTAL");

    const payment = await one(
      conn,
      "SELECT id FROM payments WHERE order_id = ? AND status IN ('captured', 'authorized', 'partially_refunded') ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
      [orderId],
    );
    const restocked = await one(conn, "SELECT 1 AS x FROM refunds WHERE order_id = ? AND restocked = 1 LIMIT 1 FOR UPDATE", [orderId]);
    const doRestock = restock && !restocked;

    const refundId = (await insertRow(conn, "refunds", {
      order_id: orderId,
      payment_id: payment?.id ?? null,
      provider: args.p_provider ?? "razorpay",
      provider_refund_id: providerRefundId,
      amount_paise: amount,
      status,
      reason: left(args.p_reason, 300),
      restocked: doRestock,
      created_by: actor,
    })) as string;

    const fully = newRefunded >= total;
    await exec(conn, "UPDATE orders SET refunded_paise = ?, payment_status = ? WHERE id = ?", [newRefunded, fully ? "refunded" : "partially_refunded", orderId]);
    if (payment) await exec(conn, "UPDATE payments SET status = ? WHERE id = ?", [fully ? "refunded" : "partially_refunded", payment.id]);
    if (doRestock) await restockOrderItems(conn, orderId, "return_restock", "Restocked with refund", actor);
    await orderEvent(conn, orderId, "refund", `Refund of ₹${(amount / 100).toFixed(2)} ${status === "processed" ? "processed" : "initiated"}.`, "customer", actor);
    return refundId;
  });
}

/** Webhook: refund status updates from Razorpay. */
export async function update_refund_status(ctx: DbContext, args: Record<string, unknown>, pool: Pool) {
  requireService(ctx);
  const status = String(args.p_status ?? "");
  await tx(pool, async (conn) => {
    const refund = await one(conn, "SELECT id, order_id, status, amount_paise FROM refunds WHERE provider_refund_id = ? FOR UPDATE", [str(args.p_provider_refund_id)]);
    if (!refund || refund.status === status || refund.status === "failed") return;
    await exec(conn, "UPDATE refunds SET status = ? WHERE id = ?", [status, refund.id]);
    if (status === "failed") {
      const order = await one(conn, "SELECT id, refunded_paise FROM orders WHERE id = ? FOR UPDATE", [refund.order_id]);
      if (!order) return;
      const newRefunded = Math.max(0, Number(order.refunded_paise) - Number(refund.amount_paise));
      await exec(conn, "UPDATE orders SET refunded_paise = ?, payment_status = ?, needs_attention = 1, attention_reason = ? WHERE id = ?", [
        newRefunded,
        newRefunded === 0 ? "paid" : "partially_refunded",
        "A refund failed at Razorpay. Check the refund in your Razorpay dashboard.",
        order.id,
      ]);
      await orderEvent(conn, order.id, "refund_failed", "Refund failed at the payment provider.", "internal", null);
    }
  });
  return null;
}

/** Stock adjustments with an audit trail. Returns the new stock. */
export async function adjust_stock(ctx: DbContext, args: Record<string, unknown>, pool: Pool) {
  requirePerm(ctx, "inventory.write");
  const reason = String(args.p_reason ?? "");
  if (!["initial", "restock", "adjustment", "correction", "damage", "return_restock"].includes(reason)) raise("INVALID_REASON");
  const delta = int(args.p_delta);
  if (!delta) raise("ZERO_DELTA");
  const variantId = String(args.p_variant_id ?? "");
  return tx(pool, async (conn) => {
    const v = await one(conn, "SELECT stock FROM product_variants WHERE id = ? FOR UPDATE", [variantId]);
    if (!v) raise("VARIANT_NOT_FOUND");
    const next = Number(v.stock) + delta;
    if (next < 0) raise("NEGATIVE_STOCK");
    await exec(conn, "UPDATE product_variants SET stock = ?, is_demo_stock = 0, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?", [next, variantId]);
    await insertRow(conn, "inventory_movements", {
      variant_id: variantId,
      delta,
      stock_after: next,
      reason,
      note: left(args.p_note, 300),
      actor_id: actorId(ctx),
    });
    return next;
  });
}
