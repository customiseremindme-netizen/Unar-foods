# UNAR repair delivery — incomplete pending integration access

Date: 10 October 2026. Draft PR: https://github.com/customiseremindme-netizen/Unar-foods/pull/1. Source: customiseremindme-netizen/Unar-foods, branch claude/gifted-dirac-rkndzu, commit 57e12120abb8fa672daa31ee15deaf638d95779c.

## Audit and scope

Recovered all 265 text/configuration files and all runtime assets through the connected GitHub app after shell network requests were interrupted. Seven archival brand-source binaries were not recovered locally; they remain unchanged in GitHub. The supplied ZIP's ten WebP images match the repository's product photos byte for byte. Logo files were preserved.

Existing architecture: Next.js 16.4 / React 19.3 / TypeScript / Tailwind 4 / Motion; MySQL or MariaDB via mysql2; custom scrypt authentication with hashed persistent session tokens; Nodemailer SMTP or Resend; Razorpay; optional Shiprocket; Hostinger Node.js deployment. The Postgrest client is an internal compatibility query layer over MySQL, not a Supabase authentication/database service.

Reviewed authentication actions/accounts/sessions, environment parsing, database schema and installer, catalog/public read policies, product pages/gallery, order/payment transactions, Razorpay webhooks, uploads, customer reviews, admin product editor and role authorization, homepage motion, security headers, SEO routes, and test/deployment documentation.

Both public-site fetches failed from this environment and from the web connector. No live visual comparison, live console inspection, production database inspection or production root-cause verification was possible. Observations below are confirmed source behavior, not claims about current production settings.

## Bugs and code repairs

1. Starter products were initialized as drafts. Fresh installations now publish the two confirmed products at existing prices (MRP/selling price ₹149 and ₹120, 100 g). Stock remains zero and displays sold out. Existing untouched original drafts receive a one-time conservative repair; edited, archived or previously published products are preserved. Original publication status, timestamps and image ordering are backed up in migration_backups in the same transaction. Natural-key lookups prevent starter products/collections/SKUs from duplicating existing records with different IDs.
2. Starter gallery ordering did not consistently put the hero first or follow the supplied five-photo sequence. Seed ordering now follows hero, front/back, ingredients, beauty, lifestyle. Eligible untouched legacy products receive the ordering repair. Original artwork remains separately available on the product page.
3. Registration explicitly refuses to start without an email service. This configuration requirement is preserved; verification is not bypassed. Saved but unconfirmed accounts now have a dedicated, rate-limited resend page linked from login and registration, with neutral responses. Failed resend delivery no longer invalidates an earlier usable link. Consuming a link invalidates siblings atomically under an account lock. Malformed scrypt hashes fail authentication safely, and production cookies remain secure behind an internal HTTP proxy hop. Login-related rate-limit failures now fail closed.
4. Razorpay webhooks could acknowledge pending database failures as processed, ignore interrupted received events forever, and ignore refund/failure RPC errors. These paths now return retryable failures and retry interrupted events through the existing idempotent database operations. Mismatched amounts no longer report paid to the browser; they produce an internal order warning. Payment identity, order, amount and INR currency are checked before capture and after capture. A capture race re-fetches provider state. Missing provider configuration produces unknown reconciliation status rather than treating the order as definitely unpaid.
5. Gallery had no touch swipe support. Added deliberate horizontal swipe navigation while preserving native vertical scroll/pinch zoom, keyboard arrows, screen-reader image announcements, desktop previous/next, and reduced-motion hover behavior. Five photos occupy the gallery; legal source artwork appears separately.
6. Hero headline now enters in staggered lines with reduced-motion-aware entrances. Pouch reveal uses a gentle fade/rise. Existing botanical and scroll animations remain in place. Added native product sharing with clipboard fallback.
7. Customer review photos and MP4 uploads are private until approval. The server verifies ownership, rejects unsupported/oversized files, re-encodes photos to WebP and videos to H264 MP4, strips metadata, and binds attachments to the review in one transaction. Moderators see uploads in the existing review dashboard. Video processors are optional host binaries; absence produces an honest unavailable message.
8. Catalog query failures now report an error instead of being presented as an empty successful catalog. The shared navigation catches this with an explicit unavailable notice so customer authentication remains reachable.

## Status by requested system

| System | Status |
| --- | --- |
| Authentication | Recovery/security code changed. Registration, confirmation, password reset and login passed browser tests against disposable MySQL and Mailpit. Live SMTP/Resend/database settings remain unverified; Profile updates, saved-address edits/persistence, registered-user order history, restored sessions and cross-session logout also passed in CI. |
| Product visibility | Seed and conservative migration changed. Verified seed data and migration decision logic locally. Production records NOT inspected or changed. |
| Galleries | Ten actual supplied WebP files verified; five-photo ordering, swipe/navigation/lightbox improvements implemented. All five photos for each product passed browser loading/navigation checks. Actual touch swipe and reduced-motion checks passed; the test found the next mouse click could be swallowed after a swipe. Gesture reset was corrected and final rerun is pending. |
| Animations | Headline/pouch entrances and reduced-motion handling improved. Visual/performance validation pending. |
| Checkout/orders | Existing cart, checkout, stock reservation, coupon, shipping, COD, Razorpay and order management retained; payment retry/capture safety repaired. Guest COD and mocked online-payment success/failure, webhook/signature/amount safety passed browser tests. No real or provider-sandbox payment performed. |
| Admin | Existing overview, products/gallery uploads/reordering, orders/refunds/invoices, inventory, customers, CMS, marketing, reviews, settings and staff modules retained. Browser tests passed for price edits, stock adjustments, coupons, CMS draft/publish and order shipping/tracking; customer-to-admin access was denied. |
| Reviews | Existing real moderated text/star reviews and purchase verification retained. Customer photos (up to five) and one MP4 video implemented with private staging, ownership checks, moderation gates, bounded requests, image/video re-encoding and range streaming. Video processing requires FFmpeg/FFprobe on the host; Image/video re-encoding unit tests and customer-upload/moderation browser journey passed in CI. |
| Performance/SEO/security | Existing image optimization, SEO/schema/sitemap/robots and security headers retained; targeted auth/payment fixes added. No Lighthouse, browser or live security score measured. |
| Deployment | No staging or production deployment; no production data changes. Existing live URL remains https://seashell-donkey-270999.hostingersite.com/. |

## Checks actually executed

- Local native regression suite: 24 passed; checks passwords, payment values, migration decision rules, prices, all ten supplied WebP images, gallery swipes and media limits.
- GitHub Actions run 38052820409 on commit 963e121: dependency install, lint, TypeScript, 64 unit tests, 19 MySQL integration tests, production build and 35 Playwright browser tests ALL passed. Evidence: https://github.com/customiseremindme-netizen/Unar-foods/actions/runs/38052820409.
- The browser suite covered real account creation/confirmation/reset against MySQL+Mailpit; admin price/stock/CMS/coupon/shipping updates; COD and mocked payment success/failure/signature/amount/webhooks; upload privacy/approval/hiding; both five-image galleries; mobile menu/cart; and serious accessibility checks on five pages.
- A subsequent run also passed all checks including execution of the real catalog rollback script against disposable MySQL. The extended customer addresses/order/logout journey passed in run 38067398547; the gallery test detected a swallowed click after a successful touch swipe. This was corrected. Final gallery and added admin image-upload/reorder/removal tests are running.
- Actual FFmpeg command generated/transcoded an MP4 and removed private title metadata. Image/video encoding unit tests also passed in CI.
- Rollback script syntax and git diff --check passed. Local npm installation/build/check are unavailable because dependencies are not cached and shell networking was interrupted; the CI results above are the executed full validation.

Tests use a disposable database, local mail catcher and mocked Razorpay, never the live shop. No official Razorpay sandbox transaction, live email delivery, Lighthouse score or production smoke test has been performed.

The historical claims in docs/STATUS.md predate this repair and are not validation evidence for these changes.

## Deployment and rollback

Keep the PR as a draft until all quality/database/browser jobs pass and a staging store is available. In Hostinger, take a database backup before deploying. Confirm the current application really tracks this repository/branch, deploy to staging with a copy of the database, configure email and provider test credentials securely, and verify new-account, address, order, gallery, admin-permission and payment journeys. Approve actual stock, shipping rates, policies, claims and tax settings before live sales. Do not add fake stock to production.

To roll back code, redeploy the previous commit above. The repair adds review_media and migration_backups tables and no columns to existing tables and does not delete data. If catalog publication must also be reverted, first back up the intended database, stop/revert the new app version, and run node scripts/rollback-catalog-repair.mjs --apply with its secure database environment. It restores only unchanged repaired rows and image positions from migration_backups, preserves later owner edits, and retains the migration marker to prevent automatic republishing. The rollback script has not been exercised on a real database here.

## Owner/admin guide

1. Open /admin and sign in. If no owner exists, /setup creates the first owner using the private SETUP_KEY from Hostinger; do not share that key.
2. Products: edit a product, check ingredients/nutrition against approved artwork, upload or reorder images, set price and collection, then publish. Publish intentionally edited drafts manually when desired.
3. Inventory: enter real stock with a reason. Zero-stock products remain visible as sold out.
4. Orders: inspect payment status, update fulfilment and carrier/tracking, print invoices, and handle cancellation/refunds under the approved policy.
5. Content: edit homepage/FAQs/banners, preview drafts, then publish. Reviews: view private submitted photos/videos, approve genuine submissions, or hide/reject them; hidden media is no longer public. Marketing: manage coupons/subscribers. Integrations: check email/payment status and send a test email.

## Access and remaining work

Connect Hostinger/staging and a copied database, an approved SMTP/Resend service, and Razorpay test credentials through secure environment settings. Do not paste passwords into chat. Shell network permission is needed for local dependency installation and browser/service access; GitHub file access already works.

Still required: final extended-check results, live/staging audit and visual comparison, remaining customer/admin/provider validation and production video-processor availability, any further UX/layout/performance corrections found by browser QA, approved commercial/legal settings, real payment sandbox verification, production deployment and post-deploy smoke tests. This delivery is a repair PR, not a completed production store.

## Exact changed files

- .env.example
- .github/workflows/repair-checks.yml
- docs/REPAIR_DELIVERY.md
- package.json
- scripts/rollback-catalog-repair.mjs
- src/app/(store)/layout.tsx
- src/app/(store)/products/[slug]/page.tsx
- src/app/(store)/resend-verification/page.tsx
- src/app/actions/auth.ts
- src/app/actions/engagement.ts
- src/app/admin/integrations/page.tsx
- src/app/admin/reviews/page.tsx
- src/app/api/payments/razorpay/verify/route.ts
- src/app/api/review-media/route.ts
- src/app/api/webhooks/razorpay/route.ts
- src/app/review-media/[id]/route.ts
- src/components/auth/auth-forms.tsx
- src/components/home/hero.tsx
- src/components/product/gallery.tsx
- src/components/product/review-form.tsx
- src/components/product/review-media.tsx
- src/components/product/share-product.tsx
- src/lib/auth/accounts.ts
- src/lib/auth/password.ts
- src/lib/commerce/payment-validation.ts
- src/lib/commerce/payments.ts
- src/lib/data/catalog.ts
- src/lib/data/reviews.ts
- src/lib/db/data/initial-data.json
- src/lib/db/database.types.ts
- src/lib/db/install.ts
- src/lib/db/rest/policies.ts
- src/lib/db/rpc/misc.ts
- src/lib/db/schema.ts
- src/lib/db/starter-catalog.ts
- src/lib/gallery/swipe.ts
- src/lib/reviews/media-policy.ts
- src/lib/reviews/media.ts
- src/lib/security/rate-limit.ts
- tests/e2e/accounts.spec.ts
- tests/e2e/admin.spec.ts
- tests/e2e/storefront.spec.ts
- tests/integration/data-access.test.ts
- tests/integration/mysql-schema.test.ts
- tests/repair/core.test.mjs
- tests/unit/review-media.test.ts
