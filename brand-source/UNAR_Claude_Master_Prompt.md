# UNAR — Claude master website build prompt

You are my **senior full-stack e-commerce developer, UI/UX designer, motion designer, database architect, QA engineer and deployment guide**. Build a real, production-oriented, premium animated e-commerce website and a powerful admin dashboard for my Indian food brand **UNAR**. I am a graphic designer, not a programmer. **Implement the code, database, admin features and integrations, not only a prototype or landing page.** Explain unavoidable third-party account steps in plain language.

## 1. Reference and brand

- Reference website for **section flow and shopping experience only**: https://aramnarpavi.com/. Study its nature-led hero, storytelling, benefits, catalogue, testimonials, FAQs and contact experience. Make the UNAR website **visually original, more premium and more polished**. Do not copy reference brand assets, text, code or photography.
- Brand name: **UNAR**. Exact tagline: **One Healthy Habit a Day**. Brand personality: natural, premium, wholesome, trustworthy, Indian, warm, minimal.
- Use all uploaded brand images and packaging references. **Never redraw, re-type, reinterpret or distort the official UNAR logo or packaging text**. Do not invent a new identity. Use original artwork files where possible. Provide a clean way in dashboard to replace/add a genuine transparent SVG logo later.
- Brand palette: forest green `#2E4E36`, olive green `#7A8F3D`, warm cream `#F2F1E6`, soft sage `#A8B99A`. Complementary warm white, dark graphite body text and restrained natural banana-yellow as an accent only. Keep contrast accessible. Do not make yellow the dominant brand colour.
- Design system: refined editorial serif display headings, legible modern sans-serif UI/body font, generous spacing, soft rounded corners, restrained botanical leaf line art, subtle paper texture if performant, premium product photography and deliberate typography. No generic template look, loud gradients, oversized glow, random stock photos or clutter.

## 2. Products — seed from supplied packaging, but admin-editable

Create two real catalogue entries (see `products.seed.json` for structured facts):
1. **Dehydrated Banana Chewy — With Dry Fruits & Seeds**, 100 g, packaging MRP **₹149**, with bananas, nuts and seeds; contains sesame and tree nuts (almonds/cashews).
2. **Dehydrated Banana Chewy — Fresh Raw Banana**, 100 g, packaging MRP **₹120**, ingredient listed as fresh raw banana.

Use the uploaded FRONT and BACK artworks belonging to each product in its gallery, with original aspect ratio and accurate typography. **These flat label designs are NOT photographs of finished physical pouches**. Never fake 3D packaging, invent new labels, fabricate photos or use a Moringa powder product as an UNAR listing. Design clean image placeholders if finished packshots are unavailable; everything should be replaceable in admin. Nutritions and ingredients can populate detailed product tabs from `products.seed.json`; keep label values exact. Claims (including gluten free, no added sugar, 100% natural, shelf life) must be confirmed by the owner before publication; make every claim and label editable. Do not fabricate reviews or sales metrics. Default inventory must be 0 or an explicitly marked demo value until actual stock is entered; users must not be able to purchase nonexistent stock.

## 3. Homepage and customer experience

Build a coherent, animated and responsive shopping site with these sections:
- Elegant desktop/mobile sticky navigation with exact UNAR logo, Shop, Our Story, Why UNAR, FAQs, Contact, Search, Account and Cart. Good accessible mobile menu.
- Strong **nature-inspired hero** in warm cream and green with editorial headline such as **“Everyday snacking, naturally better.”**, a tasteful product composition when genuine packshots exist, tasteful leaf parallax, CTA **Shop Banana Chewy**, secondary CTA **Our Story**. No unsupported health promises.
- Small three/four-value trust strip with only owner-approved label claims.
- **Shop the Goodness** two-product showcase with images, descriptions, prices in INR, clear cart actions and availability.
- Split-screen ingredient/story editorial section with botanical visual details and premium product imagery.
- **The UNAR Promise**: sourced ingredients, transparency, mindful daily snacking; no unverified certifications.
- Product comparison block for the two variations, clear ingredient/allergen distinction.
- Optional **How it's Made** section that says only what has been validated by the owner; don't fabricate a manufacturing process.
- Genuine moderated customer reviews and testimonials (empty state until reviews exist), FAQ accordion, newsletter signup with consent, Instagram section with approved posts only, contact and polished footer.
- Fully working Shop page: search, sort, filter, categories/collections, pagination or load more, sale/stock badges where applicable.
- Full individual product pages: product gallery, image zoom, SKU/weight, live stock, INR price, quantity control, add-to-cart, buy-now, ingredients, allergens, nutrition per 100 g, storage and shelf life if approved, shipping/returns information, related products and customer reviews.
- Working cart drawer/page with quantity change, remove, shipping estimate, coupon, order summary, no layout shifts.
- Customer authentication, profile, saved addresses, order history, order details, invoice download and shipment tracking. Provide guest checkout if feasible without weakening order access security.
- Real checkout: Indian name, mobile, email, full address, city, state, PIN validation; accurate shipping and taxes; payment processing and order confirmation. Avoid promising delivery timelines not configured by admin.
- About UNAR, Contact, FAQs, Shipping Policy, Refund/Returns, Cancellation, Privacy Policy, Terms, and appropriate consent. Legal text must be marked **OWNER REVIEW REQUIRED** until approved, not falsely presented as lawyer-approved.
- Make navigation, filters, forms, CTA buttons and empty/loading/error states actually work; never place decorative controls that don't do anything.

## 4. Motion and performance

Premium motion, not excessive animation. Use Motion for React/Framer Motion sparingly and CSS where possible:
- Soft page entrance reveals and staggering; botanical line details subtly drifting or revealing.
- Natural smooth anchor scrolling and carefully controlled parallax on larger screens.
- Hover lift, understated image scale, animated underlines and add-to-cart microinteraction.
- A polished page transition only if it does not harm navigational usability or performance.
- Respect `prefers-reduced-motion`. Do not animate product details while user is trying to read. On mobile reduce heavy motion and scroll effects.
- Responsive layouts for 360px through ultra-wide, proper touch targets, CLS avoidance, image lazy loading and modern WebP/AVIF optimizations. Target strong real-world Core Web Vitals, keyboard navigation, contrast and screen-reader support.

## 5. Actual full-stack architecture

Prefer one maintainable **Next.js App Router + TypeScript + Tailwind CSS** application with storefront and protected `/admin` dashboard, **Supabase Postgres + Supabase Auth + Supabase Storage**, and a well-defined typed data-access layer. Use current compatible versions at implementation time; use a safe server-driven architecture, not client-trusted state or static JSON masquerading as a database. Use server-side validation with Zod or equivalent. Add migrations, seed scripts and README. Keep business configuration database-backed where practical.

Deploy source to a **GitHub repository**, app to **Vercel**, database/storage/auth in **Supabase**, and use a custom domain managed at my domain registrar/Hostinger DNS if applicable. Use env vars for credentials. Do not place secret tokens in browser code, the repository, logs or screenshots. If you cannot directly connect an account, create the project and give precise **click-by-click, beginner-friendly** instructions for only the necessary manual steps.

Payments: implement a production-capable **Razorpay** integration for Indian checkout (UPI/cards/netbanking depending on merchant activation), with server-created orders, server-side signature verification, authentic webhook validation, idempotent webhook handling, reconciliation of payment status, and tested success/failure/cancellation paths. Include configurable Cash on Delivery only if I enable it. Use Razorpay test mode before launch. No fake payment-success UI.

Shipping: add a configurable shipping rules engine (PIN support, flat shipping, free-shipping threshold, pickup/weight details) and order fulfillment controls. Architect optional **Shiprocket** API integration behind real env credentials; fallback to honest manual tracking and status updates. Do not fake Shiprocket connectivity.

Notifications: integrate a real email provider such as Resend after credentials are added, with testable order placed/payment confirmed/shipped/cancelled messages and password reset. Keep WhatsApp notification hooks optional and disabled until a compliant provider is set up; do not claim integration without activation.

## 6. Complete no-code admin dashboard

Build an elegant, functional, secure admin application with desktop sidebar and mobile responsive navigation. Use role-based access (`owner/admin`, `content editor`, `fulfillment staff`) with enforced server checks on **every** protected operation; not just hidden UI.

Dashboard features:
1. **Overview:** real paid revenue, paid orders, pending orders, refund totals, low-stock notices, best sellers, real date range filters and graphs; no dummy metrics shown as real.
2. **Product management:** add/edit/delete/clone/archive, product collections, variations and weights, SKU/barcode, MRP/selling price/discount, status draft/published, stock, low-stock threshold, ingredients, allergens, nutrition table, claims, storage instructions, SEO, metadata and drag-and-drop image gallery.
3. **Inventory:** stock adjustments with audit trails, stock movement reports, out-of-stock prevention, stock recovery on cancelled/failed payments, concurrency-safe stock reservation or equivalent transaction handling.
4. **Orders:** payment status, fulfillment status, order detail, customer/address, packing slip, downloadable invoice/receipt, courier/tracking details, shipment updates, cancellation, returns/refunds with appropriate Razorpay API checks, CSV export and date filters.
5. **Customers:** real accounts/guest orders, contact details, past orders and basic spend totals; avoid exposing data to unrelated users.
6. **Content manager:** update homepage hero text and imagery, banners, CTA buttons, section sequence and visibility, About page, benefit blocks, FAQ items, footer/contact, blog/articles, policies, links and announcement bar **without touching code**. Include preview/draft/publish controls; protect drafts server-side.
7. **Marketing:** coupons with amount/percentage, usage limits, dates and minimum cart; featured products, promo banners, abandoned cart reporting only with lawful consent/data capture, newsletter subscribers with unsubscribe.
8. **Reviews:** verified-purchase option, spam protection, owner moderation; never seed fictitious testimonials.
9. **Reports:** sales, products, inventory, coupons, customers and tax-relevant reports, export CSV; date-range selection; correct handling of refunds and cancellations.
10. **Settings:** brand assets, logo, favicon, colours (with safe defaults), domain/site metadata, SEO defaults, official contact details, social links, shop currency INR, shipping, tax/GST settings, payment mode/status, legal pages, notification templates, user permissions and maintenance mode.
11. **Audit and operations:** admin activity log, meaningful error states, safe file uploads, change timestamps and clear integration/test status pages. Never expose API keys in the UI after save.

Settings must support Indian commerce. Handle taxes/GST as configurable; **never invent a GSTIN**, HSN/SAC or tax rates. Make invoices and accounting outputs reflect owner-configured tax/legal data and actual recorded transactions.

## 7. Data model and security

Create proper relational tables/schema and migrations for Users, Roles, Addresses, Products, Variants, Categories, ProductImages, InventoryMovements, Carts, CartItems, Orders, OrderItems, Payments, Refunds, Shipments, Coupons, CouponUsages, Reviews, CMSPages, CMSSections, FAQ, Banners, Subscribers, AuditLogs, Settings and WebhookEvents (adjust schema responsibly).

- Secure row-level policies where Supabase clients can access data; service credentials server-only. Enforce ownership checks on profile, cart, order and file reads. Never allow public access to draft content, admin endpoints or private receipts.
- Password handling via trusted auth provider; safe sessions, token refresh, email verification/reset, secure cookies.
- Validate prices/taxes/shipping/stock on server. Do **not** trust cart totals or discounts sent by browser.
- Rate limit auth/contact/review/payment endpoints; validate/sanitize file uploads; guard against XSS, CSRF as applicable, SQL injection, bot spam and insecure direct object references.
- Webhook idempotency, database transactions and coherent stock/payment/order states so retries cannot duplicate orders or decrement stock twice.
- Use accessible error and success feedback with no unhandled crashes. Add error monitoring hooks.
- Never say the site is "unhackable"; implement defensible modern security controls and document residual risks.

## 8. SEO, content and accuracy

- Page-specific titles/descriptions, canonical URLs, clean product and blog slugs, Open Graph images, robots, XML sitemap, correct product/Organization/BreadcrumbList structured data, image alt text and internal links.
- Mobile-first SEO and technically crawlable product pages. Use real review and availability data in schema; don't fabricate aggregateRating or in-stock states.
- Make a CMS blog available for owner-written helpful content about UNAR and banana snacks without unsupported medical promises.
- Business identity from packaging (owner to confirm before publishing): **UNAR**, `unarfoods@gmail.com`, `9994657693`, address `107 A2-4, Sulochana Villa, SAPS Cinema Theatre Thottam, Trichy Road, Palladam, Tiruppur - 641664`.
- Preserve the package's legitimate nutritional and licensing information exactly as submitted, but flag regulated food marketing statements, allergens, barcodes, FSSAI logo/license and policy wording for owner's final verification. No fake endorsements or certificates.

## 9. Quality control and delivery process

Work in real, runnable milestones and DO NOT stop after a visually attractive homepage:
1. Examine uploaded assets and summarize architecture, routes, entities and missing credentials. Proceed with reasonable defaults and mark anything that requires approval.
2. Create the complete codebase, responsive storefront, reusable design system, real database schema/migrations and secure sign-in.
3. Implement products, catalog, cart, checkout, payment testing, order lifecycle and notifications.
4. Implement every admin module and wire changes to the actual storefront/database.
5. Run lint, TypeScript checks, build, automated tests and realistic user flows: visit -> add to cart -> checkout -> payment confirmation -> admin order -> stock adjustment -> shipment; also payment failure, coupons, out-of-stock and mobile navigation.
6. Provide environment variable template without secret values, initial admin bootstrap steps, test accounts where appropriate, seeded products, GitHub/Vercel/Supabase/Razorpay setup and custom-domain/DNS directions in plain English.
7. State explicitly what is **implemented and tested**, what is **implemented but awaits credentials**, and what still needs **my approval**; never claim live integration or deployment if not done.

I want to manage products, prices, images, stock, banners, texts, orders, shipping, offers and reports entirely from the dashboard afterward. Structure the project so that Claude can later modify one feature without rebuilding or redesigning the entire site.

**My instruction:** Start by understanding the brand assets and reference. Then build the full working project in stages. Ask me only for necessary external-account credentials/approval at the right point (never ask me to paste secret keys in public chat or commit them in code). Preserve the UNAR brand exactly and prioritize a reliable, purchasable storefront and a usable backend as much as aesthetics.
