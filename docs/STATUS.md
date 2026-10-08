# Project status

Status as of the first complete build (October 2026). "Tested" means it was run
for real — in a browser against the local database, or by the automated
tests in `tests/` — not just written.

## ✅ Built and tested

**Storefront**
- Animated homepage (hero, product showcase, story, promise, comparison,
  FAQ preview, reviews, newsletter, Instagram, contact, optional promo
  banner), leaf-inspired motion that switches off for "reduce motion" users.
- Shop with collection filter and sorting; product pages with zoomable
  gallery, label artwork, ingredients, allergens, nutrition, approved claims
  only, related products, Product + Breadcrumb structured data.
- Cart drawer and cart page (server-side cart, merges into account on login).
- Checkout: guest or account, Indian address/PIN/phone validation, coupons,
  shipping by zone (flat or weight), COD rules, GST when configured, stock
  reservation.
- Online payment with Razorpay: success, failure ("Payment not completed —
  you have not been charged" with retry/cancel), forged-signature rejection,
  webhook confirmation after a closed window, replayed webhook ignored,
  tampered amount not marked paid, daily reconcile job — **tested end-to-end
  against a local mock of the Razorpay API**.
- Cash on Delivery order flow — tested.
- Order confirmation, private order link, order tracking page, printable
  invoice, customer accounts (orders, addresses, profile), password reset.
- About, Contact (rate-limited, spam-protected), FAQs, Journal, policy pages
  (marked *Owner review required*), 404/error pages, sitemap, robots,
  web manifest, favicon from the official leaf mark.
- Mobile layout checked on phone-sized screens (no sideways scrolling);
  accessibility scans (WCAG 2 A/AA, axe-core) pass with no serious issues
  on home, shop, product, checkout and contact.

**Admin dashboard** (`/admin`) — all tested in a browser
- Overview with real figures and a launch checklist; staff without report
  access see their work queue.
- Orders: filters, CSV export, status steps, tracking, notes, refunds
  (via the Razorpay mock), cancel with restock, COD collected, packing slip,
  invoice, resend email.
- Products: list, full editor (texts, images with drag-to-reorder and alt
  text, sizes/prices, label & nutrition, claims approval, shelf-life
  approval, GST fields, SEO preview), duplicate, publish/archive/delete,
  draft preview on the real product page; collections.
- Inventory with history and CSV; customers (accounts + guests) with detail
  pages and CSV; contact messages; review moderation with public replies.
- Content: homepage section editor (draft → preview → publish/discard),
  pages & policies & journal editor, FAQs, banners (scheduled), Instagram
  posts, media library (uploads are re-encoded and stripped of metadata).
- Marketing: coupons (with usage counts), newsletter subscribers + CSV,
  abandoned carts (only shoppers who agreed to reminders).
- Shipping zones and options; every settings group (business, logo,
  colours, SEO, social, menus, footer, checkout/COD, GST, emails &
  templates, reviews, newsletter, product defaults, Shiprocket, maintenance).
- Integrations status (masked keys, webhook URL, test email/Shiprocket
  buttons, webhook and email logs), staff roles, activity log, reports with
  CSV (sales by day, products, coupons, GST, refunds).

**Security & quality**
- Row Level Security on every table; 8 database security tests pass
  (visitors can't read private data, customers can't change prices/stock,
  can't make themselves staff, can't publish fake reviews, last owner can't
  be removed).
- Server-side price/stock/coupon checks, signed payment verification,
  idempotent webhooks, rate limits on login/contact/reviews/checkout,
  security headers + Content Security Policy, CSV formula-injection guard,
  test-only settings ignored in production.
- 52 unit tests, 33 browser tests, lint and type checks pass; production
  build succeeds. Production dependencies: 0 known vulnerabilities
  (`npm audit --omit=dev`). The only audit warnings are in the developer
  lint tool and are not part of the website.

## ⏳ Waiting for your accounts / credentials
These are fully built but can only be switched on with your own accounts
(see `SETUP_GUIDE.md`):
- **Real Razorpay payments** — needs your Razorpay keys, webhook secret and
  KYC approval. (Tested only against a mock; do a test-mode purchase after
  setup.)
- **Emails** (order confirmations, shipping updates, admin alerts, Supabase
  login emails) — needs Resend + domain verification. Until then the
  dashboard logs them as "skipped".
- **Shiprocket** — needs a Shiprocket API user. The integration has not been
  tested against the real Shiprocket service.
- **Live database, hosting and domain** — Supabase project, Vercel project,
  DNS records.
- **WhatsApp notifications** — a placeholder only (needs a WhatsApp Business
  API provider; not built).

## 📝 Needs your approval or information
See `OWNER_CHECKLIST.md`. In short: confirm business details; set selling
prices; approve or remove each product claim and the shelf life; enter real
stock; set shipping charges; complete and approve the five policies; GST
details if registered; replace AI-generated product images with real photos
when available (two Fresh Raw Banana images show nuts as props); check the
Fresh Raw Banana back-label text.

## Known limitations
- Vercel Hobby allows the reconcile job once a day (it also runs on every
  checkout and when staff open the dashboard). Pro allows more frequent runs.
- Supabase Free projects pause after a week of inactivity — use Pro for the
  live shop.
- Reports count revenue when payment is received (COD when marked
  collected). They are management figures, not accounting statements.
- Only one language (English) and INR.
