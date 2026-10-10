# UNAR repair and admin customization — deployment pending

Date: 10 October 2026. Owner payment-provider setup is deferred. See [the admin customization guide](ADMIN_CUSTOMIZATION.md) for the new workspace. Draft PR: https://github.com/customiseremindme-netizen/Unar-foods/pull/1. Source: customiseremindme-netizen/Unar-foods, branch claude/gifted-dirac-rkndzu, commit 57e12120abb8fa672daa31ee15deaf638d95779c.

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

9. Homepage draft saving previously deleted existing sections before inserting replacements. Replacement is now one transaction, serialized across staff saves. The real MySQL failure test confirms the previous draft survives a failed insertion.
10. Duplicated homepage sections reused accessibility IDs. Heading IDs now derive from unique section keys, newsletter form IDs use React instance IDs, and original navigation anchors are preserved on the first section of each type.

11. Choosing a light background for the dark values section now switches its headings, text, icons and cards to a readable palette. Default forest-green styling is preserved.

## Status by requested system

| System | Status |
| --- | --- |
| Authentication | Recovery/security code changed. Registration, confirmation, password reset and login passed browser tests against disposable MySQL and Mailpit. Live SMTP/Resend/database settings remain unverified; Profile updates, saved-address edits/persistence, registered-user order history, restored sessions and cross-session logout also passed in CI. |
| Product visibility | Seed and conservative migration changed. Verified seed data and migration decision logic locally. Production records NOT inspected or changed. |
| Galleries | Ten actual supplied WebP files verified; five-photo ordering, swipe/navigation/lightbox improvements implemented. All five photos for each product passed browser loading/navigation checks. Actual touch swipe, reduced motion and subsequent lightbox opening passed after fixing swallowed clicks between gestures. |
| Animations | Headline/pouch entrances and reduced-motion handling improved. Admin can enable/disable storefront motion. Visitor reduced-motion preferences take priority. Independent visual/performance measurement remains pending. |
| Checkout/orders | Existing cart, checkout, stock reservation, coupon, shipping, COD, Razorpay and order management retained; payment retry/capture safety repaired. Guest COD and mocked online-payment success/failure, webhook/signature/amount safety passed browser tests. No real or provider-sandbox payment performed. |
| Admin | New Customize website workspace adds fonts, page width, button/card styles, sticky navigation, motion controls, shop headings and grid columns, palette previews and default resets. Homepage sections now support duplication, backgrounds and spacing, with atomic draft replacement. Existing overview, products/gallery uploads/reordering, orders/refunds/invoices, inventory, customers, CMS, marketing, reviews, settings and staff modules retained. Browser tests passed for price edits, photo upload/reordering/removal, stock adjustments, coupons, CMS draft/publish and order shipping/tracking; customer-to-admin access was denied. |
| Reviews | Existing real moderated text/star reviews and purchase verification retained. Customer photos (up to five) and one MP4 video implemented with private staging, ownership checks, moderation gates, bounded requests, image/video re-encoding and range streaming. Video processing requires FFmpeg/FFprobe on the host; Image/video re-encoding unit tests and customer-upload/moderation browser journey passed in CI. |
| Performance/SEO/security | Existing image optimization, SEO/schema/sitemap/robots and security headers retained; targeted auth/payment fixes added. No Lighthouse or live security score measured. |
| Deployment | No staging or production deployment; no production data changes. Existing live URL remains https://seashell-donkey-270999.hostingersite.com/. |

## Checks actually executed

- Final source commit 45f4c9aee3337a76b5eb6acda397d5ba428987fc: GitHub Actions run 38069762022 passed ALL steps — dependency installation, lint, TypeScript, 24 targeted native regression tests, 68 unit tests, 20 MySQL integration tests, production build and 40 Playwright browser tests. Evidence: https://github.com/customiseremindme-netizen/Unar-foods/actions/runs/38069762022.
- Authentication browser journey: real MySQL registration, Mailpit email confirmation/reset, old-password rejection, new-password login, profile edits, saved-address edits/persistence, registered-user COD order history, restored browser sessions and cross-session logout passed.
- Store/admin browser journeys: product visibility/prices, all five photos per variant, touch swipe/reduced motion/lightbox, mobile menu/cart, admin price/stock/CMS/coupon/shipping updates, photo upload/reordering/removal, customer-to-admin access denial, review upload privacy/approval/hiding, SEO routes and serious accessibility checks on five pages passed.
- Customization browser checks passed for database persistence, live fonts/width/grid/header/motion settings, private section drafts, section duplication and publication, unique heading IDs, values-section text contrast after light-background changes, and phone-screen layout. Real MySQL checks confirmed failed draft replacement preserves all previous sections and customers cannot modify appearance settings.
- Commerce browser checks: guest COD plus mocked online-payment success/failure, forged signature rejection, webhook completion, amount mismatch rejection and protected payment cron passed.
- Database tests executed the REAL rollback script against disposable MySQL and verified that owner edits survive and the migration is not repeated. Additional checks verified private review-media policies and database constraints.
- Actual Sharp image processing and FFmpeg video transcoding passed unit tests; private metadata was removed. Rollback syntax, git diff --check and the local 24-test native suite also passed.
- Local dependencies were not available offline, so full validation ran through GitHub Actions. The final documentation follow-up changes only this report; runtime and test source match the passing commit above.

Tests use a disposable database, local mail catcher and mocked Razorpay, never the live shop. No official Razorpay sandbox transaction, live email delivery, Lighthouse score or production smoke test has been performed.

The historical claims in docs/STATUS.md predate this repair and are not validation evidence for these changes.

## Deployment and rollback

Keep the PR as a draft until all quality/database/browser jobs pass and a staging store is available. In Hostinger, take a database backup before deploying. Confirm the current application really tracks this repository/branch, deploy to staging with a copy of the database, configure email securely, and verify new-account, address, order, gallery, admin-permission and payment journeys if online payments will be enabled. Approve actual stock, shipping rates, policies, claims and tax settings before live sales. Do not add fake stock to production.

To roll back code, redeploy the previous commit above. The repair adds review_media and migration_backups tables and no columns to existing tables and does not delete data. If catalog publication must also be reverted, first back up the intended database, stop/revert the new app version, and run node scripts/rollback-catalog-repair.mjs --apply with its secure database environment. It restores only unchanged repaired rows and image positions from migration_backups, preserves later owner edits, and retains the migration marker to prevent automatic republishing. The rollback script passed against real disposable MySQL in CI; it has not run on the production database.

## Owner/admin guide

1. Open /admin and sign in. If no owner exists, /setup creates the first owner using the private SETUP_KEY from Hostinger; do not share that key.
2. Products: edit a product, check ingredients/nutrition against approved artwork, upload or reorder images, set price and collection, then publish. Publish intentionally edited drafts manually when desired.
3. Inventory: enter real stock with a reason. Zero-stock products remain visible as sold out.
4. Orders: inspect payment status, update fulfilment and carrier/tracking, print invoices, and handle cancellation/refunds under the approved policy.
5. Customize website: edit fonts, colours, layout, shop headings and motion, then Save. Homepage builder: edit/duplicate/style sections, save and preview the draft, then Publish. Content: manage FAQs, banners, pages and policies. Reviews: view private submitted photos/videos, approve genuine submissions, or hide/reject them; hidden media is no longer public. Marketing: manage coupons/subscribers. Integrations: check email/payment status and send a test email.

## Access and remaining work

Connect Hostinger/staging with a copied database and an approved SMTP/Resend service through secure environment settings. Razorpay/PhonePe merchant setup is deferred at the owner’s request; online payment activation and provider sandbox verification are a later step. Existing Razorpay code remains available. PhonePe has not been integrated. Do not paste passwords into chat. Shell network permission is needed for local dependency installation and browser/service access; GitHub file access already works.

Still required: live/staging audit and visual comparison, production customer/admin validation and optional online-provider validation and production video-processor availability, any further UX/layout/performance corrections found by browser QA, approved commercial/legal settings, real payment sandbox verification, production deployment and post-deploy smoke tests. This delivery is a repair PR, not a completed production store.

## Exact changed files

- .env.example
- .github/workflows/repair-checks.yml
- docs/ADMIN_CUSTOMIZATION.md
- docs/REPAIR_DELIVERY.md
- package.json
- scripts/rollback-catalog-repair.mjs
- src/app/(store)/layout.tsx
- src/app/(store)/page.tsx
- src/app/(store)/products/[slug]/page.tsx
- src/app/(store)/resend-verification/page.tsx
- src/app/(store)/shop/page.tsx
- src/app/actions/auth.ts
- src/app/actions/engagement.ts
- src/app/admin/_actions/content.ts
- src/app/admin/customize/page.tsx
- src/app/admin/integrations/page.tsx
- src/app/admin/reviews/page.tsx
- src/app/admin/settings/page.tsx
- src/app/api/payments/razorpay/verify/route.ts
- src/app/api/review-media/route.ts
- src/app/api/webhooks/razorpay/route.ts
- src/app/globals.css
- src/app/review-media/[id]/route.ts
- src/components/admin/appearance-preview.tsx
- src/components/admin/customization-links.tsx
- src/components/admin/home-editor.tsx
- src/components/admin/settings-form.tsx
- src/components/auth/auth-forms.tsx
- src/components/home/hero.tsx
- src/components/home/newsletter-form.tsx
- src/components/home/sections.tsx
- src/components/layout/site-header.tsx
- src/components/motion/motion.tsx
- src/components/product/gallery.tsx
- src/components/product/product-card.tsx
- src/components/product/review-form.tsx
- src/components/product/review-media.tsx
- src/components/product/share-product.tsx
- src/components/ui/button.tsx
- src/lib/admin/nav.ts
- src/lib/auth/accounts.ts
- src/lib/auth/password.ts
- src/lib/cms/drafts.ts
- src/lib/cms/layout.ts
- src/lib/cms/sections.ts
- src/lib/commerce/payment-validation.ts
- src/lib/commerce/payments.ts
- src/lib/data/catalog.ts
- src/lib/data/content.ts
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
- src/lib/settings/appearance.ts
- src/lib/settings/index.ts
- src/lib/settings/schema.ts
- tests/e2e/accounts.spec.ts
- tests/e2e/admin.spec.ts
- tests/e2e/customization.spec.ts
- tests/e2e/storefront.spec.ts
- tests/e2e/support/helpers.ts
- tests/integration/data-access.test.ts
- tests/integration/mysql-schema.test.ts
- tests/repair/core.test.mjs
- tests/unit/customization.test.ts
- tests/unit/review-media.test.ts
