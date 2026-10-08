-- =============================================================================
-- UNAR — initial data (safe to run on production)
--
-- * Product facts are transcribed exactly from the supplied packaging.
-- * Products start as DRAFT with stock 0 — they cannot be bought until the
--   owner reviews them, enters real stock and clicks Publish.
-- * Every marketing / regulatory claim starts as NOT approved and is hidden
--   on the storefront until the owner approves it in the dashboard.
-- * Policy pages are templates marked OWNER REVIEW REQUIRED.
-- * No reviews, testimonials, sales data, discounts or certifications are
--   created here.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Settings
-- -----------------------------------------------------------------------------
insert into public.settings (key, value, is_public) values
('store', $json${
  "name": "UNAR",
  "legal_name": "",
  "tagline": "One Healthy Habit a Day",
  "email": "unarfoods@gmail.com",
  "phone": "9994657693",
  "whatsapp": "9994657693",
  "address_lines": ["107 A2-4, Sulochana Villa", "SAPS Cinema Theatre Thottam, Trichy Road", "Palladam, Tiruppur - 641664"],
  "city": "Palladam",
  "state": "Tamil Nadu",
  "pincode": "641664",
  "country": "India",
  "fssai_license": "22426493000447",
  "business_hours": "",
  "details_confirmed": false
}$json$, true),
('brand', $json${
  "logo_url": "/brand/unar-logo-transparent.webp",
  "logo_width": 960,
  "logo_height": 307,
  "logo_alt": "UNAR — One Healthy Habit a Day",
  "logo_svg_url": "",
  "favicon_url": ""
}$json$, true),
('theme', $json${
  "forest": "#2E4E36",
  "olive": "#7A8F3D",
  "cream": "#F2F1E6",
  "sage": "#A8B99A",
  "accent": "#E2B33C"
}$json$, true),
('seo', $json${
  "site_title": "UNAR — One Healthy Habit a Day",
  "title_template": "%s · UNAR",
  "description": "UNAR Banana Chewy: chewy dehydrated banana snacks in two varieties — Fresh Raw Banana, and With Dry Fruits & Seeds. Shop online from UNAR.",
  "og_image_url": "/images/products/dry-fruits-seeds/01-main-hero-pouch.webp",
  "allow_indexing": true
}$json$, true),
('social', $json${
  "instagram_url": "",
  "facebook_url": "",
  "youtube_url": "",
  "whatsapp_number": "9994657693"
}$json$, true),
('navigation', $json${
  "header": [
    {"label": "Shop", "href": "/shop"},
    {"label": "Our Story", "href": "/about"},
    {"label": "Why UNAR", "href": "/#why-unar"},
    {"label": "FAQs", "href": "/faqs"},
    {"label": "Contact", "href": "/contact"}
  ],
  "footer_shop": [
    {"label": "All products", "href": "/shop"},
    {"label": "Banana Chewy", "href": "/shop?collection=banana-chewy"},
    {"label": "Journal", "href": "/blog"}
  ],
  "footer_help": [
    {"label": "Track your order", "href": "/track-order"},
    {"label": "FAQs", "href": "/faqs"},
    {"label": "Contact us", "href": "/contact"},
    {"label": "Shipping policy", "href": "/policies/shipping-policy"},
    {"label": "Refunds & returns", "href": "/policies/refund-policy"}
  ]
}$json$, true),
('footer', $json${
  "blurb": "Chewy dehydrated banana snacks, made for one healthy habit a day.",
  "note": ""
}$json$, true),
('checkout', $json${
  "online_payments_enabled": true,
  "cod_enabled": false,
  "cod_fee_paise": 0,
  "cod_max_order_paise": null,
  "guest_checkout_enabled": true,
  "reservation_minutes": 30,
  "min_order_paise": 0,
  "max_quantity_per_item": 10
}$json$, true),
('tax', $json${
  "gst_registered": false,
  "gstin": "",
  "legal_name": "",
  "prices_include_tax": true,
  "seller_state": "Tamil Nadu",
  "invoice_footer": "Thank you for choosing UNAR."
}$json$, true),
('shipping', $json${
  "enabled": true,
  "origin_pincode": "641664",
  "packaging_weight_grams": 0,
  "blocked_pincodes": [],
  "checkout_note": ""
}$json$, true),
('maintenance', $json${
  "enabled": false,
  "message": "We're making a few improvements to our store. Please check back soon."
}$json$, true),
('reviews', $json${
  "enabled": true,
  "require_verified_purchase": false
}$json$, true),
('newsletter', $json${
  "enabled": true,
  "consent_text": "Yes, email me news and offers from UNAR. I can unsubscribe at any time."
}$json$, true),
('product_defaults', $json${
  "shipping_returns_md": "Shipping charges are calculated at checkout from your PIN code. See our [Shipping Policy](/policies/shipping-policy) and [Refunds & Returns](/policies/refund-policy) for details."
}$json$, true),
('notifications', $json${
  "from_name": "UNAR",
  "reply_to": "unarfoods@gmail.com",
  "admin_recipients": ["unarfoods@gmail.com"],
  "notify_admin_new_order": true,
  "whatsapp_enabled": false,
  "templates": {
    "order_placed": {"enabled": true, "subject": "We've received your order {{order_number}}", "intro": "Thank you for shopping with UNAR. Here is a summary of your order."},
    "payment_confirmed": {"enabled": true, "subject": "Payment received for order {{order_number}}", "intro": "Your payment was successful and your order is confirmed. We'll let you know when it ships."},
    "order_shipped": {"enabled": true, "subject": "Your UNAR order {{order_number}} has shipped", "intro": "Good news — your order is on its way."},
    "order_delivered": {"enabled": true, "subject": "Your UNAR order {{order_number}} was delivered", "intro": "Your order has been marked as delivered. We hope you enjoy it!"},
    "order_cancelled": {"enabled": true, "subject": "Your UNAR order {{order_number}} was cancelled", "intro": "Your order has been cancelled. If a payment was made, any refund will be processed to the original payment method."},
    "refund_issued": {"enabled": true, "subject": "Refund update for order {{order_number}}", "intro": "A refund has been issued for your order."}
  }
}$json$, false),
('shiprocket', $json${
  "enabled": false,
  "pickup_location": "",
  "default_length_cm": 20,
  "default_breadth_cm": 15,
  "default_height_cm": 5
}$json$, false)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Catalogue
-- -----------------------------------------------------------------------------
insert into public.categories (id, slug, name, description, sort_order)
values ('6a0f0c34-0b5e-4d3a-9a0e-0d6c9b7f1a01', 'banana-chewy', 'Banana Chewy', 'Chewy dehydrated banana snacks from UNAR.', 1)
on conflict (slug) do nothing;

insert into public.products (
  id, slug, title, short_title, subtitle, short_description, description_md, status,
  ingredients, allergens, dietary_mark, nutrition, nutrition_note, claims, benefits,
  storage_instructions, shelf_life, shelf_life_approved, manufacturer_info, fssai_license,
  is_featured, sort_order, seo_title, seo_description
) values
(
  '2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e01',
  'banana-chewy-dry-fruits-seeds',
  'Dehydrated Banana Chewy — With Dry Fruits & Seeds',
  'Banana Chewy — Dry Fruits & Seeds',
  'With Dry Fruits & Seeds',
  'Dehydrated banana with almonds, cashews, black dry grapes and seeds. 100 g pack.',
  $md$A perfect blend of naturally dehydrated bananas and dry fruits & seeds.

UNAR Banana Chewy with Dry Fruits & Seeds brings together dehydrated banana with almonds (badam), cashews, black dry grapes, and sesame (black & white), sunflower, melon and pumpkin seeds.

Each 100 g pack holds about four 25 g servings.$md$,
  'draft',
  'Banana, Black & White Sesame Seed, Badam (Almonds), Cashew, Sunflower Seed, Black Dry Grapes, Melon Seed, Pumpkin Seed.',
  'Contains Sesame Seeds and Tree Nuts (Almonds, Cashews).',
  'vegetarian',
  $json$[
    {"nutrient": "Energy", "per_100g": "380.85 kcal"},
    {"nutrient": "Protein", "per_100g": "9.53 g"},
    {"nutrient": "Carbohydrates", "per_100g": "71.08 g"},
    {"nutrient": "Total Fat", "per_100g": "6.49 g"},
    {"nutrient": "Total Sugars", "per_100g": "10.4 g"},
    {"nutrient": "Added Sugar", "per_100g": "0 g"}
  ]$json$,
  'Serving size 25 grams · Servings per pack 4',
  $json$[
    {"label": "100% Natural", "approved": false},
    {"label": "No Added Sugar", "approved": false},
    {"label": "No Preservatives", "approved": false},
    {"label": "No Artificial Colour", "approved": false},
    {"label": "Gluten Free", "approved": false}
  ]$json$,
  $json$[
    {"label": "Natural Source of Energy", "approved": false},
    {"label": "Made with Banana, Nuts & Seeds", "approved": false},
    {"label": "Naturally Sweet", "approved": false},
    {"label": "Clean & Wholesome", "approved": false},
    {"label": "Chewy & Satisfying snack", "approved": false},
    {"label": "Perfect Anytime Snack", "approved": false}
  ]$json$,
  'Store in a cool, dry place. Keep away from direct sunlight.',
  'Best Before 45 days from the date of Mfg.',
  false,
  'Manufactured and Marketed by: UNAR, 107 A2-4, Sulochana Villa, SAPS Cinema Theatre Thottam, Trichy Road, Palladam, Tiruppur - 641664.',
  '22426493000447',
  true, 1,
  'Banana Chewy with Dry Fruits & Seeds (100 g)',
  'UNAR Dehydrated Banana Chewy with almonds, cashews, black dry grapes and seeds. 100 g pack. See ingredients, allergen advice and nutrition per 100 g.'
),
(
  '2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e02',
  'banana-chewy-fresh-raw-banana',
  'Dehydrated Banana Chewy — Fresh Raw Banana',
  'Banana Chewy — Fresh Raw Banana',
  'Fresh Raw Banana',
  'Dehydrated banana. Ingredient as printed on the pack: fresh raw banana. 100 g pack.',
  $md$UNAR Banana Chewy — Fresh Raw Banana is dehydrated banana with a chewy bite. The ingredient list on the pack reads simply: fresh raw banana.

Each 100 g pack holds about four 25 g servings.$md$,
  'draft',
  'FRESH RAW BANANA',
  null,
  'vegetarian',
  $json$[
    {"nutrient": "Energy", "per_100g": "348.72 kcal"},
    {"nutrient": "Protein", "per_100g": "0.3 g"},
    {"nutrient": "Carbohydrates", "per_100g": "86.49 g"},
    {"nutrient": "Total Fat", "per_100g": "0.5 g"},
    {"nutrient": "Total Sugars", "per_100g": "8.75 g"},
    {"nutrient": "Added Sugar", "per_100g": "0 g"}
  ]$json$,
  'Serving size 25 grams · Servings per pack 4',
  $json$[
    {"label": "100% Natural", "approved": false},
    {"label": "No Added Sugar", "approved": false},
    {"label": "No Preservatives", "approved": false},
    {"label": "No Artificial Colour", "approved": false},
    {"label": "Gluten Free", "approved": false}
  ]$json$,
  $json$[
    {"label": "Natural Source of Energy", "approved": false},
    {"label": "Made with Banana", "approved": false},
    {"label": "Naturally Sweet", "approved": false},
    {"label": "Clean & Wholesome", "approved": false},
    {"label": "Chewy & Satisfying snack", "approved": false},
    {"label": "Perfect Anytime Snack", "approved": false}
  ]$json$,
  'Store in a cool, dry place. Keep away from direct sunlight.',
  'Best Before 45 days from the date of Mfg.',
  false,
  'Manufactured and Marketed by: UNAR, 107 A2-4, Sulochana Villa, SAPS Cinema Theatre Thottam, Trichy Road, Palladam, Tiruppur - 641664.',
  '22426493000447',
  true, 2,
  'Banana Chewy — Fresh Raw Banana (100 g)',
  'UNAR Dehydrated Banana Chewy made from fresh raw banana. 100 g pack. See ingredients and nutrition per 100 g.'
)
on conflict (slug) do nothing;

insert into public.product_categories (product_id, category_id) values
  ('2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e01', '6a0f0c34-0b5e-4d3a-9a0e-0d6c9b7f1a01'),
  ('2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e02', '6a0f0c34-0b5e-4d3a-9a0e-0d6c9b7f1a01')
on conflict do nothing;

-- MRP from the packaging. Selling price = MRP until the owner sets otherwise.
-- Stock is 0: nothing can be bought until real stock is entered.
insert into public.product_variants (id, product_id, title, sku, barcode, weight_grams, mrp_paise, price_paise, stock, low_stock_threshold, sort_order)
values
  ('9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e01', '2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e01', '100 g', 'UNAR-BC-NUTS-100', '8254567868449', 100, 14900, 14900, 0, 5, 1),
  ('9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e02', '2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e02', '100 g', 'UNAR-BC-RAW-100', '8254567878646', 100, 12000, 12000, 0, 5, 1)
on conflict (sku) do nothing;

-- Product gallery: owner-supplied pouch visuals first, then the exact flat
-- label artwork (the authoritative reference for label text).
-- For Fresh Raw Banana, the bananas-only visuals lead the gallery because two
-- of the supplied visuals show nuts as props, which this product does not contain.
insert into public.product_images (product_id, url, alt, kind, width, height, sort_order)
select v.product_id::uuid, v.url, v.alt, v.kind, v.width, v.height, v.sort_order
from (values
  ('2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e01', '/images/products/dry-fruits-seeds/01-main-hero-pouch.webp', 'UNAR Dehydrated Banana Chewy With Dry Fruits & Seeds pouch beside bananas, almonds, cashews and seeds', 'packshot', 1254, 1254, 1),
  ('2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e01', '/images/products/dry-fruits-seeds/04-beauty-shot-pouch.webp', 'UNAR Banana Chewy With Dry Fruits & Seeds pouch on a stone stand with bowls of nuts and seeds', 'packshot', 1254, 1254, 2),
  ('2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e01', '/images/products/dry-fruits-seeds/02-front-and-back-pouch.webp', 'Front and back of the UNAR Banana Chewy With Dry Fruits & Seeds pouch', 'packshot', 1254, 1254, 3),
  ('2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e01', '/images/products/dry-fruits-seeds/03-ingredients-benefits-display.webp', 'UNAR Banana Chewy With Dry Fruits & Seeds pouch with bowls of its ingredients: banana, almonds, cashews, black dry grapes and seeds', 'lifestyle', 1254, 1254, 4),
  ('2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e01', '/images/products/dry-fruits-seeds/05-lifestyle-support-image.webp', 'UNAR Banana Chewy With Dry Fruits & Seeds served on a plate next to the pouch', 'lifestyle', 1254, 1254, 5),
  ('2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e01', '/images/products/nuts-front.webp', 'UNAR Dehydrated Banana Chewy With Dry Fruits & Seeds — front of pack label artwork', 'front_label', 2048, 1157, 6),
  ('2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e01', '/images/products/nuts-back.webp', 'UNAR Banana Chewy With Dry Fruits & Seeds — back of pack label with ingredients, allergen advice and nutritional information', 'back_label', 1811, 2048, 7),
  ('2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e02', '/images/products/fresh-raw-banana/04-beauty-shot-pouch.webp', 'UNAR Dehydrated Banana Chewy Fresh Raw Banana pouch with bananas and banana chewy slices', 'packshot', 1254, 1254, 1),
  ('2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e02', '/images/products/fresh-raw-banana/03-ingredients-benefits-display.webp', 'UNAR Banana Chewy Fresh Raw Banana pouch with bowls of dehydrated banana and fresh bananas', 'packshot', 1254, 1254, 2),
  ('2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e02', '/images/products/fresh-raw-banana/05-lifestyle-support-image.webp', 'UNAR Banana Chewy Fresh Raw Banana served in a bowl next to the pouch', 'lifestyle', 1254, 1254, 3),
  ('2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e02', '/images/products/fresh-raw-banana/02-front-and-back-pouch.webp', 'Front and back of the UNAR Banana Chewy Fresh Raw Banana pouch', 'packshot', 1254, 1254, 4),
  ('2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e02', '/images/products/fresh-raw-banana/01-main-hero-pouch.webp', 'UNAR Banana Chewy Fresh Raw Banana pouch beside bananas (nuts in the background are props, not ingredients)', 'packshot', 1254, 1254, 5),
  ('2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e02', '/images/products/raw-front.webp', 'UNAR Dehydrated Banana Chewy Fresh Raw Banana — front of pack label artwork', 'front_label', 2048, 1157, 6),
  ('2b7f3a10-5c1e-4f7e-8a51-6f0d9b1c2e02', '/images/products/raw-back.webp', 'UNAR Banana Chewy Fresh Raw Banana — back of pack label with ingredients and nutritional information', 'back_label', 1811, 2048, 7)
) as v(product_id, url, alt, kind, width, height, sort_order)
where not exists (select 1 from public.product_images pi where pi.url = v.url);

-- Placeholder shipping zone. INACTIVE until the owner enters real rates.
insert into public.shipping_zones (name, is_active, match_type, rate_type, flat_rate_paise, notes)
select 'All India — Standard', false, 'all', 'flat', 0, 'Enter your shipping rate, then switch this zone on.'
where not exists (select 1 from public.shipping_zones);

-- -----------------------------------------------------------------------------
-- Homepage sections (identical draft + published copies)
-- -----------------------------------------------------------------------------
with sections (key, type, sort_order, is_visible, content) as (values
  ('hero', 'hero', 10, true, $json${
    "eyebrow": "One Healthy Habit a Day",
    "headline": "Everyday snacking, naturally better.",
    "subheadline": "Chewy dehydrated banana from UNAR — choose Fresh Raw Banana, or Banana Chewy with Dry Fruits & Seeds.",
    "primary_cta": {"label": "Shop Banana Chewy", "href": "/shop"},
    "secondary_cta": {"label": "Our Story", "href": "/about"},
    "image_url": "/images/products/dry-fruits-seeds/01-main-hero-pouch.webp",
    "image_alt": "UNAR Banana Chewy With Dry Fruits & Seeds pouch beside bananas, nuts and seeds",
    "secondary_image_url": "/images/products/fresh-raw-banana/04-beauty-shot-pouch.webp",
    "secondary_image_alt": "UNAR Banana Chewy Fresh Raw Banana pouch with bananas"
  }$json$::jsonb),
  ('trust', 'trust_strip', 20, false, $json${
    "items": [
      {"icon": "leaf", "label": "100% Natural"},
      {"icon": "candy-off", "label": "No Added Sugar"},
      {"icon": "flask-off", "label": "No Preservatives"},
      {"icon": "droplet-off", "label": "No Artificial Colour"}
    ]
  }$json$::jsonb),
  ('shop', 'featured_products', 30, true, $json${
    "eyebrow": "Shop",
    "heading": "Shop the Goodness",
    "description": "Two ways to enjoy Banana Chewy, each in a 100 g pack.",
    "product_slugs": [],
    "cta_label": "View all products",
    "cta_href": "/shop"
  }$json$::jsonb),
  ('story', 'story_split', 40, true, $json${
    "eyebrow": "Our Story",
    "heading": "Small daily choices, made simple.",
    "body_md": "At UNAR, we believe wellness begins with small, consistent choices. One healthy habit a day can lead to a better you, every day.\n\nBanana Chewy starts with banana, dehydrated to a satisfying chew. Our Dry Fruits & Seeds variety adds almonds, cashews, black dry grapes and a mix of seeds.",
    "image_url": "/images/products/dry-fruits-seeds/05-lifestyle-support-image.webp",
    "image_alt": "UNAR Banana Chewy With Dry Fruits & Seeds served on a plate next to the pouch",
    "cta": {"label": "Read our story", "href": "/about"}
  }$json$::jsonb),
  ('promise', 'promise', 50, true, $json${
    "eyebrow": "Why UNAR",
    "heading": "The UNAR Promise",
    "items": [
      {"icon": "sprout", "title": "Ingredients you can name", "body": "Banana comes first. Our Dry Fruits & Seeds variety adds almonds, cashews, black dry grapes and seeds — every one listed on the pack."},
      {"icon": "scan-eye", "title": "Full transparency", "body": "Ingredients, allergen advice and nutrition per 100 g are printed on every pack and shown on every product page."},
      {"icon": "sun", "title": "Mindful daily snacking", "body": "Each 100 g pack holds about four 25 g servings — an easy way to make one healthy habit a day."}
    ]
  }$json$::jsonb),
  ('compare', 'comparison', 60, true, $json${
    "eyebrow": "Compare",
    "heading": "Which Banana Chewy is yours?",
    "description": "The same chewy banana base, two different experiences. Compare ingredients, allergen advice and nutrition at a glance."
  }$json$::jsonb),
  ('made', 'how_its_made', 70, false, $json${
    "eyebrow": "How it's made",
    "heading": "From banana to Banana Chewy",
    "description": "",
    "steps": []
  }$json$::jsonb),
  ('reviews', 'reviews', 80, true, $json${
    "eyebrow": "Reviews",
    "heading": "What customers say",
    "description": "Every review comes from a real customer and is checked before it appears.",
    "empty_text": "No reviews yet. Tried Banana Chewy? Share your thoughts on the product page."
  }$json$::jsonb),
  ('faq', 'faq', 90, true, $json${
    "eyebrow": "FAQs",
    "heading": "Questions, answered",
    "limit": 5,
    "cta_label": "See all FAQs",
    "cta_href": "/faqs"
  }$json$::jsonb),
  ('newsletter', 'newsletter', 100, true, $json${
    "heading": "Join the UNAR circle",
    "description": "Occasional emails about new products and offers. Unsubscribe any time."
  }$json$::jsonb),
  ('instagram', 'instagram', 110, true, $json${
    "heading": "Follow along",
    "handle": "",
    "profile_url": ""
  }$json$::jsonb),
  ('contact', 'contact_cta', 120, true, $json${
    "heading": "We'd love to hear from you",
    "body": "Questions about an order or our snacks? Write to us and we'll get back to you.",
    "cta": {"label": "Contact us", "href": "/contact"}
  }$json$::jsonb)
)
insert into public.cms_sections (page, key, type, state, sort_order, is_visible, content, published_at)
select 'home', s.key, s.type, st.state, s.sort_order, s.is_visible, s.content,
       case when st.state = 'published' then now() end
from sections s
cross join (values ('draft'), ('published')) as st(state)
on conflict (page, key, state) do nothing;

-- -----------------------------------------------------------------------------
-- Pages and policy templates (draft + published copies share a group id)
-- -----------------------------------------------------------------------------
with pages (group_id, kind, slug, title, excerpt, body_md, requires_review, seo_description) as (values
(
  'b1a2c3d4-0000-4000-8000-000000000001'::uuid, 'page', 'about', 'Our Story',
  'UNAR is built on a simple belief: small daily habits create a healthier, happier life.',
  $md$## Inspired by nature. Built on habit.

At UNAR, we believe that wellness begins with small, consistent choices. One healthy habit a day can lead to a better you, every day.

## What we make

Our first range is **Banana Chewy** — dehydrated banana with a satisfying, chewy bite. It comes in two varieties:

- **Fresh Raw Banana** — the ingredient list on the pack reads simply: fresh raw banana.
- **With Dry Fruits & Seeds** — banana with almonds, cashews, black dry grapes, and sesame (black & white), sunflower, melon and pumpkin seeds.

Every pack carries its full ingredient list, allergen advice and nutrition information per 100 g — and so does every product page on this website.

## Where we are

UNAR is based in Palladam, Tiruppur, Tamil Nadu.$md$,
  false,
  'The story behind UNAR and Banana Chewy — one healthy habit a day.'
),
(
  'b1a2c3d4-0000-4000-8000-000000000002'::uuid, 'policy', 'shipping-policy', 'Shipping Policy',
  'How we process and deliver your orders.',
  $md$**This policy is a template. The business owner must review and complete it before launch.**

## Where we ship

We currently deliver to the PIN codes that our checkout accepts. Enter your PIN code at checkout to see whether delivery is available to your address.

## Shipping charges

Shipping charges are calculated at checkout based on your delivery location and order details, and are shown before you pay. Any free-shipping offer is shown at checkout when it applies.

## Processing time

Orders are packed after payment is confirmed (or after a Cash on Delivery order is placed, where available). We aim to dispatch orders within **[NUMBER] business days**. Orders are not dispatched on **[DAYS / PUBLIC HOLIDAYS]**.

## Delivery time

Delivery times depend on your location and our courier partner. Any delivery estimate shown on our website is indicative and is not a guarantee.

## Tracking your order

When your order ships we will share tracking details by email where available. You can also check your order status anytime from **My Account → Orders** or the **Track Order** page.

## Damaged or incorrect parcels

If your parcel arrives damaged or tampered with, please contact us within **[NUMBER] hours** of delivery with your order number and photos of the parcel and products. See our Refunds & Returns policy.

## Contact

Email unarfoods@gmail.com or call/WhatsApp 9994657693.$md$,
  true,
  'UNAR shipping policy — delivery areas, charges, processing and tracking.'
),
(
  'b1a2c3d4-0000-4000-8000-000000000003'::uuid, 'policy', 'refund-policy', 'Refunds & Returns',
  'Our policy on returns, replacements and refunds.',
  $md$**This policy is a template. The business owner must review and complete it before launch.**

## Food safety

Because our products are food items, we cannot accept returns of opened packs or packs that have left our care, except where the product is damaged, defective or incorrect.

## Damaged, defective or incorrect items

If you receive a damaged, defective or incorrect item, contact us within **[NUMBER] days** of delivery with:

- your order number,
- clear photos of the outer parcel, the pack and the product, and
- a short description of the problem.

After reviewing your request we will offer a **[replacement / refund]** where the request is approved.

## Refunds

Approved refunds for online payments are issued to the original payment method through our payment partner, Razorpay. Banks and payment providers may take additional working days to show the refund in your account. For Cash on Delivery orders, we will contact you to arrange the refund.

## Cancellations

See our Cancellation Policy.

## Contact

Email unarfoods@gmail.com or call/WhatsApp 9994657693 with your order number.$md$,
  true,
  'UNAR refunds and returns policy for damaged, defective or incorrect items.'
),
(
  'b1a2c3d4-0000-4000-8000-000000000004'::uuid, 'policy', 'cancellation-policy', 'Cancellation Policy',
  'When and how you can cancel an order.',
  $md$**This policy is a template. The business owner must review and complete it before launch.**

## Before your order ships

You may request cancellation of an order that has not yet been shipped by contacting us as soon as possible with your order number. If the order has not been packed or dispatched, we will cancel it and refund any online payment to the original payment method.

## After your order ships

Orders that have already been shipped cannot be cancelled. Please see our Refunds & Returns policy.

## Cancellations by UNAR

We may cancel an order if a product becomes unavailable, if we cannot deliver to the address provided, or if a payment cannot be verified. If this happens we will inform you and refund any payment received.

## Contact

Email unarfoods@gmail.com or call/WhatsApp 9994657693.$md$,
  true,
  'UNAR order cancellation policy.'
),
(
  'b1a2c3d4-0000-4000-8000-000000000005'::uuid, 'policy', 'privacy-policy', 'Privacy Policy',
  'How UNAR collects, uses and protects your personal data.',
  $md$**This policy is a template. The business owner must review and complete it before launch. It has not been reviewed by a lawyer.**

This policy explains how UNAR ("we", "us") handles personal data collected through this website, in line with applicable Indian law including the Digital Personal Data Protection Act, 2023.

## What we collect

- **Account details:** your name, email address, phone number and saved addresses when you create an account.
- **Order details:** the products you buy, delivery and billing addresses, contact details and order history.
- **Payment details:** payments are processed by Razorpay. We receive confirmation of payment and limited details such as the payment method type. We do not see or store your full card, UPI PIN or bank login details.
- **Messages:** information you send through our contact form or by email.
- **Newsletter:** your email address and consent, only if you choose to subscribe.
- **Technical data:** essential cookies needed to keep you signed in and to remember your cart.

## How we use it

To process and deliver your orders, provide customer support, send order-related emails, prevent fraud and abuse, meet legal and tax obligations, and — only with your consent — send marketing emails.

## Who we share it with

Only with service providers who help us run the store, such as our payment partner (Razorpay), courier partners for delivery, our email provider, and our hosting and database providers. We do not sell your personal data.

## How long we keep it

We keep order records for as long as required for legal, tax and accounting purposes, and other data only as long as needed for the purposes above.

## Your choices and rights

You can view and update your account details at any time, unsubscribe from marketing emails using the link in any email, and ask us to access, correct or erase your personal data, subject to legal requirements.

## Grievance contact

**[NAME OF GRIEVANCE OFFICER]**, UNAR, 107 A2-4, Sulochana Villa, SAPS Cinema Theatre Thottam, Trichy Road, Palladam, Tiruppur - 641664. Email: unarfoods@gmail.com

## Changes

We may update this policy from time to time. The latest version will always be available on this page.$md$,
  true,
  'How UNAR collects, uses and protects your personal data.'
),
(
  'b1a2c3d4-0000-4000-8000-000000000006'::uuid, 'policy', 'terms', 'Terms & Conditions',
  'The terms that apply when you use this website and buy from UNAR.',
  $md$**These terms are a template. The business owner must review and complete them before launch. They have not been reviewed by a lawyer.**

## About us

This website is operated by UNAR, 107 A2-4, Sulochana Villa, SAPS Cinema Theatre Thottam, Trichy Road, Palladam, Tiruppur - 641664, Tamil Nadu, India.

## Products and prices

All prices are in Indian Rupees (₹) and include applicable taxes unless stated otherwise. Product images on this website may show label artwork; the product you receive is the packed product described on its page. We try to keep information accurate, but if we find an error in a price or description after you order, we will contact you before processing the order.

## Orders

An order is confirmed when payment is successfully received (or, for Cash on Delivery where available, when the order is placed). We may decline or cancel orders in the circumstances described in our Cancellation Policy.

## Payments

Online payments are processed securely by Razorpay. By paying online you also agree to Razorpay's terms.

## Delivery, returns and refunds

Please see our Shipping Policy, Refunds & Returns policy and Cancellation Policy.

## Allergens and dietary information

Ingredient and allergen information is shown on each product page and printed on each pack. Please read it carefully before consuming, especially if you have food allergies.

## Accounts

You are responsible for keeping your account password confidential and for activity under your account.

## Governing law

These terms are governed by the laws of India. Courts at **[CITY]** shall have jurisdiction.

## Contact

Email unarfoods@gmail.com or call/WhatsApp 9994657693.$md$,
  true,
  'Terms and conditions for using the UNAR website and buying UNAR products.'
)
)
insert into public.cms_pages (group_id, kind, state, slug, title, excerpt, body_md, requires_owner_review, seo_description, published_at)
select p.group_id, p.kind, st.state, p.slug, p.title, p.excerpt, p.body_md, p.requires_review, p.seo_description,
       case when st.state = 'published' then now() end
from pages p
cross join (values ('draft'), ('published')) as st(state)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- FAQs — factual answers based only on the packaging and site features.
-- -----------------------------------------------------------------------------
insert into public.faqs (question, answer_md, category, sort_order, show_on_home)
select * from (values
  ('What is the difference between the two Banana Chewy varieties?',
   'Banana Chewy — **Fresh Raw Banana** lists a single ingredient on the pack: fresh raw banana. Banana Chewy — **With Dry Fruits & Seeds** adds almonds (badam), cashews, black dry grapes, and sesame (black & white), sunflower, melon and pumpkin seeds. You can compare them side by side on our [home page](/#compare).',
   'Products', 1, true),
  ('Does Banana Chewy contain allergens?',
   'The **With Dry Fruits & Seeds** pack carries this allergen advice: *Contains Sesame Seeds and Tree Nuts (Almonds, Cashews).* The **Fresh Raw Banana** pack does not carry an allergen statement; its listed ingredient is fresh raw banana. If you have a food allergy, always read the pack label and [contact us](/contact) with any questions before ordering.',
   'Products', 2, true),
  ('How much is in a pack?',
   'Each pack has a net weight of 100 g. The nutrition panel lists a serving size of 25 g — about 4 servings per pack.',
   'Products', 3, true),
  ('How should I store Banana Chewy?',
   'Store in a cool, dry place and keep away from direct sunlight, as printed on the pack.',
   'Products', 4, true),
  ('How do I track my order?',
   'If you have an account, every order is listed under **My Account → Orders**. You can also use [Track Order](/track-order) with your order number and the email address or phone number you used at checkout.',
   'Orders', 5, true),
  ('How can I pay?',
   'Online payments are processed securely by Razorpay. The payment options available to you are shown in the Razorpay window at checkout. We never see or store your card details or UPI PIN.',
   'Orders', 6, false),
  ('Can I cancel my order?',
   'Please read our [Cancellation Policy](/policies/cancellation-policy) and [contact us](/contact) as soon as possible with your order number.',
   'Orders', 7, false)
) as f(question, answer_md, category, sort_order, show_on_home)
where not exists (select 1 from public.faqs);

-- Example announcement bar (inactive — switch on from Admin → Content → Banners)
insert into public.banners (placement, title, body, cta_label, cta_url, is_active, sort_order)
select 'announcement', 'One Healthy Habit a Day — welcome to the UNAR store.', null, 'Shop now', '/shop', false, 1
where not exists (select 1 from public.banners);
