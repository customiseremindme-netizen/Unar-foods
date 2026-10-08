# UNAR asset guide for Claude

## Brand source of truth
- Official brand: UNAR
- Official tagline: `One Healthy Habit a Day`
- Forest `#2E4E36` · olive `#7A8F3D` · warm cream `#F2F1E6` · sage `#A8B99A`
- Reference website https://aramnarpavi.com/ — inspiration for structure only.

## Files
- `brand/unar-logo-original.jpg`: official UNAR logo on cream background; use without redraw or spelling alteration.
- `brand/unar-logo-cropped.webp`: exact same original pixels, cropped to useful content with a little margin; **still on cream** (not transparent).
- `brand/unar-identity-board.png`: brand inspiration/presentation. **Contains an illustrative Moringa mockup, NOT a confirmed sellable UNAR product. Do not add Moringa to catalog.**
- `packaging/nuts-front-original.jpg` and `packaging/nuts-back-original.jpg`: front/back labels for product #1.
- `packaging/raw-front-original.jpg` and `packaging/raw-back-original.jpg`: front/back labels for product #2.
- `web/*.webp`: optimized product artwork for on-page label galleries. These are *flat label images*, not physical-pouch photography.
- `products.seed.json`: verified-by-upload product facts; owner still needs to approve published claims and business fields.
- `UNAR_Claude_Master_Prompt.md`: overall project brief.

## Image fidelity rules
Do not invent or retype label content. Do not crop key text or the vegan mark, nutritional panels, barcodes, contact information or FSSAI information. Display label artwork as `object-fit: contain` with an accessible zoom viewer. Request real pouch packshots or actual finished-product photos before constructing photographic hero scenes. Don't treat brand-identity presentation mockups as confirmed catalogue items.

## Production pending confirmations
- Exact current sale prices/MRP; stock and availability; domains; FSSAI/regulatory claims, allergens, shelf life and legal policies.
- Razorpay account and API keys, Supabase, Vercel and optional shipping/email credentials.
- Actual SKU/barcode mapping and uploaded physical-product photographs.
