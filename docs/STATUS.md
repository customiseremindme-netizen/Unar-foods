# Project status

Status as of the move to Hostinger MySQL (October 2026). "Tested" means it
was run for real — in a browser against a local MySQL/MariaDB database, or
by the automated tests in `tests/` — not just written.

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
  invoice, customer accounts (orders, addresses, profile).
- Own sign-in system (no outside service): sign-up with email confirmation,
  sign-in, password reset by email, single-use links that email scanners
  can't use up, one-time `/setup` page for the owner account — tested
  end-to-end with a local mail server.
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

**Database (Hostinger MySQL)**
- The site creates and updates its own tables on first start (no SQL to
  paste), loads the starter content once, and never deletes data. Safe when
  several server processes start at once.
- Tested on **MySQL 8.0** and **MariaDB 10.6, 10.11 and 11.4**.
- Images uploaded in the dashboard are stored in the database and served by
  the site itself.

**Security & quality**
- Access rules on every visitor/customer/staff query (the same rules the
  shop had before); 11 database tests pass on all four database versions
  (visitors can't read private data, password hashes are never returned,
  customers can't change prices/stock, can't make themselves staff, can't
  publish fake reviews, only see their own orders and addresses, staff only
  get what their role allows, last owner can't be removed or demoted, three
  shoppers racing for the last pack → exactly one order, a payment confirmed
  twice at the same moment is recorded once).
- Server-side price/stock/coupon checks, signed payment verification,
  idempotent webhooks, rate limits on login/sign-up/setup/contact/reviews/
  checkout, scrypt password hashing, hashed session tokens, security headers
  + Content Security Policy, CSV formula-injection guard, test-only settings
  ignored in production.
- 61 unit tests, 33 browser tests (desktop + phone, run on both the
  development server and the production build), 17 database tests, lint and
  type checks pass; the production build succeeds without database access
  (as on Hostinger's build servers).

## ⏳ Waiting for your accounts / credentials
These are fully built but can only be switched on with your own accounts
(see `SETUP_GUIDE.md`):
- **Real Razorpay payments** — needs your Razorpay keys, webhook secret and
  KYC approval. (Tested only against a mock; do a test-mode purchase after
  setup.)
- **Emails** (order confirmations, shipping updates, admin alerts, account
  confirmation and password-reset emails) — needs your Hostinger mailbox
  (SMTP) or a Resend account. SMTP sending was tested end-to-end against a
  local mail server. Until then order emails are logged as "skipped" and new
  customers can't create accounts (guest checkout still works).
- **Shiprocket** — needs a Shiprocket API user. The integration has not been
  tested against the real Shiprocket service.
- **Live database, hosting and domain** — a MySQL database and a Node.js
  app in Hostinger, DNS records, then your owner account via `/setup`.
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
- The payment reconcile job runs daily from a Hostinger cron job you add (it
  also runs on every checkout and when staff open the dashboard).
- Pages are rendered when visitors open them (the database isn't available
  while Hostinger builds the site). With the database on the same server this
  is fast; if traffic grows a lot, caching can be added.
- Reports count revenue when payment is received (COD when marked
  collected). They are management figures, not accounting statements.
- Only one language (English) and INR.
