# Project status

Status as of the website upgrade (1 November 2026). "Tested" means it
was run for real — in a browser against a local MySQL/MariaDB database, or
by the automated tests in `tests/` — not just written. The live Hostinger
site itself could not be opened or tested from the development session.

## New in the November 2026 upgrade (all tested)
- Both products appear as soon as the database is connected (published,
  shown as *Sold out* until stock is entered), with the full names
  "UNAR Dehydrated Banana Chewy — With Dry Fruits & Seeds" (₹149) and
  "— Fresh Raw Banana" (₹120). Databases set up earlier are repaired
  automatically without touching your own edits.
- Accounts work without email (active at once); with email set up the
  confirmation link is used. Account-takeover fix, current password needed
  to change it, forms keep what was typed after a mistake.
- Product gallery: the 5 photos in order 01–05, crossfade, swipe, arrows,
  keyboard, full-screen viewer with zoom/pan, separate "Read the pack label".
- Product page: Key benefits (approved only), net weight, PIN-code delivery
  check, share buttons, sticky Add to cart bar on phones, ratings breakdown.
- Reviews with up to 5 photos and one video, moderated.
- Homepage: new sections Ingredients, How to enjoy, Verified benefits;
  hero entrance, floating pouch, mask reveals, icon animations, all off for
  "reduce motion" visitors.
- Dashboard overview: all-time orders, customer accounts, products on sale.
- Security updates (Next.js 16.4.3 and others); SEO addresses fixed.
- Not built (optional in the brief): wishlist and product quick view.

## New on 3 November 2026 (all tested locally)
- **Invoices emailed automatically** as a PDF once money is received
  (online payment, or cash on delivery / UPI marked received); download link
  for customers; "Email invoice" button in the dashboard.
- **PhonePe Payment Gateway** as a second online gateway — tested only
  against a local stand-in for PhonePe (success, failure + retry, wrong
  amount, webhook security). Needs your PhonePe Business gateway keys.
- **Pay by UPI to your own UPI ID** (Google Pay / PhonePe Business): QR code
  and "Open my UPI app" link; you confirm each payment in the dashboard.
- **Continue with Google** sign-in — tested against a local stand-in for
  Google. Needs a Google Cloud OAuth client.
- Browser tests: 68 (desktop + phone), all passing on the production build
  with MySQL 8.0 and with MariaDB 11.4; 19 database tests on both.
- Not built: automatic WhatsApp/SMS messages (needs a WhatsApp Business API
  provider account).

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
- 61 unit tests, 54 browser tests (desktop + phone, production build, run
  against both MySQL 8.0 and MariaDB 11.4), 18 database tests (MySQL 8.0 and
  MariaDB 11.4), lint and type checks pass; the production build succeeds
  without database access (as on Hostinger's build servers).

## ⏳ Waiting for your accounts / credentials
These are fully built but can only be switched on with your own accounts
(see `SETUP_GUIDE.md`):
- **Real Razorpay payments** — needs your Razorpay keys, webhook secret and
  KYC approval. (Tested only against a mock; do a test-mode purchase after
  setup.)
- **Emails** (order confirmations, shipping updates, admin alerts, account
  confirmation and password-reset emails) — needs your Hostinger mailbox
  (SMTP) or a Resend account. SMTP sending was tested end-to-end against a
  local mail server. Until then order emails are logged as "skipped",
  accounts are activated without a confirmation email, and "Forgot
  password" can't send links.
- **Shiprocket** — needs a Shiprocket API user. The integration has not been
  tested against the real Shiprocket service.
- **Live database, hosting and domain** — a MySQL database and a Node.js
  app in Hostinger, DNS records, then your owner account via `/setup`.
- **WhatsApp notifications** — a placeholder only (needs a WhatsApp Business
  API provider; not built).

## 📝 Needs your approval or information
See `OWNER_CHECKLIST.md`. In short: confirm business details; check selling
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
