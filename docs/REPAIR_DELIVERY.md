# UNAR repair and admin customization — deployment pending

Date: 11 October 2026. Owner payment-provider setup is deferred. See [the admin customization guide](ADMIN_CUSTOMIZATION.md) for the new workspace. Draft PR: https://github.com/customiseremindme-netizen/Unar-foods/pull/1. Source: customiseremindme-netizen/Unar-foods, branch claude/gifted-dirac-rkndzu, commit 57e12120abb8fa672daa31ee15deaf638d95779c.

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

12. Product detail pages previously always used the first variant and offered no size selector. Every active size/pack now has a real selection control with current price, stock, SKU, quantity limit and cart variant. Multiple-size cards use Choose options instead of silently ordering the first size.
13. The homepage previously filtered out non-featured new products even when the showcase selection was empty. Automatic mode now includes all published products unless the owner hand-picks them. The CMS offers all/featured/selected modes and a display limit. Draft products stay private.
14. Product creation, duplication and multi-table edits now run in one transaction with the staff row permissions intact. Failed requests cannot partially commit, invalid variant/image IDs are rejected, long copied SKUs/slugs retain their uniqueness suffix, and returned database IDs keep newly added sizes from being recreated on a later save (which could discard inventory).
15. COD is no longer silently hidden for an ineligible zone or oversized order; checkout shows the reason and blocks ineligible submission. Launch readiness now separates optional Razorpay steps from COD readiness. The shipping screen explains global COD, active zones and selected states. The owner's screenshot shows Tamil Nadu, Kerala and Puducherry unchecked with the All India zone inactive; configuration must reflect actual delivery coverage.
16. Missing sending email is the confirmed live registration blocker (owner reported no email service). Recovery links are shown only when an account was actually saved but delivery failed. Integrations now explains SMTP/Resend configuration and testing; the verification requirement is preserved.
17. Added Google OAuth for customers with PKCE, one-login state, nonce, RSA signature, issuer, audience and expiry verification, hashed persistent sessions and a private additive auth_identities table. Linking an existing customer requires Google to be authoritative for that email (Gmail or a matching Workspace domain). Staff cannot gain Google access through customer signup; unconfirmed local accounts are not silently activated. A plain browser link avoids route prefetch starting OAuth before a click. Provider credentials and a real consent/sign-in test remain required.
18. Placed COD orders can generate a private printable invoice before collection, clearly showing the amount still due. Courier tracking can be copied/shared from admin and customer order views without leaking private order tokens or customer details. PDF delivery uses the browser's Save as PDF; automatic PDF email attachments and WhatsApp API messaging are not implemented.
19. Added locally served Manrope, Inter and DM Sans, five recommended font pairings and independent font choices with preview/save controls. Standard homepage section spacing and the empty-review block are more compact; the hero reveals headline words softly with reduced-motion support.
20. Public SEO now includes category sitemap links, connected organization/website identifiers, structured product facts and every active variant's real offer. The optional dynamic llms.txt guide includes only published public facts and respects disabled indexing. AI-search rankings are not guaranteed. Browser performance measurements and a complete scroll-revealed homepage screenshot are saved by the checks.
21. Automatic homepage comparisons now include products with ingredient/nutrition data; a new jersey remains in the showcase without entering the food nutrition table. Admin can select up to three comparison products. Missing allergen text says Not provided. The staff invoice button now supports placed, unpaid COD orders using the same private access controls as the customer invoice.

## Status by requested system

| System | Status |
| --- | --- |
| Authentication | Registration, confirmation, reset, login, profile/address edits, order history, persistent sessions and logout passed against disposable MySQL and Mailpit. Live email registration is blocked until the owner configures sending email. Google signed-token verification, real database persistence and staff/unconfirmed-account restrictions passed; real Google consent and sign-in remain untested without provider credentials. |
| Product visibility | Seed and conservative migration changed. Verified seed data and migration decision logic locally. Production records NOT inspected or changed. |
| Galleries | Ten actual supplied WebP files verified; five-photo ordering, swipe/navigation/lightbox improvements implemented. All five photos for each product passed browser loading/navigation checks. Actual touch swipe, reduced motion and subsequent lightbox opening passed after fixing swallowed clicks between gestures. |
| Animations | Headline/pouch entrances and reduced-motion handling improved. Admin can enable/disable storefront motion. Visitor reduced-motion preferences take priority. A real CI browser performance/screenshot check has been added; public mobile field measurements and live visual QA remain pending. |
| Checkout/orders | Existing cart, checkout, stock reservation, coupon, shipping, COD, Razorpay and order management retained; payment retry/capture safety repaired. Guest COD and mocked online-payment success/failure, webhook/signature/amount safety passed browser tests. No real or provider-sandbox payment performed. |
| Admin | Customize website includes Manrope/Inter/DM Sans and five heading/body pairings, colours, layout, header and motion controls. Homepage supports product-selection modes, limits and private drafts. Product creation/edit/duplication is atomic with stable new-size/image IDs. Browser tests passed for new products, multiple sizes, preserved stock after repeat edits, upload, publish/unpublish, safe duplication, fonts, inventory, CMS and shipping; customer admin access was denied. Existing reports/customers/marketing/reviews/staff tools remain linked with permission checks. |
| Sizes and homepage | Active sizes appear on the purchase page and update price/stock/cart selection. Multi-size cards say Choose options. Automatic showcase includes new published products unless hand-picked selections apply; All published products mode explicitly includes them. New-product browser purchase/publication journey passed. Standard spacing and empty reviews are compact. |
| Invoices and tracking | Paid and placed COD invoices require a permitted account or private guest token; COD clearly states cash has not been collected. Copy/share tracking is available in both order views and excludes customer details/order tokens. Browser invoice privacy and tracking-copy checks passed. PDF export uses browser printing; automatic PDF attachments and WhatsApp integration are not implemented. |
| Reviews | Existing real moderated text/star reviews and purchase verification retained. Customer photos (up to five) and one MP4 video implemented with private staging, ownership checks, moderation gates, bounded requests, image/video re-encoding and range streaming. Video processing requires FFmpeg/FFprobe on the host; Image/video re-encoding unit tests and customer-upload/moderation browser journey passed in CI. |
| Performance/SEO/security | Product offers include every active size; public collection sitemap links and llms.txt added. Server permissions, OAuth signatures/state, transactional edits, private invoices, upload privacy and payment checks tested. Real CI browser layout/performance recorded; no public Lighthouse, mobile field-performance or comprehensive production-security score measured. |
| Deployment | Screenshots confirm an earlier repair/customization build was deployed externally by the owner. These latest changes were not deployed by this agent; no production data changes. Existing live URL remains https://seashell-donkey-270999.hostingersite.com/. |

## Checks actually executed

- Final runtime/test source commit 7e9c0bba61acc23390ad2a0a0d60088de07a6692: GitHub Actions run 38099979656 passed ALL steps — dependency installation, lint, TypeScript, 24 targeted native regression tests, 90 unit tests, 22 real MySQL integration tests, production build and 47 Playwright browser tests (183 tests total). Evidence: https://github.com/customiseremindme-netizen/Unar-foods/actions/runs/38099979656.
- Authentication browser journey: real MySQL registration, Mailpit email confirmation/reset, old-password rejection, new-password login, profile edits, saved-address edits/persistence, registered-user COD order history, restored browser sessions and cross-session logout passed.
- Store/admin browser journeys: product visibility/prices, all five photos per variant, touch swipe/reduced motion/lightbox, mobile menu/cart, admin price/stock/CMS/coupon/shipping updates, photo upload/reordering/removal, customer-to-admin access denial, review upload privacy/approval/hiding, SEO routes and serious accessibility checks on five pages passed.
- Customization browser checks passed for database persistence, live fonts/width/grid/header/motion settings, private section drafts, section duplication and publication, unique heading IDs, values-section text contrast after light-background changes, and phone-screen layout. Real MySQL checks confirmed failed draft replacement preserves all previous sections and customers cannot modify appearance settings.
- New-product browser checks passed for draft isolation, two sizes, sold-out/in-stock choices, selected SKU/cart size, real inventory, stock preserved after a second price edit, photo upload, homepage publication, exclusion of unrelated products from the nutrition comparison, unpublishing and safe duplication of a maximum-length SKU. Manrope/Inter preset persistence and actual computed storefront font families passed.
- COD worked with online payments disabled. Private customer and staff invoices were available before cash collection and said payment had not been collected; an anonymous request without the private token returned 404. Courier tracking copy was checked through the browser clipboard.
- Google unit checks verified RSA-signed test tokens and rejection of incorrect signature/issuer/audience/nonce/expiry/identity claims. Real MySQL customer/identity creation and linking restrictions passed. Browser checks verified the real OAuth-start redirect, PKCE/state/nonce, forged callback rejection, and a document navigation initiated only after clicking. These are integration/security checks, not a successful real Google consent or token exchange.
- Real homepage browser measurements: cumulative layout shift 0; largest contentful paint 3,592 ms; DOM content loaded 83.8 ms; transferred resources 648,482 bytes. Context: isolated CI Chromium, 1366 × 900, local test server after a full-page scroll; no mobile throttling. No uncaught page errors occurred during this measurement. Performance JSON and the full-page screenshot are in the run's unar-test-results artifact. These are not public Lighthouse or real-user scores.
- Commerce browser checks: guest COD plus mocked online-payment success/failure, forged signature rejection, webhook completion, amount mismatch rejection and protected payment cron passed.
- Database tests executed the REAL rollback script against disposable MySQL and verified that owner edits survive and the migration is not repeated. Additional checks verified private review-media policies and database constraints.
- Actual Sharp image processing and FFmpeg video transcoding passed unit tests; private metadata was removed. Rollback syntax, git diff --check and the local 24-test native suite also passed.
- Local dependencies were not available offline, so full validation ran through GitHub Actions. The final documentation follow-up changes only this report; runtime and test source match the passing commit above.

Tests use a disposable database, local mail catcher and mocked Razorpay, never the live shop. No official Razorpay sandbox transaction, live email delivery, Lighthouse score or production smoke test has been performed.

The historical claims in docs/STATUS.md predate this repair and are not validation evidence for these changes.

## Deployment and rollback

Keep the PR as a draft until all quality/database/browser jobs pass and a staging store is available. In Hostinger, take a database backup before deploying. Confirm the current application really tracks this repository/branch, deploy to staging with a copy of the database, configure email securely, and verify new-account, address, order, gallery, admin-permission and payment journeys if online payments will be enabled. Approve actual stock, shipping rates, policies, claims and tax settings before live sales. Do not add fake stock to production.

Before deployment, record the commit currently running on Hostinger and export/record the current appearance settings. To roll back, redeploy that recorded version; the original pre-repair source was 57e12120abb8fa672daa31ee15deaf638d95779c. The repair adds review_media, migration_backups and auth_identities tables without deleting existing customer/order data. Leave those additive tables in place during a code rollback. An older version may not support the new font choices; restore a compatible font preset before reverting code.

If catalog publication must also be reverted, first back up the intended database, stop/revert the new app version, and run node scripts/rollback-catalog-repair.mjs --apply with its secure database environment. It restores only unchanged repaired rows and image positions from migration_backups, preserves later owner edits, and retains the migration marker to prevent automatic republishing. The rollback script passed against real disposable MySQL in CI; it has not run on the production database.

## Owner/admin guide

1. Open /admin and sign in. If no owner exists, /setup creates the first owner using the private SETUP_KEY from Hostinger; do not share that key.
2. Products: edit a product, check ingredients/nutrition against approved artwork, upload or reorder images, set price and collection, then publish. Publish intentionally edited drafts manually when desired.
3. Inventory: enter real stock with a reason. Zero-stock products remain visible as sold out.
4. Orders: inspect payment status, update fulfilment and carrier/tracking, print invoices, and handle cancellation/refunds under the approved policy.
5. Customize website: edit fonts, colours, layout, shop headings and motion, then Save. Homepage builder: edit/duplicate/style sections, save and preview the draft, then Publish. Content: manage FAQs, banners, pages and policies. Reviews: view private submitted photos/videos, approve genuine submissions, or hide/reject them; hidden media is no longer public. Marketing: manage coupons/subscribers. Integrations: check email/payment status and send a test email.

## Access and remaining work

Connect Hostinger/staging with a copied database and an approved SMTP/Resend service through secure environment settings. Add Google OAuth web-client credentials and the exact HTTPS callback URI if Google sign-in will be enabled. Razorpay/PhonePe merchant setup is deferred at the owner’s request; online payment activation and provider sandbox verification are a later step. Existing Razorpay code remains available. PhonePe has not been integrated. Do not paste passwords into chat. Local full-tooling access was unavailable; GitHub Actions supplied the build, database and browser environment.

Still required: live/staging audit and visual comparison, production customer/admin validation and optional online-provider validation and production video-processor availability, any further UX/layout/performance corrections found by browser QA, approved commercial/legal settings, real payment sandbox verification, production deployment and post-deploy smoke tests. This delivery is a repair PR, not a completed production store.

## Exact changed files

113 changed files in this repair PR:

- .env.example
- .github/workflows/repair-checks.yml
- docs/ADMIN_CUSTOMIZATION.md
- docs/REPAIR_DELIVERY.md
- docs/SETUP_GUIDE.md
- package.json
- scripts/rollback-catalog-repair.mjs
- src/app/(store)/layout.tsx
- src/app/(store)/login/page.tsx
- src/app/(store)/page.tsx
- src/app/(store)/products/[slug]/page.tsx
- src/app/(store)/register/page.tsx
- src/app/(store)/resend-verification/page.tsx
- src/app/(store)/shop/page.tsx
- src/app/actions/auth.ts
- src/app/actions/checkout.ts
- src/app/actions/engagement.ts
- src/app/admin/_actions/content.ts
- src/app/admin/_actions/products.ts
- src/app/admin/customize/page.tsx
- src/app/admin/integrations/page.tsx
- src/app/admin/orders/[id]/page.tsx
- src/app/admin/page.tsx
- src/app/admin/reviews/page.tsx
- src/app/admin/settings/page.tsx
- src/app/admin/shipping/page.tsx
- src/app/api/payments/razorpay/verify/route.ts
- src/app/api/review-media/route.ts
- src/app/api/webhooks/razorpay/route.ts
- src/app/auth/google/callback/route.ts
- src/app/auth/google/route.ts
- src/app/globals.css
- src/app/invoice/[orderNumber]/page.tsx
- src/app/layout.tsx
- src/app/llms.txt/route.ts
- src/app/review-media/[id]/route.ts
- src/app/sitemap.ts
- src/components/admin/appearance-preview.tsx
- src/components/admin/customization-links.tsx
- src/components/admin/home-editor.tsx
- src/components/admin/product-editor.tsx
- src/components/admin/schema-form.tsx
- src/components/admin/settings-form.tsx
- src/components/auth/auth-forms.tsx
- src/components/auth/google-sign-in.tsx
- src/components/checkout/checkout-form.tsx
- src/components/home/hero.tsx
- src/components/home/newsletter-form.tsx
- src/components/home/sections.tsx
- src/components/layout/site-header.tsx
- src/components/motion/motion.tsx
- src/components/orders/order-detail.tsx
- src/components/orders/shipment-share.tsx
- src/components/product/gallery.tsx
- src/components/product/product-card.tsx
- src/components/product/product-options.tsx
- src/components/product/review-form.tsx
- src/components/product/review-media.tsx
- src/components/product/share-product.tsx
- src/components/ui/button.tsx
- src/lib/admin/checklist.ts
- src/lib/admin/nav.ts
- src/lib/auth/accounts.ts
- src/lib/auth/google-customer.ts
- src/lib/auth/google-token.ts
- src/lib/auth/google.ts
- src/lib/auth/password.ts
- src/lib/cms/drafts.ts
- src/lib/cms/layout.ts
- src/lib/cms/product-selection.ts
- src/lib/cms/sections.ts
- src/lib/commerce/payment-validation.ts
- src/lib/commerce/payments.ts
- src/lib/commerce/pricing.ts
- src/lib/commerce/types.ts
- src/lib/data/catalog.ts
- src/lib/data/content.ts
- src/lib/data/reviews.ts
- src/lib/db/client.ts
- src/lib/db/data/initial-data.json
- src/lib/db/database.types.ts
- src/lib/db/install.ts
- src/lib/db/rest/handler.ts
- src/lib/db/rest/policies.ts
- src/lib/db/rest/transaction.ts
- src/lib/db/rpc/misc.ts
- src/lib/db/schema.ts
- src/lib/db/starter-catalog.ts
- src/lib/env.ts
- src/lib/gallery/swipe.ts
- src/lib/reviews/media-policy.ts
- src/lib/reviews/media.ts
- src/lib/security/rate-limit.ts
- src/lib/seo/jsonld.tsx
- src/lib/settings/appearance.ts
- src/lib/settings/fonts.ts
- src/lib/settings/index.ts
- src/lib/settings/schema.ts
- tests/e2e/accounts.spec.ts
- tests/e2e/admin.spec.ts
- tests/e2e/customization.spec.ts
- tests/e2e/performance.spec.ts
- tests/e2e/readiness.spec.ts
- tests/e2e/storefront.spec.ts
- tests/e2e/support/helpers.ts
- tests/integration/data-access.test.ts
- tests/integration/mysql-schema.test.ts
- tests/repair/core.test.mjs
- tests/unit/customization.test.ts
- tests/unit/google-token.test.ts
- tests/unit/pricing.test.ts
- tests/unit/product-selection.test.ts
- tests/unit/review-media.test.ts
