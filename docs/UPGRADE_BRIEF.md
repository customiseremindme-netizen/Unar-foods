# UNAR — Complete Website Repair, Animation & E-Commerce Upgrade (owner's brief)

Act as a senior full-stack developer, UI/UX designer, e-commerce engineer and QA tester.

My existing website: https://seashell-donkey-270999.hostingersite.com/
Reference website: https://aramnarpavi.com/

Brand: UNAR
Tagline: One Healthy Habit a Day

I have already built and deployed the UNAR website, but it is incomplete and several essential features are not working.

Your task is to AUDIT, FIX, IMPROVE AND COMPLETE THE EXISTING WEBSITE.

Do not unnecessarily rebuild it from scratch. Preserve the UNAR branding, colours, logo, product designs, existing content, URLs and functional features.

I am not a programmer. Complete the implementation yourself wherever you have access, explain only the external configuration steps that require me, and do not leave me with a collection of unfinished code snippets.

## PHASE 1 — Audit the Existing Project

Before modifying anything:

1. Inspect the complete source code, dependencies, routing, database, authentication, APIs, environment configuration, image handling and deployment setup.
2. Identify the actual framework and backend currently used. Do not assume a particular stack or introduce an unnecessary replacement.
3. Inspect browser console errors, server errors, failed network requests and deployment logs.
4. Check the production database connection and whether the storefront is reading the correct database.
5. Check existing admin dashboard functionality.
6. Identify the exact causes of the signup and missing-products problems.
7. Create a safe backup or rollback point before changing database schemas.
8. Preserve all existing customer accounts, orders and business records.

Do not simply redesign the pages and claim the issues are fixed.

If you do not have access to the existing project or deployment, ask me for the specific GitHub repository, project files or required access. Never pretend to have tested functionality you cannot access.

## PHASE 2 — FIX ACCOUNT REGISTRATION AND LOGIN

Current problem: Customers cannot successfully create new accounts.

Audit and repair the entire authentication system.

Make the following work correctly:

- New customer registration using name, email and password
- Password confirmation and validation
- Duplicate email detection
- Secure password hashing
- Email verification if enabled
- Customer login and logout
- Forgot password and secure password reset
- Persistent login sessions
- Redirect to My Account after successful login
- Session handling after page refresh
- Customer profile editing
- Saved shipping addresses
- Customer order history
- Mobile and desktop authentication

Check database user tables, authentication providers, environment variables, server routes, cookies, CSRF protection, CORS, database permissions and any confirmation-email configuration.

Provide clear validation and error messages.

Never expose database credentials or authentication secrets in frontend code.

Test registration with a new test account, then test login, logout, password reset and page refresh.

## PHASE 3 — FIX PRODUCTS NOT APPEARING

The live website currently displays zero products and a coming-soon message.

Fix this immediately.

The website must initially contain these TWO products:

PRODUCT 1
- Name: UNAR Dehydrated Banana Chewy — With Dry Fruits & Seeds
- Net Weight: 100 g
- MRP: ₹149
- Collection: Banana Chewy

PRODUCT 2
- Name: UNAR Dehydrated Banana Chewy — Fresh Raw Banana
- Net Weight: 100 g
- MRP: ₹120
- Collection: Banana Chewy

Use the uploaded packaging designs for accurate product information.

Check whether the missing products are caused by:

- Missing product records
- Incorrect database connection
- Draft/inactive product status
- Collection/category mismatches
- Stock filtering
- API failures
- Incorrect database permissions or RLS policies
- Server-rendering errors
- Cache invalidation problems
- Image URL errors

Create or repair product records without duplicating existing products.

Add an idempotent product import/seed mechanism.

The two products must appear in:

1. Homepage featured collection
2. Main Shop page
3. Banana Chewy collection
4. Product search
5. Individual product pages
6. Related products, where appropriate

The storefront should display each product even when inventory is zero, with a clear Sold Out state. Product visibility must not depend on whether the payment gateway has been configured.

## PHASE 4 — COMPLETE FIVE-IMAGE PRODUCT GALLERY

The UNAR product gallery WebP images are in the repository: public/images/products/<slug>/01..05 (originals in brand-source/gallery/UNAR_Product_Gallery_WebP).

Each product has five images:

1. Main hero pouch
2. Front and back pouch
3. Ingredients/benefits presentation
4. Premium product beauty shot
5. Lifestyle/product serving shot

Use these actual uploaded UNAR images. Do not replace them with random stock images.

Create a professional image gallery like a premium e-commerce store.

Required functionality:

- Large primary product image
- Five clickable image thumbnails
- Smooth gallery transitions
- Full-screen image preview/lightbox
- Zoom functionality
- Mobile swipe gallery
- Previous/next image navigation
- Image loading placeholders
- Proper alt descriptions
- Optimized WebP loading
- Responsive images and lazy loading where appropriate

Maintain consistent product photography presentation.

All gallery images must be manageable through the admin dashboard.

Do not crop off packaging, distort the pouch or introduce extra branding.

Important: Do not rely on generated product images for precise nutrition values or legal information. Display verified product details as actual website text based on the approved label.

## PHASE 5 — ADD PREMIUM ANIMATIONS

The website currently feels static.

I want an elegant, nature-inspired animated experience, similar in sophistication to a premium wellness or natural-food brand.

Use GSAP with ScrollTrigger, Motion/Framer Motion, or a suitable lightweight animation approach compatible with the existing stack.

Avoid unnecessary libraries or heavy animations.

Homepage hero
- Smooth entrance animation for main heading
- Staggered reveal for supporting text and buttons
- Gentle floating movement for the product pouch
- Subtle background botanical movement
- Smooth image reveals
- Elegant hover transitions
- Refined button interactions

The hero must look premium and remain readable.

Scroll animations — as users scroll:
- Section headings gently fade and slide upward
- Product cards appear with staggered transitions
- Product images reveal elegantly
- Benefits icons animate into view
- Botanical illustrations have subtle parallax movement
- Brand-story images reveal through soft masks
- FAQ sections enter smoothly
- CTA sections receive subtle entrance animations

Do not animate everything simultaneously.

Product card animations
- Subtle image scale on hover
- Smooth card elevation
- Animated Add to Cart confirmation
- Polished wishlist interaction, if implemented
- Smooth quick-view transitions
- Image changes without layout jumping

Smooth scrolling: implement smooth anchor navigation and polished scrolling behaviour without breaking native browser controls, accessibility or mobile performance. Ensure sticky-header offsets work correctly.

Keep animations GPU-friendly, support prefers-reduced-motion, prevent layout shifts and avoid excessive JavaScript. Target responsive, smooth 60 fps interactions where supported.

Important: I want professional, subtle motion — not unnecessary spinning logos, exaggerated zooms or distracting effects.

## PHASE 6 — USE ARAM NARPAVI AS FEATURE INSPIRATION

Study the actual reference website https://aramnarpavi.com/ — use its overall customer experience and feature structure as inspiration, but do not copy its content, logo, products or exact visual design.

Improve UNAR with the following.

Homepage sections
1. Premium animated hero banner
2. Featured Banana Chewy products
3. Why Choose UNAR
4. Ingredients and natural goodness section
5. How to enjoy Banana Chewy
6. Our Story / brand philosophy
7. Verified product benefits
8. Customer reviews
9. FAQs
10. Newsletter signup
11. Contact / support
12. Professional footer

Use tasteful layouts, good whitespace, realistic imagery and consistent green-and-cream branding.

Product detail page — a complete template containing:
- Product name
- Price and MRP
- Five-image gallery
- Quantity selector
- Add to Cart
- Buy Now
- Wishlist, if functional
- Stock availability
- Product description
- Ingredients
- Key benefits
- Allergen information
- Nutrition table
- Net weight
- Storage instructions
- Shipping information
- Reviews and ratings
- Related products
- Sharing options

Keep the purchasing controls visible and easy to use on mobile.

Do not invent testimonials, health claims, certifications or business statistics.

Customer reviews — a working review system with:
- Star rating
- Written review
- Optional photo uploads (maximum five)
- Optional video upload
- Product association
- Admin moderation
- Verified-purchase indicator only when verified
- Appropriate upload file-size and security restrictions
- Spam prevention

Only display genuine approved reviews. Show a friendly empty state when no reviews exist.

Additional customer features
- Shopping cart drawer
- Working product search
- Product filtering and sorting
- Newsletter form with consent
- Functional FAQ accordion
- Contact form
- Order tracking
- Order confirmation page
- Account dashboard
- Responsive navigation
- Shipping and refund information

All visible buttons and forms must perform real actions. Remove dead buttons and misleading placeholders.

## PHASE 7 — COMPLETE ADMIN DASHBOARD

I need complete control of the website without editing source code. Audit the existing admin system and complete the missing functionality.

Dashboard overview: total orders, total revenue, active customers, product count, low-stock alerts, recent orders, sales charts based on actual data.

Product management: add/edit/delete or archive products; upload/change product images; manage five-image galleries; product descriptions and nutritional information; pricing and discounts; stock quantities; categories and collection assignments; published/draft status; featured product settings; product SEO fields.

Order management: view orders; update fulfilment status; manage cancellations and refunds; track payment status; assign tracking information; download invoices; export orders.

Customer management: customer accounts; order history; saved customer information; appropriate privacy and access controls.

Website content management: homepage banners; hero images and headings; homepage sections; featured product selection; About page content; FAQs; testimonials/reviews; contact information; footer links; blog/journal posts; SEO metadata.

Marketing management: coupons; promotional banners; newsletter subscriptions; basic sales reports.

All admin changes must update the public website reliably. Admin routes must be protected by server-side role authorization. Customers must not be able to access admin features.

## PHASE 8 — COMPLETE E-COMMERCE FUNCTIONALITY

Repair and test the full shopping journey: Product page → Add to Cart → Cart → Checkout → Payment → Order confirmation → Customer account → Admin order management.

Include: cart persistence; accurate totals and quantities; shipping address collection; delivery charge calculation; coupon validation; secure payment integration; payment failure handling; order confirmation; stock reduction following confirmed orders; refund/cancellation status management; email confirmations; order history and tracking.

Use Razorpay if already configured or appropriate for the current architecture. Do not mark orders as paid from frontend redirects alone. Validate payments and webhooks securely.

If merchant credentials are missing, finish all functionality possible, provide clear sandbox testing instructions, and identify exactly which credentials need to be configured. Do not simulate successful live payments.

## PHASE 9 — PERFORMANCE, SECURITY AND RESPONSIVENESS

Ensure the entire site works correctly on Android mobile, iPhone, tablet, laptop and desktop.

Perform: image optimization and correct responsive sizing; lazy loading below-the-fold assets; prevention of cumulative layout shifts; correct mobile navigation and typography; accessibility and keyboard testing; reduced-motion support; SEO titles, descriptions and canonical URLs; product structured data when applicable; XML sitemap and robots rules; appropriate secure HTTP headers; input validation and rate limiting; safe file uploads; server-side authorization; production error logging.

Protect sensitive data. Never expose server API keys or customer information in the browser. Keep the website compatible with the existing Hostinger deployment architecture.

## PHASE 10 — TEST EVERYTHING BEFORE COMPLETION

Run real tests for these scenarios:

1. Homepage loads without errors.
2. Both UNAR products appear on the homepage.
3. Both products appear in Shop.
4. Product search finds both products.
5. Product detail pages open.
6. Five images load for each product.
7. Customers can successfully create accounts.
8. Customers can log in and log out.
9. Password reset works.
10. Customer sessions persist correctly.
11. Add to Cart works.
12. Cart totals are accurate.
13. Checkout works in a configured test environment.
14. Orders appear in the admin dashboard.
15. Admin changes to product price/stock appear publicly.
16. Admin can upload and reorder product images.
17. Reviews can be submitted and moderated.
18. Contact and newsletter forms work.
19. Scroll animations work on desktop and mobile.
20. Layouts work across mobile and desktop.
21. The site still works after page refresh and direct URL navigation.
22. Production deployment has no unresolved runtime errors.

Use browser-based testing or Playwright where available. Provide a final report stating which tests passed, which failed and what credentials or external actions are still needed.

## FINAL DEVELOPMENT RULES

- Do not redesign or replace the UNAR logo.
- Maintain the forest green, olive green, cream and sage colour identity.
- Preserve existing functional pages.
- Do not overwrite or destroy existing production data.
- Do not create fake product reviews or sales statistics.
- Do not use hardcoded sample accounts as a substitute for authentication.
- Do not leave dummy buttons or placeholder functionality.
- Do not claim payment or email functionality works without testing.
- Do not change hosting or database architecture unnecessarily.
- Do not deploy destructive changes without an appropriate backup.
- Use reusable components and clean maintainable code.
- Keep everything manageable through the dashboard wherever practical.

Start by inspecting the existing project and diagnosing the signup and product catalogue failures. Fix those issues first, then implement the animations, gallery and remaining e-commerce features.

Work through the phases in order, verify each phase and keep going until the project is ready for a properly tested deployment.

At completion, provide the corrected code, deployment instructions, admin usage guide, test report and list of any remaining external setup requirements.
