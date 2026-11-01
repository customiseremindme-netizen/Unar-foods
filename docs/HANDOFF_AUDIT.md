# Upgrade handoff — audit findings and work plan

Written 2026-10-10 at the start of the "Complete Website Repair, Animation &
E-Commerce Upgrade" brief. Read this before changing code.

## Where things stand
- Branch `claude/gifted-dirac-rkndzu` deploys to Hostinger (Node.js app,
  temporary address https://seashell-donkey-270999.hostingersite.com).
- Rollback point before the upgrade: commit `57e1212`.
- Stack (do NOT replace): Next.js 16 App Router, React 19, TypeScript,
  Tailwind 4, MySQL/MariaDB on Hostinger through the in-process data layer in
  `src/lib/db` (schema.ts → tables created automatically by install.ts; query
  engine in rest/; transactional business functions in rpc/), own sign-in in
  `src/lib/auth`, Razorpay, SMTP email, `motion` for animation. See
  docs/ARCHITECTURE.md.
- Live site: `/api/health` reports `"database":"not configured"` — the owner
  has not yet created the Hostinger MySQL database / entered DB_NAME,
  DB_USER, DB_PASSWORD (instructions: docs/SETUP_GUIDE.md Part 2 + 5,
  docs/CLAUDE_IN_CHROME_SETUP.md). Until then the live site shows no products
  and nobody can register. The live site and https://aramnarpavi.com could
  not be opened from the previous cloud session (network blocked).

## Root causes found (code side — fix these)
1. Starter products are seeded as `draft` with stock 0
   (src/lib/db/data/initial-data.json), so even with a database they stay
   hidden until the owner publishes them. Brief wants them visible at once
   (zero stock → clear "Sold out").
2. Seeding runs once (schema_meta `initial_data`, INSERT IGNORE in
   install.ts), so fixes to initial-data.json never reach a database that
   was already seeded → add versioned, idempotent data migrations
   (UPDATE only rows still equal to the old seed values; never duplicate;
   never overwrite owner edits).
3. Product names must be "UNAR Dehydrated Banana Chewy — With Dry Fruits &
   Seeds" (MRP ₹149) and "UNAR Dehydrated Banana Chewy — Fresh Raw Banana"
   (MRP ₹120), 100 g, collection Banana Chewy. Cards show `short_title`.
4. Gallery order is scrambled and the pack-label scans (front_label /
   back_label) are mixed into the photo strip (7 thumbnails). Required order:
   01 main hero pouch, 02 front & back, 03 ingredients/benefits, 04 beauty
   shot, 05 lifestyle — files in public/images/products/<slug>/01..05.
   Label artwork should be a separate "View pack label" view.
5. Registration is refused whenever email (SMTP/Resend) is not configured
   (src/app/actions/auth.ts). Brief: email verification only "if enabled" —
   accounts must work without email (activate immediately), verify when email
   is configured.
6. Account pre-hijacking: re-registering an unconfirmed email keeps the
   first (attacker's) password — replace the password/name on
   re-registration of an unconfirmed account.
7. Failed form submits wipe all fields (React 19 form reset) — return
   submitted values (not passwords) and use defaultValue.


## Audit: Products not appearing (Phase 3): every product listing surface, its query and filters, how zero stock is shown, seed data and seeding

**Root causes**

- ROOT CAUSE 1 (live, decisive): no database is configured. getDbConfig() returns null (src/lib/db/pool.ts:21-43), so getPublicDb() returns null (src/lib/db/client.ts:78-82), so getPublishedProducts/getCategories/getHomeSections return [] (src/lib/data/catalog.ts:144-145,183-184; src/lib/data/content.ts:27-28). Effect: the homepage collapses to a bare store-name fallback (src/app/(store)/page.tsx:90-94), /shop shows 'Products coming soon' (shop/page.tsx:185-188), both product pages return 404 (products/[slug]/page.tsx:57), header search and sitemap are empty.
- ROOT CAUSE 2 (after the DB is connected): the starter products are seeded as status 'draft' (initial-data.json:306,408; schema default schema.ts:199). Both the explicit filter (catalog.ts:149) and the anon access rule (src/lib/db/rest/policies.ts:97-100) hide drafts, so 0 products are visible until an owner signs in (after /setup with SETUP_KEY) and publishes each product by hand (src/app/admin/_actions/products.ts:284-303). Tests lock this in (tests/integration/mysql-schema.test.ts:37).
- ROOT CAUSE 3 (fix durability): seeding runs once, gated by schema_meta.initial_data (src/lib/db/install.ts:136), and uses INSERT IGNORE (install.ts:107). Any correction to initial-data.json (publish, titles, image order) will NOT be applied to an already-seeded database; a versioned data migration with UPDATE statements is needed. INSERT IGNORE also hides row errors.
- ROOT CAUSE 4 (masking): every DB error or absence is turned into an empty list (catalog.ts:144-145,152-155), so the storefront shows friendly 'coming soon' empty states instead of signalling an outage, which hides causes 1 and 2.
- CONTRIBUTING (not hiding, but blocks sales): stock is seeded as 0 (initial-data.json:513,528), so once published both products show 'Sold out' with add-to-cart disabled, and the 'In stock only' filter (shop/page.tsx:77) hides them. The shipping zone is seeded inactive (initial-data.json:705).

**Gaps (status · requirement · what is missing · evidence)**

- **[missing] Live deployment has a database connected so catalog queries can run** — With no database settings, every listing surface gets an empty array. This is a deployment setting, not a code bug, but it is root cause #1. Note that health.ts:9 lists only DB_* settings, even though DATABASE_URL is also accepted (pool.ts:22).  
  _Evidence:_ src/lib/db/pool.ts:21-43 getDbConfig() returns null unless DATABASE_URL=mysql://… or all of DB_HOST/DB_NAME/DB_USER/DB_PASSWORD are set. src/lib/db/client.ts:58-60,78-82 getPublicDb() returns null when that is missing. src/lib/data/catalog.ts:144-145 getPublishedProducts does `if (!db) return []`. The same null check returns [] in getCategories (catalog.ts:183-184) and getHomeSections (src/lib/data/content.ts:27-28). src/lib/db/health.ts:21 is the code path that reports "not configured", which matches the live health check.  
  _Files:_ src/lib/db/pool.ts, src/lib/db/client.ts, src/lib/data/catalog.ts, src/lib/db/health.ts
- **[missing] Seeded products are visible to the public (status published)** — Even after the database is connected and seeded, anonymous visitors see 0 products until an owner signs in and publishes each product by hand. This is root cause #2. If products should appear on first connect, the seed (or a data migration) must set status='published' and published_at, and the integration test at mysql-schema.test.ts:37 must change to match.  
  _Evidence:_ src/lib/db/data/initial-data.json:306 and :408 have "status": "draft", with published_at null at :398 and :500. The schema default is also draft (src/lib/db/schema.ts:199). The query filters `.eq("status","published")` (catalog.ts:149). The access rules apply `status = 'published'` to products (src/lib/db/rest/policies.ts:97), and variants, images and product_categories require a published parent (policies.ts:50-51,98-100). tests/integration/mysql-schema.test.ts:37 asserts that every seeded product is a draft. The only way to publish is by hand in the admin (src/app/admin/_actions/products.ts:284-303), which needs an owner account created through /setup. docs/SETUP_GUIDE.md:358 says products start as drafts.  
  _Files:_ src/lib/db/data/initial-data.json, tests/integration/mysql-schema.test.ts
- **[partial] install.ts seeds starter data idempotently and never duplicates** — No duplicates, but: (1) seeding runs once, controlled by schema_meta.initial_data (install.ts:136). Any later fix to initial-data.json (publishing, renaming titles, image order) never reaches a database that was already seeded, so this needs a versioned data migration (UPDATE … WHERE id=…). (2) INSERT IGNORE turns FK, CHECK and truncation errors into warnings, so a bad row is skipped silently while initial_data is still marked done (install.ts:112). (3) If a seeded product is deleted it is never re-seeded, which is fine but undocumented.  
  _Evidence:_ src/lib/db/install.ts:123-124 takes GET_LOCK. install.ts:136-139 seeds only when schema_meta has no initial_data key. install.ts:98-118 runs inside a transaction using `INSERT IGNORE` (line 107), with fixed UUIDs in the JSON and unique keys on products.slug (schema.ts:229), variants.sku (schema.ts:267) and the product_categories PK (schema.ts:237), so re-runs cannot duplicate rows. tests/integration/mysql-schema.test.ts:29-48 covers the first run, re-runs and concurrent runs.  
  _Files:_ src/lib/db/install.ts, src/lib/db/data/initial-data.json
- **[partial] Seed product names match the brief: "UNAR Dehydrated Banana Chewy — With Dry Fruits & Seeds" MRP 149, "UNAR Dehydrated Banana Chewy — Fresh Raw Banana" MRP 120, net weight 100 g, collection "Banana Chewy"** — Both product titles are missing the "UNAR " prefix. Every listing surface shows short_title, which differs from the required name (it also drops "With" for the dry-fruits product). Because of the one-time seed gate, fixing the JSON will not update a database that was already seeded.  
  _Evidence:_ Titles are initial-data.json:301 "Dehydrated Banana Chewy — With Dry Fruits & Seeds" and :403 "Dehydrated Banana Chewy — Fresh Raw Banana", both without the "UNAR " prefix. short_title values are :302 "Banana Chewy — Dry Fruits & Seeds" and :404 "Banana Chewy — Fresh Raw Banana". short_title is what cards (src/components/product/product-card.tsx:33), header search (src/app/(store)/layout.tsx:43), the PDP breadcrumb (src/app/(store)/products/[slug]/page.tsx:67) and the homepage comparison (src/components/home/sections.tsx:205,234) display. MRP is correct: mrp_paise 14900 (:511) and 12000 (:526), with price equal to MRP. Net weight is correct: variant title "100 g" and weight_grams 100 (:507,:510,:522,:525). The collection is correct: category slug banana-chewy, name "Banana Chewy", is_active true (:287-292), and both products are linked (:691-699). seo_title values (:395, :497) also leave out UNAR.  
  _Files:_ src/lib/db/data/initial-data.json
- **[partial] Seeded products are purchasable (stock > 0) or clearly shown as Sold Out** — After publishing, both products would show but be unpurchasable ('Sold out') until stock is entered in Inventory. They are not hidden, but this is a second manual step before any sale is possible. The 'In stock only' filter hides them completely (shop/page.tsx:77). Related: the seeded shipping zone has is_active false (initial-data.json:705), so checkout is also blocked.  
  _Evidence:_ initial-data.json:513 and :528 have stock 0 with is_demo_stock false. Admin product create/copy also forces stock 0 (src/app/admin/_actions/products.ts:179,218,261). The owner checklist marks 'Enter real stock' as not done (src/lib/admin/checklist.ts:47-49).  
  _Files:_ src/lib/db/data/initial-data.json
- **[partial] Homepage featured/showcase lists products** — The code is correct when published products exist. With no database, getHomeSections returns [] (content.ts:27-28), so the homepage falls back to a bare <h1>{store name}</h1> plus tagline (page.tsx:90-94): no hero, no product section, not even the 'being prepared' message. If an admin un-features one product, it silently disappears from the homepage while staying in /shop.  
  _Evidence:_ src/app/(store)/page.tsx:37 calls getPublishedProducts(), and :59 renders FeaturedProducts. src/components/home/sections.tsx:50-55 picks content.product_slugs, otherwise is_featured products, otherwise all products. Both seeds have is_featured true (initial-data.json:393,495) and product_slugs [] in the published 'shop' section. The empty state at sections.tsx:72-77 reads "Our products are being prepared" / "…available to order here soon". Comparison is hidden when fewer than 2 products exist (sections.tsx:169). The hero badge is hidden when productCount is 0 (src/components/home/hero.tsx:125).  
  _Files:_ src/app/(store)/page.tsx, src/components/home/sections.tsx, src/lib/data/content.ts
- **[partial] /shop lists all published products** — The listing logic is correct. Any database failure (not configured, DB_UNAVAILABLE during install, privilege error) is turned into [] (catalog.ts:144-145,152-155), and /shop then shows "Products coming soon" with no sign of an outage. This hides the real root cause from the owner.  
  _Evidence:_ src/app/(store)/shop/page.tsx:65-88 calls getPublishedProducts(), then filters by category, in_stock and q terms, sorts, and paginates 12 per page (:90-92). When products.length===0, the empty state shows "Products coming soon" / "Our Banana Chewy range will be available to order here soon." (:182-192).  
  _Files:_ src/app/(store)/shop/page.tsx, src/lib/data/catalog.ts
- **[partial] Collection filter (Banana Chewy category) works** — Works for banana-chewy once products are published. An unknown or inactive ?collection value is silently ignored: it shows all products under the plain 'Shop' heading with canonical /shop (shop/page.tsx:28-33,72). There is no dedicated collection route, and the collection URL is missing from the sitemap. If no category is active, the pill nav disappears (:141).  
  _Evidence:_ shop/page.tsx:72 matches the ?collection slug against active categories from getCategories (catalog.ts:182-195, is_active=1). shop/page.tsx:76 filters on p.categories, which come from the embedded product_categories(categories(slug,name,is_active)) (catalog.ts:75) with inactive categories dropped (catalog.ts:135-138). Embedding resolves through FKs (src/lib/db/rest/engine.ts:43-63, 269-285). Collection pills are at shop/page.tsx:141-174.  
  _Files:_ src/app/(store)/shop/page.tsx, src/app/sitemap.ts
- **[partial] Header search finds products** — Empty while products are empty. With an empty index and nothing typed it shows 'No products match “”.' (site-header.tsx:223-224). The dialog matches on fewer fields than /shop. There is no sold-out indicator in results.  
  _Evidence:_ src/app/(store)/layout.tsx:27 calls getPublishedProducts(), and :39-49 builds searchIndex (short_title, subtitle, primary image, price). src/components/layout/site-header.tsx:190-194 does a client-side substring match on title and subtitle only. Submit pushes /shop?q= (:204), which searches title, short_title, subtitle, short_description, ingredients and category names (shop/page.tsx:79-83).  
  _Files:_ src/components/layout/site-header.tsx, src/app/(store)/layout.tsx
- **[partial] Product detail page renders for each product** — Both /products/banana-chewy-dry-fruits-seeds and /products/banana-chewy-fresh-raw-banana return 404 on live: with no database the list is empty, and once connected they are drafts. Copy issue: when price equals MRP the line reads "MRP Inclusive of all taxes · Net weight 100 g · SKU …" (page.tsx:117-118), so 'MRP' is attached to the tax text instead of the ₹ amount.  
  _Evidence:_ src/app/(store)/products/[slug]/page.tsx:56-57 uses getProductBySlug, which searches only the published list (catalog.ts:159-162), with a draft preview fallback getPreviewProductBySlug (catalog.ts:169-178) that needs draftMode plus products.read (enabled via src/app/api/preview/route.ts:15-19). Otherwise it calls notFound(). Metadata at :23-38.  
  _Files:_ src/app/(store)/products/[slug]/page.tsx, src/lib/data/catalog.ts
- **[partial] Sitemap includes product URLs** — It lists only published products, so currently none. There is no collection URL (/shop?collection=banana-chewy) in the static routes (:17).  
  _Evidence:_ src/app/sitemap.ts:7 is force-dynamic, :12 calls getPublishedProducts(), and :24-30 adds /products/{slug} with images.  
  _Files:_ src/app/sitemap.ts
- **[partial] Preview/draft mode lets staff see unpublished products** — Only the PDP honours preview. Homepage, /shop, search, related products and the sitemap always use getPublishedProducts, so draft products never appear in listings even in preview. The storefront-wide isPreview (content.ts:14-19) requires content.write, which is a different permission from the products.read the PDP preview needs.  
  _Evidence:_ catalog.ts:169-178 (PDP only) needs draftMode plus products.read and uses getUserDb. The admin links to /api/preview?path=/products/{slug} from src/components/admin/product-editor.tsx:102 and product-row-actions.tsx:57.  
  _Files:_ src/lib/data/catalog.ts, src/lib/data/content.ts
- **[partial] Product images seeded and primary image correct** — For Fresh Raw Banana, 04-beauty-shot-pouch has sort_order 1 (initial-data.json:649-655) and 01-main-hero-pouch has sort_order 5 (initial-data.json:638-644), so the card and search primary image is the beauty shot, not 01 main hero. Dry Fruits uses 01 as primary. The ordering is inconsistent between the two products.  
  _Evidence:_ All 14 seeded URLs exist under public/images/products/ (dry-fruits-seeds/01..05, fresh-raw-banana/01..05, nuts-front/back, raw-front/back). The image folders are dry-fruits-seeds and fresh-raw-banana, not the product slugs. primaryImage = images[0] sorted by sort_order (catalog.ts:100,207-209).  
  _Files:_ src/lib/db/data/initial-data.json

_Notes:_ I traced each listing surface, the database layer, the seed data and the seeding code. Every storefront surface reads from one function: getPublishedProducts() (src/lib/data/catalog.ts:143-157). That covers the homepage (FeaturedProducts, Comparison, hero count), /shop and the collection filter, header search (built in src/app/(store)/layout.tsx:39-49), the product page and related products (products/[slug]/page.tsx:56-65), and the sitemap.

The only filters that can hide a product are:
- products.status='published' (catalog.ts:149 plus policies.ts:97)
- variant is_active (policies.ts:99, catalog.ts:101-103); an inactive or missing variant shows 'Sold out' / 'Price coming soon' rather than hiding the product
- category is_active, which only matters for the collection filter (catalog.ts:137, 188)
- is_featured / product_slugs, which only matter on the homepage section (sections.tsx:50-55)
- the in_stock=1 query parameter (shop/page.tsx:77)
- maintenance.enabled (layout.tsx:53), which is seeded false

There is no payment-gateway gating, no products.is_active column, and no time-based publish window. The REST engine's embedding and access rules look correct for the catalog query (engine.ts:43-63, 199-315). Next caching is not a factor: the root layout is force-dynamic (src/app/layout.tsx:8) and cacheComponents is false (next.config.ts:38).

'Coming soon' / 'soon' copy:
- sections.tsx:76
- shop/page.tsx:185,188
- product-card.tsx:98 ('Price coming soon')
- add-to-cart.tsx:113
- checkout-form.tsx:493
- the maintenance message in settings/schema.ts:99

Minimum fix for products to appear:
1. Connect the DB (the DB_* environment variables).
2. Either publish the seeded products in the seed, or add a one-time data migration in install.ts that sets status='published' and published_at for the two fixed product IDs. The second option also covers databases that are already seeded. Then update tests/integration/mysql-schema.test.ts:37.
3. In the same migration, rename the titles to the 'UNAR Dehydrated Banana Chewy — …' form, and consider updating short_title as well, since short_title is what cards and search show.
4. Decide on stock: real stock entered through Inventory, or leave the products as Sold out.

All evidence is from /home/user/Unar-foods. No files were modified.

## Audit: Customer accounts (brief Phase 2): registration, verification, login/logout, password reset, sessions, profile, addresses, order history, CSRF, auth-page mobile layout

**Root causes**

- PRIMARY (live site): the deployment's runtime environment has no usable MySQL config, so getDbConfig() returns null (src/lib/db/pool.ts:21-43) and isDatabaseConfigured() is false (src/lib/db/client.ts:58-60). registerAction then returns at src/app/actions/auth.ts:129 with "Accounts are not available yet." The same gate blocks sign-in ("Sign-in is not available yet.", auth.ts:82) and password reset (auth.ts:165-167). Pitfalls that also produce 'not configured' even when values look filled in: a DATABASE_URL starting with mysql:// that fails to parse (for example a '#' or '/' in the password) returns null without falling back to DB_* (pool.ts:22-35); an empty DB_PASSWORD becomes undefined and so does not count (pool.ts:13-16,41); values like PASTE_*, 'none' or 'null' are ignored (pool.ts:16-17). /api/health only reports DB_* statuses, not DATABASE_URL (src/lib/db/health.ts:9-14).
- SECONDARY (blocks sign-up as soon as the DB is connected): registration requires a configured email provider. getEmailEnv() is null unless RESEND_API_KEY+EMAIL_FROM or SMTP_HOST+SMTP_USER+SMTP_PASSWORD are set (src/lib/env.ts:118-137), and then registerAction returns "Creating an account isn't available yet. You can still place an order as a guest." (auth.ts:130-132). There is no auto-confirm fallback, and both authenticate() (accounts.ts:94) and getSession() (session.ts:30) reject unconfirmed users. Without working email, no customer account can ever be created or used.
- TERTIARY: if email is configured but delivery fails (wrong SMTP port or credentials), the account row is created unconfirmed and the user sees "Your account was created, but we couldn't send the confirmation email" (auth.ts:142-143). Retrying shows the success message even if the resend fails again (auth.ts:69-70,149-156). Login then says 'Please confirm your email address first' (auth.ts:91-92), and there is no resend-confirmation UI.
- UX amplifier: /register shows the full form without checking whether accounts are available (src/app/(store)/register/page.tsx:11-19). After the inevitable error, React 19 automatically resets the uncontrolled form (react-dom startHostTransition calls requestFormReset before the action), wiping every field (auth-forms.tsx:85-103).
- Deployment risk (unverified): next.config.ts:45-48 has no serverActions.allowedOrigins. If the Hostinger reverse proxy rewrites Host without forwarding X-Forwarded-Host, Next's Server Action origin check would reject every register or login submit, even after the DB and email are configured.

**Gaps (status · requirement · what is missing · evidence)**

- **[broken] A visitor on the live site can create an account** — On the live site every valid submit returns "Accounts are not available yet." (auth.ts:129). Once the DB is set, it returns "Creating an account isn't available yet..." unless SMTP or Resend env is set (auth.ts:130-132). The page never says this up front, so the visitor fills the whole form first.  
  _Evidence:_ src/app/actions/auth.ts:115-157 registerAction. With no DB: checkRateLimit returns true because getServiceDb() is null (src/lib/security/rate-limit.ts:30-31). The next line, auth.ts:129, is `if (!isDatabaseConfigured()) return { ok: false, message: "Accounts are not available yet." }`. isDatabaseConfigured() is just getDbConfig() !== null (src/lib/db/client.ts:58-60), and getDbConfig() returns null unless DATABASE_URL=mysql://... parses or DB_HOST, DB_NAME, DB_USER and DB_PASSWORD are all present (src/lib/db/pool.ts:21-43). /api/health reports 'not configured' from the same getDbConfig() check (src/lib/db/health.ts:21). After a DB is connected, a second gate at auth.ts:130-132 runs: `if (!getEmailEnv()) return { ok:false, message:"Creating an account isn't available yet. You can still place an order as a guest." }`. The register page renders the full form without checking either condition (src/app/(store)/register/page.tsx:11-19).  
  _Files:_ src/app/actions/auth.ts, src/lib/db/pool.ts, src/lib/db/client.ts, src/lib/env.ts, src/app/(store)/register/page.tsx
- **[partial] Registration with name/email/password (code path when DB + email are configured)** — Works only when both the DB and an email provider are configured; no other path exists. The honeypot is mis-wired: `website: z.string().max(0)` (auth.ts:109) fails parsing when the field is filled. The action then returns errors.website, which RegisterForm never renders, so a browser that autofills 'website' gets a silent no-op. auth.ts:125 is dead code.  
  _Evidence:_ Form fields full_name, email, password, confirm, marketing and a honeypot: src/components/auth/auth-forms.tsx:72-126. Schema: auth.ts:102-111 using nameSchema, emailSchema and passwordSchema (src/lib/validation/common.ts:64-76,93-98). createUser inserts auth_users and profiles in one transaction (src/lib/auth/accounts.ts:54-85). Then sendAccountLink sends the verify_email link (auth.ts:41-71,142). Covered only by an e2e test that needs Mailpit (tests/e2e/accounts.spec.ts:33-41).  
  _Files:_ src/app/actions/auth.ts, src/components/auth/auth-forms.tsx
- **[partial] Password confirmation & validation messages** — Every failed submit (validation error, mismatch, or 'not available') clears all fields, including name and email, so the user has to retype everything. No live or inline validation and no strength hint beyond static text.  
  _Evidence:_ Server-side zod refine sets confirm to 'Passwords do not match' (auth.ts:111). Password rules give 'Use at least 8 characters', 'Include at least one letter' and 'Include at least one number' (common.ts:93-98). Field errors render via Field/FieldError (src/components/ui/field.tsx:77-105). The forms use noValidate and have no client-side checks (auth-forms.tsx:85). React 19.3 resets uncontrolled forms on every function action: react-dom startHostTransition calls requestFormReset$1(formFiber) before running the action (node_modules/react-dom/cjs/react-dom-client.development.js:9341). The register inputs have no defaultValue taken from the returned state (auth-forms.tsx:91-103).  
  _Files:_ src/components/auth/auth-forms.tsx, src/app/actions/auth.ts
- **[partial] Duplicate email detection without leaking account existence** — Timing leak: a new email waits on a synchronous SMTP or Resend send (auth.ts:142; email/send.ts:22,57), while a confirmed existing email returns right after the failed INSERT. Forgot-password has the same leak (auth.ts:169-170). The real owner of an existing account gets no 'someone tried to register' notice.  
  _Evidence:_ A unique index on auth_users.email (src/lib/db/schema.ts:93) plus MySQL errno 1062 raises EmailTakenError (accounts.ts:73-76). The response is the same REGISTERED_MESSAGE whether or not the email exists (auth.ts:149-156), and an unconfirmed existing account gets its link resent (auth.ts:151-154). Login gives a neutral 'Incorrect email or password.' and uses a dummy-hash timing equaliser (accounts.ts:90-96; auth.ts:94).  
  _Files:_ src/app/actions/auth.ts
- **[broken] Account pre-hijacking protection (unconfirmed account re-registration)** — An attacker registers victim@x.com with password A and never confirms. The victim later registers with password B and gets the resend. The victim clicks the link, which confirms the account that still has password A. The attacker can now sign in with A, and the victim's own password B fails. Fix: replace password_hash and profile name on re-registration of an unconfirmed account, or invalidate the stored hash when the email is confirmed. Stale unconfirmed accounts are also never cleaned up (accounts.ts:179-183).  
  _Evidence:_ When an unconfirmed account exists, registerAction only resends the confirmation link (auth.ts:151-154). The password_hash and name already stored from the first sign-up are kept; the newly submitted password is discarded. confirmLinkAction then calls confirmEmail() and startSession() (auth.ts:221-225; accounts.ts:168-171) without resetting the password or ending other sessions.  
  _Files:_ src/app/actions/auth.ts, src/lib/auth/accounts.ts
- **[partial] Email verification, and behaviour when SMTP/email is NOT configured** — No fallback when email isn't configured, such as auto-confirm or deferred verification, so no customer can ever register without SMTP or Resend. There is no 'resend confirmation' UI: login only says 'Please confirm your email address first — check your inbox' (auth.ts:91-92), and resending only happens if the user re-registers. If a send fails, the account stays unconfirmed with 'Your account was created, but we couldn't send the confirmation email' (auth.ts:143). A retry shows the success message even when the resend fails again, because sendAccountLink returns false instead of throwing (auth.ts:69-70,153).  
  _Evidence:_ Token: 32 random bytes, only its SHA-256 is stored, 24h TTL, single use, and older tokens are invalidated (accounts.ts:145-166; auth.ts:43). The link opens /auth/confirm, where a button press consumes it, so email scanners can't use it up (src/app/(store)/auth/confirm/page.tsx:16-45). Confirming signs the user in and redirects to next or /account (auth.ts:213-234). Verification is mandatory: authenticate() rejects unconfirmed users (accounts.ts:94) and the session query requires u.email_confirmed_at IS NOT NULL (src/lib/auth/session.ts:30). getEmailEnv() is null unless RESEND_API_KEY+EMAIL_FROM or SMTP_HOST+SMTP_USER+SMTP_PASSWORD are set (src/lib/env.ts:118-137). With no email provider, registerAction stops at auth.ts:130-132 with "Creating an account isn't available yet. You can still place an order as a guest." Nobody can register; the only account that can be created without email is the owner via /setup with SETUP_KEY (src/app/actions/setup.ts:46-95). Documented as intended in docs/SETUP_GUIDE.md:85-88.  
  _Files:_ src/app/actions/auth.ts, src/lib/env.ts, src/lib/auth/session.ts, src/components/auth/auth-forms.tsx
- **[partial] Brute-force protection on login/sign-up/reset** — The first X-Forwarded-For value is client-controlled behind proxies that append rather than overwrite (likely on Hostinger, unlike Vercel). An attacker can rotate fake IPs to bypass the per-email login limit and get unlimited password guesses. There is no per-account lockout.  
  _Evidence:_ Limits: login 8 per 10 min keyed by `${ip}:${email}`, signup 5/h per IP, reset 5/h per IP (rate-limit.ts:8-21; auth.ts:79,126,162). The IP is the first X-Forwarded-For entry (src/lib/security/request.ts:5-10). Rate limiting fails open when there is no DB or the RPC errors (rate-limit.ts:30-40).  
  _Files:_ src/lib/security/request.ts, src/lib/security/rate-limit.ts, src/app/actions/auth.ts
- **[partial] Forgot / reset password** — Unusable until both the DB and email are configured. If NEXT_PUBLIC_SITE_URL is unset and the proxy passes a client-supplied X-Forwarded-Host, reset links can be poisoned to point at an attacker's host. The recovery link creates a full 30-day session before the new password is set.  
  _Evidence:_ forgotPasswordAction sends a neutral 'If an account exists…' message and a 1h single-use reset_password token (auth.ts:159-175,43). confirmLinkAction with type=recovery consumes the token, confirms the email, starts a session and redirects to /reset-password (auth.ts:213-232). updatePasswordAction checks the new password differs from the current one, calls setPassword and endAllSessions, then startSession (auth.ts:181-201). On the live site it returns "Password reset by email isn't available yet. Please contact us for help." (auth.ts:165-167). Link base URL: getRequestSiteUrl() uses NEXT_PUBLIC_SITE_URL, otherwise X-Forwarded-Host or Host from the request (src/lib/site-url.ts:13-27; auth.ts:44,57).  
  _Files:_ src/app/actions/auth.ts, src/lib/site-url.ts
- **[partial] Persistent sessions (cookie flags, expiry, refresh)** — No sliding renewal: expires_at and the cookie maxAge are fixed at login, so active users are logged out after 30 days. Secure is false if a TLS-terminating proxy forwards x-forwarded-proto=http. No __Host- prefix.  
  _Evidence:_ A random 32-byte token sits in the cookie and its SHA-256 is stored in auth_sessions (accounts.ts:107-117). Cookie 'unar_session': httpOnly, sameSite 'lax', path '/', maxAge 30 days, secure = cookieIsSecure() (accounts.ts:21-22,118-124). cookieIsSecure trusts x-forwarded-proto, and otherwise uses NODE_ENV=production plus a non-localhost host (accounts.ts:98-104). Server-side expiry is checked on every request (session.ts:25-31). Expired rows are cleaned up (rpc/misc.ts:22-28).  
  _Files:_ src/lib/auth/accounts.ts, src/lib/auth/session.ts
- **[partial] Profile editing** — No email change. Changing the password does not ask for the current password, so a hijacked or shared session can take over the account. A session-expired error there says 'Your reset link has expired' (auth.ts:185). React 19 form reset reverts the user's edits after a validation error.  
  _Evidence:_ updateProfileAction updates full_name, phone and marketing_consent through getUserDb under the ownership policy (src/app/actions/account.ts:18-43; src/lib/db/rest/policies.ts:77-81). ProfileForm is in src/components/account/profile-form.tsx:11-42. The email field is disabled with 'Contact us if you need to change your sign-in email' (profile-form.tsx:26-28). 'Change password' on the profile page reuses ResetPasswordForm, which calls updatePasswordAction (src/app/(store)/account/profile/page.tsx:23-28; auth.ts:181-201).  
  _Files:_ src/app/actions/account.ts, src/app/actions/auth.ts, src/app/(store)/account/profile/page.tsx, src/components/account/profile-form.tsx
- **[partial] Mobile layout of auth pages** — Inputs below 16px trigger iOS Safari's auto-zoom on focus on every auth form. React 19 form reset (see above) is especially painful on mobile keyboards.  
  _Evidence:_ AuthShell is a centred max-w-md card with p-7 inside .container-site (16px gutter) (src/components/auth/auth-shell.tsx:4-17; src/app/globals.css:122-133). Decorative sprigs are hidden below lg. Inputs are h-12 (48px tap targets) (field.tsx:28-29). The viewport is device-width (src/app/layout.tsx:51-55). The honeypot sits off-screen inside an overflow-hidden parent, so there is no horizontal scroll. Inputs use text-[0.95rem], which is 15.2px (field.tsx:5).  
  _Files:_ src/components/ui/field.tsx

_Notes:_ I didn't change any project files. While checking zod's behaviour I briefly copied a scratch test script into node_modules/.ztest.mjs and deleted it right after. That test confirmed that a filled honeypot gives errors.website ('Too big...'), which RegisterForm never shows, and that the confirm-mismatch message is reported alongside other password errors.

The account flows are mostly well built: scrypt hashing, hashed session and link tokens, single-use links that email scanners can't consume, a neutral duplicate-email response, ownership policies, and safe next-path handling. On the live site, though, everything is gated twice: first by the missing DB, then by missing email.

Security issues worth fixing alongside the root causes:
1. Account pre-hijacking: re-registering an unconfirmed email keeps the first registrant's password_hash, and confirming the email then activates it (auth.ts:151-154, 221-225).
2. Changing the password from the profile page doesn't ask for the current password (auth.ts:181-201, profile/page.tsx:26).
3. The login rate limit is keyed on a spoofable first X-Forwarded-For entry (request.ts:7-8).
4. Reset and confirm link hosts come from request headers when NEXT_PUBLIC_SITE_URL is unset (site-url.ts:13-27).
5. Sign-up and forgot-password response times differ depending on whether an email is sent, which leaks whether an account exists.

Smaller items: sessions have no sliding renewal; email can't be changed; guest orders aren't linked to a new account with the same email; there is no resend-verification button; and inputs below 16px make iOS zoom on focus. Account deep links may lose their path: account/layout.tsx:11 always calls requireUser('/account'), so if the layout's redirect wins over the page's, a visitor to /account/orders lands on /account after signing in.

The e2e coverage for accounts (tests/e2e/accounts.spec.ts) only runs with Mailpit (E2E_MAILPIT_URL) and is skipped otherwise.

## Audit: Product detail page + gallery (brief Phases 4 and 6, PDP list)

**Root causes**

- No database on the live deployment: getPublicDb() returns null (src/lib/db/client.ts:78-79), so getPublishedProducts() returns [] (src/lib/data/catalog.ts:144-145) and page.tsx:56-57 calls notFound(). Every product page returns 404 in production.
- Even with a DB, the seeded products are status 'draft' (initial-data.json:306,408) and RLS hides them and their images (src/lib/db/rest/policies.ts:97,100), so the PDPs 404 until published. Seeded stock is 0 (initial-data.json:513,528), so once published BuyBox shows only 'Sold out' with no quantity, Add to Cart or Buy Now (add-to-cart.tsx:107-116), and JSON-LD reports OutOfStock.
- Desktop hover zoom never works. The main <Image> has class animate-fade-in (animation 'fade-in 0.5s … both', keyframe to: transform:none; globals.css:42,53-56) together with an inline transform scale(1.6) (gallery.tsx:70-71). Animation-origin declarations with fill-mode both override the inline style, so the scale is never applied.
- Gallery order is wrong because of the seed sort_order values (catalog.ts:100 sorts by sort_order). Dry Fruits shows 01,04,02,03,05 and Fresh Raw Banana shows 04,03,05,02,01 (initial-data.json:556,666,600,677,589 / 655,622,611,567,644). The seed is loaded once with INSERT IGNORE (install.ts:97-107), so changing the JSON will not reorder an already-installed database.
- The gallery renders every product image, including the front_label/back_label artwork (sort_order 6-7), so 7 thumbnails appear instead of the 5 brief photos. The labelImage() helper meant for separate label views (catalog.ts:211-214) is never used.
- All seeded claims and benefits are approved:false and shelf_life_approved is false, so the highlight chips, the benefits list and the shelf-life text are all hidden on the PDP until the owner approves them (catalog.ts:78-84,117-121).

**Gaps (status · requirement · what is missing · evidence)**

- **[broken] PDP is reachable and the product can be bought (precondition for every PDP item below)** — On the live deployment (no DB) every /products/<slug> returns 404. With a DB attached they still 404 until the owner publishes them. Once published they show 'Sold out' with no quantity, Add to Cart or Buy Now until stock is entered.  
  _Evidence:_ src/app/(store)/products/[slug]/page.tsx:56-57 calls notFound() when getProductBySlug and getPreviewProductBySlug both return null. src/lib/data/catalog.ts:143-157: getPublishedProducts returns [] when getPublicDb() is null (src/lib/db/client.ts:78-79 returns null if !isDatabaseConfigured()). Seed products are status "draft" (src/lib/db/data/initial-data.json:306,408), and RLS hides drafts and their images (src/lib/db/rest/policies.ts:97,100). Seed stock is 0 (initial-data.json:513,528), so variantAvailability gives out_of_stock (catalog.ts:201), and BuyBox renders only a disabled 'Sold out' button (src/components/product/add-to-cart.tsx:107-116).  
  _Files:_ src/lib/data/catalog.ts, src/app/(store)/products/[slug]/page.tsx, src/lib/db/data/initial-data.json
- **[partial] Gallery: 5 clickable thumbnails** — 7 thumbnails appear, not 5. The label artwork is mixed into the photo strip. The desktop column of 7 x 80px thumbnails (lg:flex-col) can be taller than the main image.  
  _Evidence:_ gallery.tsx:104-123 renders one <button> thumbnail per image (setIndex(i), aria-current, ring highlight). It maps over every product image, and each seeded product has 7 (5 photos plus front_label/back_label at sort_order 6 and 7: initial-data.json:545,578,633,688).  
  _Files:_ src/components/product/gallery.tsx, src/lib/db/data/initial-data.json
- **[partial] Gallery: smooth image transitions** — There is only a fade-up on the incoming image. The outgoing image vanishes instantly (no crossfade or slide), and the lightbox has no transition between images. The motion package is not used here.  
  _Evidence:_ gallery.tsx:64 key={current.id} remounts the <Image>. gallery.tsx:70 adds class animate-fade-in (globals.css:42 'fade-in 0.5s ... both', keyframes at globals.css:53-56: opacity 0 + translateY(6px) to none). No motion/AnimatePresence is used in the gallery.  
  _Files:_ src/components/product/gallery.tsx
- **[partial] Gallery: fullscreen lightbox** — It is a centred modal at most 672px wide, not a fullscreen viewer. It has no thumbnail strip, no swipe and no kind/label badge. Prev/Next are shown even when there is only one image (gallery.tsx:155-173).  
  _Evidence:_ gallery.tsx:125-175 opens <Sheet side="center"> (a native <dialog> with showModal: focus trap, Esc closes, backdrop click closes; sheet.tsx:32-44,58-70). Its size is capped by sheet.tsx:66 'w-[min(42rem,calc(100%-2rem))]' plus max-h-[92dvh]/[85dvh], and the image box by max-h-[70dvh] (gallery.tsx:150).  
  _Files:_ src/components/product/gallery.tsx, src/components/ui/sheet.tsx
- **[broken] Gallery: desktop hover zoom** — In the CSS cascade, animation declarations outrank normal author declarations, inline style included. With fill-mode 'both', the final transform:none keeps applying after the animation ends, so scale(1.6) never takes effect and the hover zoom never shows. Reduced-motion users are affected too (globals.css:111-116 shortens the duration but keeps the fill). If this is fixed, touch devices will need a guard: emulated mouseenter on tap sets hovering=true with no mouseleave, so the zoom would stick.  
  _Evidence:_ gallery.tsx:54-59,70-71 sets an inline style transform: hovering ? 'scale(1.6)' : 'scale(1)' on an <Image> that also has class animate-fade-in. The compiled CSS (.next) is '.animate-fade-in{animation:var(--animate-fade-in)}' = 'fade-in 0.5s ... both', and the 'to' keyframe sets transform:none (globals.css:42,53-56).  
  _Files:_ src/components/product/gallery.tsx, src/app/globals.css
- **[missing] Gallery: mobile swipe** — The main image and the lightbox cannot be swiped between images on mobile.  
  _Evidence:_ gallery.tsx has no touch, pointer or drag handlers (only onClick, onMouseMove, onMouseEnter and onMouseLeave at 53-59) and no motion drag. The thumbnail strip is only overflow-x-auto (line 105).  
  _Files:_ src/components/product/gallery.tsx
- **[partial] Gallery: prev/next controls** — The desktop inline gallery has no prev/next; desktop users can only use the thumbnails.  
  _Evidence:_ Inline chevron buttons at gallery.tsx:82-101 are 'lg:hidden', so mobile only. The lightbox has Previous/Next at gallery.tsx:155-173. go() wraps around (26-32).  
  _Files:_ src/components/product/gallery.tsx
- **[partial] Gallery: keyboard navigation** — The inline gallery has no arrow-key navigation (no roving tabindex on the thumbnail list) and no aria-live announcement when the image changes. In the zoomed lightbox, arrow keys switch images instead of scrolling the zoomed image.  
  _Evidence:_ gallery.tsx:34-42: the ArrowLeft/ArrowRight window listener is attached only while viewerOpen. Esc is handled by the native dialog. Thumbnails and the main image are real <button>s, so Tab and Enter work (51-62,108-117).  
  _Files:_ src/components/product/gallery.tsx
- **[missing] Gallery: loading placeholders** — There is no blur, shimmer or skeleton for gallery images and no route-level loading skeleton for the PDP. globals.css defines --animate-shimmer (line 43), but the gallery does not use it.  
  _Evidence:_ No <Image> in gallery.tsx (63-72,118,139-148,151) or product-card.tsx sets placeholder or blurDataURL. There is no loading.tsx under src/app/(store)/products/[slug]/ (only page.tsx). The only fallback is the bg-paper container colour (gallery.tsx:60).  
  _Files:_ src/components/product/gallery.tsx, src/app/(store)/products/[slug]/loading.tsx
- **[partial] No cropping of pouches (object-contain)** — PDP: done. Cards: no crop today only because all 01-05 photos are 1254x1254 squares in an aspect-square box. A non-square primary image would be cropped, and the hover scale trims about 2% off each edge of the pouch.  
  _Evidence:_ The PDP gallery uses object-contain for the main image, thumbnails and lightbox (gallery.tsx:70,118,151). ProductCard uses object-cover plus group-hover:scale-[1.045] inside overflow-hidden (product-card.tsx:50,59).  
  _Files:_ src/components/product/product-card.tsx
- **[broken] Gallery order: 01 main hero, 02 front&back, 03 ingredients/benefits, 04 beauty shot, 05 lifestyle** — Neither product follows the 01-05 order in the brief. Dry Fruits has 04 second for no documented reason. Fresh Raw Banana's primary image (used on cards, search, OG and JSON-LD) is the 04 beauty shot, not the 01 hero. Correcting the JSON alone will not change a database that is already seeded; that needs a data migration/UPDATE or an admin reorder. The brief's order also conflicts with the documented allergen-confusion decision for fresh-raw 01/02, so the owner must decide.  
  _Evidence:_ catalog.ts:100 sorts images by sort_order, so the seed data sets the order. Dry Fruits & Seeds: 01=1 (initial-data.json:556), 04=2 (666), 02=3 (600), 03=4 (677), 05=5 (589), so the actual order is 01,04,02,03,05. Fresh Raw Banana: 04=1 (655), 03=2 (622), 05=3 (611), 02=4 (567), 01=5 (644), so the actual order is 04,03,05,02,01. The fresh-raw demotion of 01/02 is deliberate (docs/OWNER_CHECKLIST.md:56-58: those images show nuts as props). Kinds are inconsistent: dry 03 is 'lifestyle' (674), fresh 03 is 'packshot' (619). The seed loads once with INSERT IGNORE (src/lib/db/install.ts:97-107).  
  _Files:_ src/lib/db/data/initial-data.json, src/lib/db/install.ts
- **[partial] Label artwork (front_label/back_label) display** — Labels are not separated from the 5-photo gallery: there is no 'View pack label' link next to ingredients or nutrition, and the helper is unused. The landscape front label is shown small in the square frame. Label scans are submitted to search engines as product images.  
  _Evidence:_ Labels appear as gallery slides 6-7 with a 'Front label artwork'/'Back label artwork' pill (gallery.tsx:11,76-80). The front label is 2048x1157 landscape, letterboxed in a square frame by object-contain. The lightbox 100% zoom allows reading label text. labelImage() at catalog.ts:211-214 has no callers. ProductCard hover excludes labels (product-card.tsx:30). JSON-LD 'image' includes the label artwork (src/lib/seo/jsonld.tsx:91).  
  _Files:_ src/components/product/gallery.tsx, src/app/(store)/products/[slug]/page.tsx, src/lib/seo/jsonld.tsx
- **[missing] PDP: wishlist** — There is no wishlist button, storage, account page or API.  
  _Evidence:_ Searching src for 'wishlist|favourite|favorite' finds only marketing copy in shop/page.tsx:118. There is no wishlist table in src/lib/db/schema.ts and no UI or action.  
  _Files:_ src/lib/db/schema.ts, src/components/product/add-to-cart.tsx, src/app/(store)/products/[slug]/page.tsx
- **[partial] PDP: key benefits (approved only)** — The approval gating works end to end, but there is no 'Key benefits' heading or section: the benefits appear as an unlabelled list in the Ingredients/allergen accordion. Nothing shows until the owner approves.  
  _Evidence:_ Filtering is correct: approvedLabels() (catalog.ts:78-84) keeps only approved===true for both claims and benefits (117-118). Benefits render at page.tsx:170-178 inside the Ingredients accordion; claims render as chips at 125-138. All seeded claims and benefits are approved:false (initial-data.json products), and the admin flags unapproved items (product-editor.tsx:101,180-183).  
  _Files:_ src/app/(store)/products/[slug]/page.tsx
- **[partial] PDP: shipping info** — There is no PIN-code serviceability or delivery-estimate check on the PDP, no shipping cost or free-shipping threshold, and no COD availability note.  
  _Evidence:_ Static bullets at page.tsx:142-152 ('Shipping calculated from your PIN code at checkout'). A 'Shipping & returns' accordion (215-219) uses product.shipping_returns_md or settings.product_defaults.shipping_returns_md (seeded at initial-data.json:172).  
  _Files:_ src/app/(store)/products/[slug]/page.tsx
- **[partial] PDP: reviews & ratings** — Reviews cannot include photos or media (no columns at schema.ts:627-647). There is no rating distribution or histogram, no sorting, filtering or pagination, and stats are not passed to related ProductCards (page.tsx:295).  
  _Evidence:_ page.tsx:99-103 shows the star summary linking to #reviews. The reviews section (231-284) has a list with a verified-purchase badge and admin reply, plus an empty state. reviews.ts:21-45 returns approved reviews only (global limit 200) and computes stats. ReviewForm (review-form.tsx) posts to submitReviewAction (engagement.ts: requires sign-in, published product, optional verified purchase, moderated).  
  _Files:_ src/app/(store)/products/[slug]/page.tsx, src/lib/data/reviews.ts, src/components/product/review-form.tsx, src/lib/db/schema.ts
- **[missing] PDP: sharing options** — There are no share buttons or Web Share API on the PDP.  
  _Evidence:_ There is no navigator.share, copy-link or WhatsApp/Facebook share in page.tsx or the product components. WhatsApp appears only in the footer and contact page (site-footer.tsx:50, contact/page.tsx:48-55).  
  _Files:_ src/app/(store)/products/[slug]/page.tsx
- **[missing] PDP: sticky / mobile purchase controls** — There is no sticky add-to-cart/buy-now bar on mobile. After scrolling past the buy box, the user must scroll back up to purchase.  
  _Evidence:_ The only sticky element on the PDP is the desktop gallery wrapper 'lg:sticky lg:top-28' (page.tsx:86). The BuyBox is inline (page.tsx:140-153). There is no fixed bottom bar anywhere in src/components/product or the store layout.  
  _Files:_ src/app/(store)/products/[slug]/page.tsx, src/components/product/add-to-cart.tsx

_Notes:_ Read-only audit; no files were modified. Files inspected: src/app/(store)/products/[slug]/page.tsx, src/components/product/{gallery,add-to-cart,product-card,review-form}.tsx, src/lib/data/{catalog,reviews}.ts, src/components/ui/{sheet,quantity,misc}.tsx, src/lib/seo/jsonld.tsx, src/app/globals.css, next.config.ts, src/lib/db/data/initial-data.json, src/lib/db/install.ts, src/lib/db/rest/policies.ts, docs/OWNER_CHECKLIST.md. The real image dimensions were checked from the webp headers and match the seeded width/height. The hover-zoom finding rests on the compiled CSS in .next ('.animate-fade-in{animation:var(--animate-fade-in)}') and CSS cascade rules; it could not be confirmed in a browser because no Playwright browser is installed. The Fresh Raw Banana reorder (01/02 moved last) is a documented deliberate decision (docs/OWNER_CHECKLIST.md:56-58: those images show nuts as props for a nut-free product). The brief's 01-05 order conflicts with it, so the owner should decide before it is changed. Dry Fruits & Seeds has no such justification for putting 04 second. No e2e or unit tests cover the gallery, lightbox, zoom or Buy Now; tests only click 'Add to cart' (tests/e2e/support/helpers.ts:28, storefront.spec.ts:22,66). The PDP's own JSX is otherwise solid: an accessible accordion layout, a semantic nutrition table, approval-gated claims and real-data-only ratings. The main gaps are the missing wishlist, sharing, sticky mobile buy bar, swipe, placeholders and review media, plus the broken hover zoom and wrong image order.

## Audit: Homepage sections, animations and smooth scrolling (brief Phases 5 and 6, homepage list)

**Root causes**

- The live site has no DB: getHomeSections returns [] (src/lib/data/content.ts:28), so src/app/(store)/page.tsx:90-94 renders only the store name and tagline. Header nav and footer links also fall back to empty defaults (src/lib/settings/schema.ts:59-61). None of the CMS homepage sections appear, and there is no code fallback to the bundled initial-data sections.
- Both seeded products are status 'draft' (initial-data.json), and getPublishedProducts filters status='published' (src/lib/data/catalog.ts:149). Featured products therefore shows the 'being prepared' EmptyState, the Comparison and ingredients block returns null (sections.tsx:169), the hero product badge is hidden (hero.tsx:125), staggered product cards never run, and the /#compare FAQ link points to nothing.
- The section registry (src/lib/cms/sections.ts:64-308) has no types for 'How to enjoy', 'Ingredients & natural goodness' or 'Verified product benefits'. The nearest types, trust_strip and how_its_made, are seeded is_visible:false, and how_its_made has empty steps.
- The root <html> (src/app/layout.tsx:59) lacks data-scroll-behavior="smooth" while globals.css:66 sets scroll-behavior:smooth. In Next 16 this makes every route transition smooth-scroll to the top (next/dist/shared/lib/router/utils/disable-smooth-scroll.js:22-31).
- The hero's motion elements are server-rendered at opacity:0 and lack the data-reveal attribute, which is the only no-JS fallback (src/app/(store)/layout.tsx:60-62). Hero CTAs and supporting text are invisible until JS hydrates, or permanently without JS.
- Several brief animations are not implemented: hero heading entrance, floating pouch, image mask reveals, icon-specific benefit animation and quick view.

**Gaps (status · requirement · what is missing · evidence)**

- **[partial] Featured products section (CMS-editable)** — The code is complete, but customers see no products end to end: both products are draft (and the live site has no DB). The section has no quick-view action.  
  _Evidence:_ Type defined at src/lib/cms/sections.ts:116-140, including a product_slugs picker. Rendered by src/components/home/sections.tsx:41-90 as a staggered grid of ProductCard. The fallback chain is chosen slugs, then is_featured, then all products (sections.tsx:50-55). getPublishedProducts filters status='published' (src/lib/data/catalog.ts:149). Both seeded products are status 'draft', so chosen is empty and the section renders EmptyState 'Our products are being prepared' (sections.tsx:72-77).  
  _Files:_ src/components/home/sections.tsx, src/lib/db/data/initial-data.json
- **[partial] Ingredients & natural goodness section** — Needs an editable 'Ingredients & natural goodness' section type (ingredient list, imagery, icons) that does not depend on published products. The comparison is currently hidden.  
  _Evidence:_ No dedicated section type exists in SECTION_TYPES (src/lib/cms/sections.ts:64-308). The closest pieces: (1) Comparison (sections.tsx:168-251) shows 'Ingredients (as printed)', allergens and nutrition, but returns null when fewer than 2 products are published (sections.tsx:169), which is the case now. (2) trust_strip (sections.ts:96-115) with '100% Natural' and similar chips is seeded is_visible:false in both its draft and published rows. The 03-ingredients-benefits-display.webp images are not used on the homepage.  
  _Files:_ src/lib/cms/sections.ts, src/components/home/sections.tsx, src/app/(store)/page.tsx, src/lib/db/data/initial-data.json
- **[missing] How to enjoy section** — Add a section type, renderer and switch case in page.tsx for serving ideas, plus seed content.  
  _Evidence:_ SECTION_TYPES has no 'how to enjoy' or serving-ideas type. how_its_made (sections.ts:204-233; sections.tsx:253-274) covers manufacturing steps, is seeded is_visible:false with steps:[], and returns null when steps are empty (sections.tsx:255).  
  _Files:_ src/lib/cms/sections.ts, src/components/home/sections.tsx, src/app/(store)/page.tsx, src/lib/db/data/initial-data.json
- **[partial] Verified product benefits section** — No visible verified-benefits section. trust_strip is hidden by default, and there is no dedicated benefits type with icons, source or label reference.  
  _Evidence:_ Only trust_strip ('A short row of approved product facts. Only add claims you have verified.', sections.ts:96-115) comes close, and it is seeded is_visible:false (initial-data.json trust rows). Promise items are brand values, not verified pack benefits. No section ties benefits to label or nutrition data.  
  _Files:_ src/lib/cms/sections.ts, src/components/home/sections.tsx, src/lib/db/data/initial-data.json
- **[broken] Homepage renders sections on the live deployment (no DB connected)** — The live homepage shows none of the sections. There is no code fallback to the bundled initial-data sections or defaults while the DB is unconfigured.  
  _Evidence:_ getHomeSections returns [] when there is no DB (src/lib/data/content.ts:28). page.tsx:90-94 then renders only a bare h1 with the store name and tagline. Without a DB, header nav defaults to [] (src/lib/settings/schema.ts:59-61), and products, FAQs and banners all return [] (catalog.ts:145, content.ts:112,139).  
  _Files:_ src/app/(store)/page.tsx, src/lib/data/content.ts
- **[missing] Hero heading entrance animation** — No heading entrance. Adding one (for example a CSS-only line or word reveal) must avoid opacity:0 on the LCP text.  
  _Evidence:_ The h1 at hero.tsx:60-63 is a plain element with no motion. Only the eyebrow, subheadline and CTA row animate. This is probably intentional to protect LCP.  
  _Files:_ src/components/home/hero.tsx
- **[missing] Floating pouch animation** — Add a subtle looping transform-only float to the hero pouch, disabled for reduced motion.  
  _Evidence:_ The hero main image has only a one-shot scale 1.05→1, y 12→0 entrance (hero.tsx:90-95). Nothing loops or floats on the pouch. The secondary image gets only an entrance and parallax (hero.tsx:108-123).  
  _Files:_ src/components/home/hero.tsx, src/app/globals.css
- **[missing] Image mask reveals** — Add a clip-path/inset mask reveal for hero, story and product imagery.  
  _Evidence:_ No clip-path, mask or inset() reveal exists anywhere in src (grep returned nothing). All image reveals are opacity, translate or scale only.  
  _Files:_ src/components/motion/motion.tsx, src/components/home/sections.tsx, src/components/home/hero.tsx
- **[partial] Benefit icons animate** — No dedicated icon animation.  
  _Evidence:_ Promise icons (sections.tsx:150-152) and trust-strip icons (sections.tsx:28-31) appear only as part of their parent card or item fade and rise via StaggerItem. There is no icon-specific animation such as scale, pop, draw or rotate. The trust strip is hidden in the seed data.  
  _Files:_ src/components/home/sections.tsx
- **[missing] Quick view** — Quick-view modal or sheet from product cards is absent.  
  _Evidence:_ No QuickView or quick-view code exists in src (grep -i returned nothing). ProductCard links only to the PDP (product-card.tsx:37-41,76).  
  _Files:_ src/components/product/product-card.tsx
- **[partial] Smooth anchor scrolling with sticky header offset** — Add data-scroll-behavior="smooth" to <html>. The anchor targets depend on DB data and published products.  
  _Evidence:_ globals.css:64-68 sets html scroll-behavior:smooth and scroll-padding-top:6rem. The header is sticky and h-[4.5rem], or lg:h-20 (site-header.tsx:63,69), so the 96px offset covers it. Section ids exist: #shop (sections.tsx:58), #why-unar (136), #compare (181). However, src/app/layout.tsx:59 does not set data-scroll-behavior="smooth". In Next 16, node_modules/next/dist/shared/lib/router/utils/disable-smooth-scroll.js:22-31 then skips the override, so every route change smooth-scrolls to the top instead of jumping (a dev warning is also emitted). The /#compare link in a seeded FAQ answer is dead while fewer than 2 products are published (sections.tsx:169).  
  _Files:_ src/app/layout.tsx, src/app/globals.css
- **[partial] prefers-reduced-motion support** — SVG line-drawing still animates under reduced motion. Botanical paths should be set to pathLength 1 when reduced motion is on.  
  _Evidence:_ MotionConfig reducedMotion="user" (motion.tsx:13) skips only positional and transform keys (node_modules/motion-dom/dist/es/animation/interfaces/visual-element-target.mjs:84 with render/utils/keys-position.mjs). Opacity fades and SVG pathLength still animate. botanical.tsx:8-9 claims the reduced-motion setting shows the drawings instantly, but they still draw over about 1.8 s. Parallax checks useReducedMotion (motion.tsx:98-102). The CSS @media rule (globals.css:111-118) stops CSS animations and transitions and turns off smooth scroll.  
  _Files:_ src/components/brand/botanical.tsx, src/components/motion/motion.tsx
- **[partial] Layout-shift risks** — Hero motion elements need the data-reveal noscript fallback, or should render visible by default.  
  _Evidence:_ Low CLS overall. Images use fill inside aspect-ratio boxes (hero.tsx:89,96; sections.tsx:101; product-card.tsx:39). Reveals use transforms. The header's scrolled state keeps a 1px border in both states (site-header.tsx:64-66). Fonts use next/font with display:swap (layout.tsx:10-29). Risks: (1) Server-rendered motion initial styles make section content opacity:0 until hydration. (2) Hero rise() elements and the secondary image or badge (hero.tsx:55,65,69,110,126) lack data-reveal, so the noscript fallback (src/app/(store)/layout.tsx:60-62) misses them and the hero subheadline and CTAs stay invisible without JS. (3) The newsletter success state swaps out the form (newsletter-form.tsx:13).  
  _Files:_ src/components/home/hero.tsx, src/app/(store)/layout.tsx
- **[broken] Story section decorative backdrop square** — Give the image column 'relative z-0' or 'isolate', or drop -z-10.  
  _Evidence:_ sections.tsx:111 has an absolute -z-10 sage square. Its ancestors (sections.tsx:94-97) create no stacking context, so it paints below the positioned section's bg-paper background and is most likely invisible.  
  _Files:_ src/components/home/sections.tsx

_Notes:_ Overall: the section and motion system is well built. It has a Zod-validated registry, an admin draft/preview/publish editor, a LazyMotion+m setup with reduced-motion config, and reusable Reveal, Stagger and Parallax components. The site is broken at runtime mostly because of data and environment, not code: no DB on live, and products in draft. Motion package: motion@14.0.0 (framer-motion@14.0.0, motion-dom@14.0.0). It uses LazyMotion with domAnimation in strict mode, so only m.* components are allowed. domAnimation is statically imported, not code-split, so it ships in the store layout's client bundle on every storefront page, at an estimated 20-25 KB gzipped. Every homepage section is wrapped in client motion components (sections.tsx itself is a server component that passes children through). DrawOnView (motion.tsx:111-149) is unused. In preview mode, getHomeSections still filters out hidden sections (content.ts:42), so hidden sections cannot be previewed. The botanical SVG decorations are absent below lg in the hero. Reduced-motion users still see opacity fades and SVG line-draws. Recommended fixes, roughly in priority order: connect the DB and publish the products; add data-scroll-behavior; add the missing section types (how-to-enjoy, ingredients, verified-benefits) and seed them; add data-reveal or a visible-by-default fallback for the hero; add a pouch float, mask reveals and quick view; set botanical pathLength instantly under reduced motion.

## Not audited yet (session ran out) — audit these first
- Reviews & customer features: reviews need photo (max 5) and video uploads
  with moderation, size/type limits, spam prevention; search page, filters,
  newsletter, FAQ accordion, contact, order tracking, account dashboard.
- Admin dashboard completeness (overview metrics + sales chart, 5-image
  gallery management, featured selection, content, marketing), server-side
  role checks on every admin page/action.
- Commerce journey + performance/security/SEO (cart → checkout → Razorpay
  verify/webhook → confirmation → account → admin).
- Dead buttons / placeholders / fake data sweep.

## Work plan (from the brief, in order)
1. Phase 2–3 fixes above (data migration + published products + gallery
   order + accounts without email + security fixes). Update the integration
   test tests/integration/mysql-schema.test.ts (it asserts drafts today).
2. Phase 4 gallery: 5 thumbnails, crossfade, swipe, prev/next, keyboard,
   fullscreen lightbox with zoom/pan, shimmer placeholders, fix the broken
   desktop hover zoom (animation fill-mode overrides inline transform in
   src/components/product/gallery.tsx), separate pack-label view.
3. Phase 5 animations (motion): hero heading/CTA entrance that stays visible
   without JS, floating pouch, botanical parallax, mask reveals, staggered
   cards, benefit icons, add-to-cart confirmation, quick view;
   data-scroll-behavior="smooth" on <html>, scroll-padding for sticky header,
   prefers-reduced-motion everywhere.
4. Phase 6: new CMS section types "Ingredients & natural goodness", "How to
   enjoy", "Verified product benefits" (shows only owner-approved claims);
   PDP: wishlist, share, sticky mobile buy bar, shipping/PIN check, key
   benefits section; reviews with photo/video uploads + moderation.
5. Phase 7–9: admin gaps, commerce checks, perf/security/SEO.
6. Phase 10: Playwright for the 22 scenarios in the brief (tests/e2e), unit +
   DB tests on MySQL 8 and MariaDB, `npm run build` must pass WITHOUT a
   database (Hostinger builds without one), update docs, push.

## Rules (from the owner)
- Never invent testimonials, health claims, certifications, sales numbers,
  discounts, shelf life or tax values; claims/benefits/shelf life show only
  when the owner approves them in the dashboard.
- Never redraw or alter the UNAR logo or packaging; keep forest/olive/cream/
  sage branding.
- Never destroy production data; schema changes are additive (install.ts).
- No dead buttons, fake payment success, or simulated live payments.
- Never put secrets in code, logs or chat.
