# Architecture (for developers and future changes)

Read this before changing code. It explains where things live and the rules
that keep the shop safe. The owner is not a programmer, so every
business-facing value must stay editable in the dashboard, never hard-coded.

## Stack
- **Next.js 16** (App Router, React 19, TypeScript). Note: Next 16 differs
  from older versions — `params` and `searchParams` are Promises; read
  `node_modules/next/dist/docs/` before using an unfamiliar API (see
  `AGENTS.md`).
- **Tailwind CSS 4** via PostCSS (`postcss.config.mjs`; tokens in
  `src/app/globals.css` `@theme`; brand colours are overridable from
  Settings → Colours via CSS variables).
- **Builds:** `npm run build` = `next build --webpack`. Production builds use
  webpack deliberately — Turbopack's builder needs helper processes that
  Hostinger blocks. `npm run dev` still uses Turbopack. Node 22+.
- **Database: MySQL 8 / MariaDB 10.5+** (Hostinger's MySQL) through
  `mysql2`. The site creates and updates its own tables on start — there are
  no SQL files to run by hand.
- **Razorpay** (REST via `fetch`, no SDK), email via **SMTP** (nodemailer —
  e.g. Hostinger mail) or **Resend** (`fetch`), optional **Shiprocket**.
- **motion** for animation (respects `prefers-reduced-motion`).
- Hosting: **Hostinger Node.js web app** (`npm run build` + `npm start`).
  A daily Hostinger cron job calls `GET /api/cron/reconcile` with
  `Authorization: Bearer $CRON_SECRET`. `/api/health` diagnoses setup.

## The data layer (src/lib/db)
```
schema.ts        every table: columns, keys, CHECK rules, relationships  ← single source of truth
install.ts       creates/updates tables from schema.ts on first use (lock + fingerprint), loads starter data once
ddl.ts           schema.ts → MySQL CREATE/ALTER statements
pool.ts          connection settings (DB_HOST… or DATABASE_URL), UTC, strict mode
values.ts        value conversion (booleans, JSON, UTC date-times)
client.ts        getPublicDb() / getUserDb() / getServiceDb() / requireServiceDb()
rest/            the query engine behind those clients:
  parse.ts         select lists with embedded relations, filters, ordering
  engine.ts        runs them as parameterised SQL (identifiers only from schema.ts)
  policies.ts      ACCESS RULES applied to every visitor/user query
  handler.ts       request/response plumbing
rpc/             transactional business functions (db.rpc("name", args)):
  orders.ts        create_order, mark_order_paid, release_order, refunds, adjust_stock…
  content.ts       publish/discard drafts
  reports.ts       dashboard reports, customers list
  misc.ts          rate limiting, audit log
database.types.ts GENERATED from schema.ts by `npm run db:types`
```
The clients speak the same query language as before
(`db.from("orders").select("id, order_items(*)").eq(...)`,
`db.rpc("create_order", …)`), implemented by `@supabase/postgrest-js` as a
plain query builder pointed at the in-process engine — no Supabase service
is involved.

Which client to use:
- **getPublicDb()** — public pages; only what a visitor may see.
- **getUserDb()** — acts as the signed-in customer/staff member; the rules in
  `rest/policies.ts` apply (customers see only their own orders, staff only
  what their role allows).
- **getServiceDb()** — trusted server code that has **already** checked
  permissions (checkout, webhooks, carts, cron). Bypasses the rules.

## Accounts (src/lib/auth)
- `accounts.ts`: sign-up, sign-in, sessions, emailed one-time links.
  Passwords are hashed with scrypt (`password.ts`). The session cookie
  `unar_session` holds a random token; the database stores only its SHA-256.
- `session.ts`: `getSessionUser()`, `getStaffAccess()`, `requireStaffPage()`,
  `assertPermission()`.
- `permissions.ts`: roles → permissions (`ROLE_PERMISSIONS`), the single
  source of truth for both server actions and database rules.
- `/setup` creates the first owner once (needs `SETUP_KEY`).
- Email links open `/auth/confirm`, where a button press (not the link
  itself) uses the token — email scanners can't burn links.

## Folder map
```
src/app/(store)/        public website (rendered on request)
src/app/admin/          dashboard pages (server components) + _actions/ (server actions)
src/app/actions/        storefront server actions (cart, checkout, auth, setup, account…)
src/app/api/            webhooks, payment verification, cron, preview, health
src/app/media/[file]    serves images uploaded in the dashboard (stored in MySQL)
src/components/         UI by area (admin, product, checkout, home, layout, ui…)
src/lib/commerce/       pricing, shipping, coupons, GST, cart, checkout, payments  ← money logic
src/lib/payments/       Razorpay client + signature checks
src/lib/settings/       typed settings (schema.ts is the single source of truth)
src/lib/cms/sections.ts homepage section types + their editing fields
src/lib/db/             database (see above)
src/lib/auth/           accounts, sessions, staff permissions
src/lib/db/data/initial-data.json  starter content loaded once into a new database
tests/                  unit, integration (real MySQL/MariaDB), e2e (Playwright)
docs/                   setup guide, owner checklist, status, this file
```

## Rules that must not be broken
1. **Prices are decided on the server.** The browser sends only variant IDs
   and quantities. `create_order` (service only) re-reads prices, locks stock
   rows (`SELECT … FOR UPDATE`, in variant-id order), re-checks coupons and
   the total, all in one transaction. Never accept a price, discount,
   shipping or total from the client.
2. **An order is paid only when the server verified it** — either the
   Razorpay signature (`/api/payments/razorpay/verify`) plus a fetch of the
   payment from Razorpay, or a signed webhook. `mark_order_paid` is
   idempotent and checks the amount. No "success" UI before that.
3. **Secrets are server-only.** Only `NEXT_PUBLIC_*` variables reach the
   browser. Never log secrets; `maskSecret()` for display.
4. **Access rules on every query.** User/visitor queries go through
   `rest/policies.ts`; every admin server action goes through
   `runAdminAction(permission, …)` which checks again on the server.
   Reads inside commerce transactions that decide money or stock use
   locking reads (`FOR UPDATE`).
5. **No invented content.** Claims/benefits/shelf life are shown only when
   `approved`; policies carry `requires_owner_review`; reviews need approval;
   `aggregateRating` only from real approved reviews.
6. **Money is integer paise.** Use `formatINR`, `rupeesToPaise`.
7. **Stock changes only through the rpc functions** (`create_order`,
   `release_order`, `adjust_stock`, …) which write `inventory_movements`.
8. **After changing storefront data call `revalidateStorefront()`.**
9. **Log admin changes** with `logAdminAction()`.

## Payment flow
```
Checkout (browser) → placeOrderAction → create_order (reserve stock, 30 min)
  → Razorpay order (amount from DB) → Razorpay window
  → handler → /api/payments/razorpay/verify (signature + fetch payment) → mark_order_paid
  ↘ webhook payment.captured/order.paid (signed, stored once) → mark_order_paid
  ↘ cron /api/cron/reconcile + every checkout: expired reservations are
    checked with Razorpay, then paid or released
```
COD orders are `placed` immediately with `payment_status = cod_pending`;
revenue counts once staff mark the cash collected. Order numbers come from
the `counters` table (`UNAR-001001`, …; failed checkouts leave gaps).

## Content model
- Homepage = rows in `cms_sections` (draft + published copies). Editors
  change the draft; `publish_sections('home')` copies it live. Preview uses
  Next.js draft mode (`/api/preview`) and is limited to staff.
- Pages/policies/journal = `cms_pages` grouped by `group_id` with draft and
  published rows (`publish_cms_page`).
- To add a homepage section type: add it to `SECTION_TYPES`
  (fields + zod schema) and render it in `src/app/(store)/page.tsx`.
- Uploaded images: re-encoded to WebP by sharp, stored in
  `media_assets.data`, served from `/media/<id>.webp` (cached forever; a new
  upload gets a new address).

## Settings
`src/lib/settings/schema.ts` defines every settings group with defaults.
The dashboard form (`SettingsForm`) and the server action
(`saveSettingAction`) both validate with these schemas. Invalid stored values
fall back to defaults so a bad edit can't break the site. Private groups
(`notifications`, `shiprocket`) are never sent to the browser.

## Changing the database
1. Edit `src/lib/db/schema.ts` — add a column with a default (or nullable),
   a table, an index or a rule.
2. `npm run db:types` to regenerate `database.types.ts` (a unit test checks).
3. Deploy. On start the installer notices the changed fingerprint and adds
   what's missing (`install.ts`). It never drops or renames anything — for
   that, add an explicit, idempotent step in `install.ts` `migrate()`.
4. Test with `npm run test:db` against MySQL 8 and MariaDB (below).

## Testing
- `npm test` — unit tests (pricing, tax, coupons, signatures, query reader…).
- `npm run test:db` — against a real **test** database
  (`TEST_DATABASE_URL=mysql://…/unar_test`, its tables are dropped!): automatic
  setup, access rules, last-owner rule, overselling and double-payment races.
  Verified on MySQL 8.0 and MariaDB 10.6, 10.11 and 11.4.
- `npm run test:e2e` — Playwright against a local site with the mock
  Razorpay server and a mail catcher (`tests/README.md`).
- `npm run check` — lint + typecheck + unit tests. Run before every commit.

## Adding another payment provider (e.g. PhonePe PG, Cashfree, PayU)
Razorpay Checkout already offers PhonePe, Google Pay, Paytm and other UPI
apps, cards, net banking and wallets, so customers can pay "with PhonePe"
today. A *separate* gateway is only needed for business reasons (fees,
settlement). To add one without touching the rest of the shop:
1. `schema.ts`: allow the new value in the `orders.payment_method`,
   `payments.provider` and `refunds.provider` CHECK rules (and handle the
   existing rule in `install.ts`, since rules are only added, not replaced).
2. `src/lib/payments/<provider>.ts`: create payment, verify (signature or
   server-to-server status check), refund — same shape as `razorpay.ts`.
3. Confirm payments only through `mark_order_paid` (idempotent, checks the
   amount) from a verify route and a signed webhook route
   (`/api/webhooks/<provider>`), storing events in `webhook_events`.
4. Add the option in `src/components/checkout/checkout-form.tsx`, a
   Settings → Checkout switch, env keys in `.env.example`, and tests
   (mock server like `tests/e2e/support/mock-razorpay.mjs`).
