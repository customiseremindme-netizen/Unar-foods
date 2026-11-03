# Owner checklist — things only you can confirm

The website was built **without inventing anything**: no made-up reviews,
sales numbers, discounts, certifications, delivery promises, tax rates or
legal approvals. The items below were either copied from your packaging and
need your confirmation, or are left empty for you to decide. Nothing on this
list is shown to customers until you approve it in the dashboard.

Tick each item as you go.

## 1. Business details — Dashboard → Settings → Business details
Copied from your packaging; please confirm each one:
- [ ] Address: *107 A2-4, Sulochana Villa, SAPS Cinema Theatre Thottam, Trichy Road, Palladam, Tiruppur – 641664*
- [ ] Phone / WhatsApp: *9994657693*
- [ ] Email: *unarfoods@gmail.com* (consider a domain email like orders@… from your Hostinger email)
- [ ] FSSAI licence number: *22426493000447* (also shown in the footer)
- [ ] Registered business name for invoices (empty — fill in)
- [ ] Then tick **"I have checked these details"**.

## 2. Products — Dashboard → Products → (product)
Both products are **published** (visible in the shop) as soon as the
database is connected, with **0 stock** (shown as *Sold out*) and price = MRP.
Names: "UNAR Dehydrated Banana Chewy — With Dry Fruits & Seeds" and
"UNAR Dehydrated Banana Chewy — Fresh Raw Banana". If you would rather keep
a product hidden while you check it, set its status to *Draft*.

**Prices**
- [ ] Selling price for each pack (currently equal to the MRP printed on the
  pack: ₹149 Dry Fruits & Seeds, ₹120 Fresh Raw Banana). A "% off" badge
  appears **only** if you set a selling price lower than the MRP.
- [ ] Barcodes copied from the packs (8254567868449, 8254567878646) — confirm.

**Claims printed on the pack** (hidden until you tick *Approved*). Approve
only what you can support (lab report / ingredient evidence):
- [ ] 100% Natural
- [ ] No Added Sugar
- [ ] No Preservatives
- [ ] No Artificial Colour
- [ ] Gluten Free — gluten-free claims in India have specific FSSAI
  requirements; confirm with your food-safety advisor.
- [ ] Benefit lines (e.g. "Natural Source of Energy") — approve each one you
  are comfortable stating.

**Label facts**
- [ ] Ingredients, allergen advice and nutrition values (copied exactly from the back labels).
- [ ] Shelf life "Best Before 45 days from the date of Mfg." — tick
  *Approved* under **Storage & shelf life** once confirmed.
- [ ] Vegetarian (green dot) mark — the pack shows a mark in the corner;
  confirm it is the official vegetarian symbol.
- [ ] **Fresh Raw Banana back label**: parts of its text appear to be copied
  from the *Dry Fruits & Seeds* variant. Please check the printed artwork
  before the next print run; the website uses the correct single ingredient
  (fresh raw banana).

**Images**
- [ ] The 10 gallery images (5 per product) you supplied are AI-generated
  pack visuals, not photographs. They are labelled "Product image" (not
  "photograph") in the dashboard. Replace them with real photos when you
  have them.
- [ ] **Your decision:** the gallery now follows your brief's order 01 → 05
  for both products. Fresh Raw Banana images **01** and **02** show nuts as
  props although the product contains no nuts (their descriptions say so).
  If you prefer them further back or removed, use the arrows in
  **Products → Fresh Raw Banana → Images** and press Save.
- [ ] Pack-label scans (front/back) are not in the photo strip; customers
  open them with **"Read the pack label"** under the photos.
- [ ] Every image has a description (alt text) — required before publishing.

- [ ] Homepage sections **Ingredients** (shows the ingredients from each
  product), **How to enjoy** (serving ideas — edit the wording to your taste)
  and **Verified benefits** (shows only the claims/benefits you approve;
  hidden until then) — Dashboard → Content → Homepage.

**Reviews** — Dashboard → Reviews
- [ ] Customers can add up to 5 photos and one short video. Nothing appears
  until you approve; you can remove a single photo/video from a review.
  Switch photos/video off in Settings → Reviews if you prefer.

## 3. Stock — Dashboard → Inventory
- [ ] Enter your real stock for each pack (*Set to* → *Opening stock*).

## 4. Shipping — Dashboard → Shipping
- [ ] Set your real delivery charge and (optional) free-shipping amount on
  "All India — Standard", tick **Active**. Customers cannot check out until a
  zone is active.
- [ ] Delivery estimate text — leave empty unless you can reliably meet it.
- [ ] Decide whether Cash on Delivery is offered (Settings → Checkout and
  "COD available" on the zone) and any COD fee.

## 5. Policies — Dashboard → Content → Pages & policies
All five policies (Shipping, Refunds & Returns, Cancellation, Privacy,
Terms) are **starting templates**, clearly marked *OWNER REVIEW REQUIRED* on
the website. They are **not** legal advice and were not written by a lawyer.
- [ ] Fill in every `[bracketed]` item (time limits, contact person, jurisdiction…).
- [ ] Have them reviewed (ideally by a lawyer familiar with Indian
  e-commerce, consumer-protection and data-protection rules).
- [ ] Untick *Owner review required* on each (only the owner account can).
- [ ] Review the About page text ("Our Story") — it states only what is on
  your packaging; add your real story in your own words.

## 6. Tax — Dashboard → Settings → Tax
- [ ] Only if GST-registered: enter your GSTIN and legal name, then the HSN
  code and GST rate on **each** product, as advised by your accountant. The
  website never guesses a rate; GST stays off until every product has one.

## 6b. Ways to pay and sign in (optional)
- [ ] Decide which payment options to offer (Settings → Checkout & payments):
  Razorpay (already includes Google Pay/PhonePe UPI), PhonePe gateway,
  "Pay by UPI to our UPI ID", Cash on Delivery.
- [ ] If you offer UPI to your own UPI ID: enter it, and check the dashboard
  daily for orders "waiting for a UPI payment".
- [ ] Optional: "Continue with Google" (SETUP_GUIDE Part 4.6).
- [ ] Settings → Emails: keep "Email customers their invoice (PDF)" on, and
  fill in your legal name for invoices (Settings → Tax).

## 7. Before taking real money
- [ ] Razorpay KYC approved and **live** keys in your hosting settings (see SETUP_GUIDE Part 4.3).
- [ ] A test purchase, refund and shipment completed successfully.
- [ ] Hostinger plan that supports Node.js apps (Business or Cloud) with a MySQL database; daily backups switched on.
- [ ] 2FA turned on for GitHub, Hostinger and Razorpay (and Resend if used).

## Things deliberately left out (add only if true)
- Customer reviews / testimonials — the reviews section shows an honest
  "no reviews yet" message until real customers review and you approve.
- Certifications, awards, "as seen in", sales counts — none were provided.
- Delivery-time promises — none set.
- Discounts — none created; add real offers in Marketing → Coupons.
- The Moringa mockup from the asset pack is not used as a product.
