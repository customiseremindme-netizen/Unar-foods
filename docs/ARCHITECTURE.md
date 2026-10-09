# Architecture (for developers and future changes)

Read this before changing code. It explains where things live and the rules
that keep the shop safe. The owner is not a programmer, so every
business-facing value must stay editable in the dashboard, never hard-coded.

## Stack
- **Next.js 16** (App Router, React 19, TypeScript, Turbopack). Note: Next 16
  differs from older versions — `proxy.ts` replaces middleware, `params` and
  `searchParams` are Promises, read `node_modules/next/dist/docs/` before
  using an unfamiliar API (see `AGENTS.md`).
- **Tailwind CSS 4** (tokens in `src/app/globals.css` `@theme`; brand colours
  are overridable from Settings → Colours via CSS variables).
- **Supabase**: Postgres + Auth + Storage. All schema in `supabase/migrations`.
- **Razorpay** (REST via `fetch`, no SDK), email via **SMTP** (nodemailer —
  e.g. Hostinger mail) or **Resend** (`fetch`),
  optional **Shiprocket**.
- **motion** for animation (respects `prefers-reduced-motion`).
- Hosting: any Node.js 20+ host running `npm run build` + `npm start` —
  **Hostinger Node.js web apps** or **Vercel** (`vercel.json` holds Vercel's
  daily cron; on other hosts schedule `GET /api/cron/reconcile` with
  `Authorization: Bearer $CRON_SECRET`). `/api/health` diagnoses setup.

## Folder map
```
src/app/(store)/        public website (ISR, revalidate 300s)
src/app/admin/          dashboard pages (server components) + _actions/ (server actions)
src/app/actions/        storefront server actions (cart, checkout, auth, account…)
src/app/api/            webhooks, payment verification, cron, preview, health
src/components/         UI by area (admin, product, checkout, home, layout, ui…)
src/lib/commerce/       pricing, shipping, coupons, GST, cart, checkout, payments  ← money logic
src/lib/payments/       Razorpay client + signature checks
src/lib/settings/       typed settings (schema.ts is the single source of truth)
src/lib/cms/sections.ts homepage section types + their editing fields
src/lib/supabase/       3 clients: server (user session, RLS), public (cookie-less), admin (secret key)
src/lib/auth/           session + staff permission checks
supabase/migrations/    schema, RLS, SQL functions, starter data (run in order)
supabase/setup/         all migrations in one file for the SQL Editor (generated)
supabase/seed.sql       LOCAL DEMO ONLY (publishes products with demo stock)
tests/                  unit, integration (database security), e2e (Playwright)
docs/                   setup guide, owner checklist, status, this file
```

## Rules that must not be broken
1. **Prices are decided on the server.** The browser sends only variant IDs
   and quantities. `create_order` (SQL, service role only) re-reads prices,
   locks stock rows, re-checks coupons and the total. Never accept a price,
   discount, shipping or total from the client.
2. **An order is paid only when the server verified it** — either the
   Razorpay signature (`/api/payments/razorpay/verify`) plus a fetch of the
   payment from Razorpay, or a signed webhook. `mark_order_paid` is
   idempotent and checks the amount. No "success" UI before that.
3. **Secrets are server-only.** Only `NEXT_PUBLIC_*` variables reach the
   browser. Never log secrets; `maskSecret()` for display.
4. **Row Level Security on every table.** Staff permissions come from
   `role_permissions` via `has_permission()`. Every admin server action goes
   through `runAdminAction(permission, …)` which checks again on the server.
5. **No invented content.** Claims/benefits/shelf life are shown only when
   `approved`; policies carry `requires_owner_review`; reviews need approval;
   `aggregateRating` only from real approved reviews.
6. **Money is integer paise.** Use `formatINR`, `rupeesToPaise`.
7. **Stock changes only through SQL functions** (`create_order`,
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
revenue counts once staff mark the cash collected.

## Content model
- Homepage = rows in `cms_sections` (draft + published copies). Editors
  change the draft; `publish_sections('home')` copies it live. Preview uses
  Next.js draft mode (`/api/preview`) and is limited to staff.
- Pages/policies/journal = `cms_pages` grouped by `group_id` with draft and
  published rows (`publish_cms_page`).
- To add a homepage section type: add it to `SECTION_TYPES`
  (fields + zod schema) and render it in `src/app/(store)/page.tsx`.

## Settings
`src/lib/settings/schema.ts` defines every settings group with defaults.
The dashboard form (`SettingsForm`) and the server action
(`saveSettingAction`) both validate with these schemas. Invalid stored values
fall back to defaults so a bad edit can't break the site. Private groups
(`notifications`, `shiprocket`) are never sent to the browser.

## Testing
- `npm test` — unit tests (pricing, tax, coupons, signatures, settings…).
- `npm run test:db` — RLS/permission tests against local Supabase.
- `npm run test:e2e` — Playwright against a local stack with the mock
  Razorpay server (`tests/README.md`).
- `npm run check` — lint + typecheck + unit tests. Run before every commit.
- After editing a migration: `npm run db:bundle` (a test enforces it) and
  `npm run db:types` to regenerate `src/lib/db/database.types.ts`.

## Changing the database
Add a **new** migration file (`supabase/migrations/<timestamp>_name.sql`);
never edit one that has already been run on the live project. The owner
applies new migrations by pasting just that file into the SQL Editor (or via
`npx supabase db push` if linked).
