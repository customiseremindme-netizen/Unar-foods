# Tests

| Command | What it checks | Needs |
| --- | --- | --- |
| `npm test` | Unit tests: prices, discounts, shipping, GST, payment signatures, CSV safety, validation, query reader, passwords | nothing |
| `npm run typecheck` / `npm run lint` | Code quality | nothing |
| `npm run test:db` | Real database: automatic table setup, access rules, last-owner rule, overselling and double-payment races | a **test** MySQL/MariaDB database |
| `npm run test:e2e` | Real browser tests: shopping, checkout (COD + Razorpay), webhooks, accounts and email links, admin, security headers, accessibility, mobile | local stack (below) |

## Database tests
They **drop every table** in the database they are given, so point them at
an empty test database only:
```bash
docker run -d --name unar-mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=unar_test \
  -e MYSQL_USER=unar -e MYSQL_PASSWORD=unarpw -p 3306:3306 mysql:8.0
TEST_DATABASE_URL=mysql://unar:unarpw@127.0.0.1:3306/unar_test npm run test:db
```
Run them against MariaDB too (`mariadb:10.11`, `mariadb:11.4`) after changing
`src/lib/db`.

## Browser tests (developers only)
The browser tests place real orders, so they must **only** run against a
local copy of the shop — never the live website.

1. Start a local MySQL or MariaDB with an empty database, and a mail catcher
   (e.g. `docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit --smtp-auth-accept-any --smtp-auth-allow-insecure`).
2. `.env.local` (TEST-ONLY values — the Razorpay ones point at the local
   mock in `tests/e2e/support/mock-razorpay.mjs`, so no real money or real
   keys are involved):
   ```
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_NAME=unar
   DB_USER=unar
   DB_PASSWORD=unarpw
   SETUP_KEY=local-setup-key-for-tests
   RAZORPAY_KEY_ID=rzp_test_localmock01
   RAZORPAY_KEY_SECRET=local_mock_secret_123
   RAZORPAY_WEBHOOK_SECRET=local_mock_webhook_secret
   RAZORPAY_API_BASE_URL=http://127.0.0.1:4010/v1
   CRON_SECRET=local_cron_secret_for_tests_0123456789
   SMTP_HOST=127.0.0.1
   SMTP_PORT=1025
   SMTP_USER=orders@unar.local
   SMTP_PASSWORD=test
   EMAIL_FROM=UNAR <orders@unar.local>
   ```
3. `npm run dev` (or `npm run build` then `UNAR_ALLOW_TEST_OVERRIDES=1 npm start`).
4. `node tests/e2e/support/seed-test-db.mjs` — publishes the products with
   **demo** stock, turns on demo shipping and COD, and creates the test owner
   `owner@unar.local` / `OwnerPass123`. It refuses to run against anything
   but a local/private database.
5. `E2E_MAILPIT_URL=http://127.0.0.1:8025 npm run test:e2e`

Set `PLAYWRIGHT_CHROMIUM_PATH` if Chromium is installed somewhere custom.
