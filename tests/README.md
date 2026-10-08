# Tests

| Command | What it checks | Needs |
| --- | --- | --- |
| `npm test` | Unit tests: prices, discounts, shipping, GST, payment signatures, CSV safety, validation | nothing |
| `npm run typecheck` / `npm run lint` | Code quality | nothing |
| `npm run test:e2e` | Real browser tests: shopping, checkout (COD + Razorpay), webhooks, admin, security headers, accessibility, mobile | local stack (below) |

## Running the browser tests locally (developers only)

The browser tests place real orders, so they must **only** run against a
local copy of the shop — never the live website.

1. Start the local database: `npx supabase start` then `npx supabase db reset`
   (this loads `supabase/seed.sql`, which publishes the products with
   **demo** stock for testing).
2. Create the test owner account:
   ```bash
   curl -X POST http://127.0.0.1:54321/auth/v1/admin/users \
     -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
     -H "Content-Type: application/json" \
     -d '{"email":"owner@unar.local","password":"OwnerPass123","email_confirm":true}'
   npx supabase db query "select public.bootstrap_owner('owner@unar.local')"   # or run it in Studio
   ```
3. Add these TEST-ONLY lines to `.env.local` (they point Razorpay at the
   local mock in `tests/e2e/support/mock-razorpay.mjs`, so no real money or
   real keys are involved):
   ```
   RAZORPAY_KEY_ID=rzp_test_localmock01
   RAZORPAY_KEY_SECRET=local_mock_secret_123
   RAZORPAY_WEBHOOK_SECRET=local_mock_webhook_secret
   RAZORPAY_API_BASE_URL=http://127.0.0.1:4010/v1
   CRON_SECRET=local_cron_secret_for_tests_0123456789
   ```
4. `npm run dev`, then in another terminal `npm run test:e2e`.

Set `PLAYWRIGHT_CHROMIUM_PATH` if Chromium is installed somewhere custom.
