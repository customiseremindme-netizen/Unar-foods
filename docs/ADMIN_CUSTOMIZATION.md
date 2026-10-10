# UNAR admin customization guide

These changes are in draft pull request [#1](https://github.com/customiseremindme-netizen/Unar-foods/pull/1). They must be deployed to Hostinger before the new screens appear on the live website. Online-payment setup is deferred at the owner's request. Razorpay support already exists; PhonePe is not connected.

## Change the website

1. Sign in to `/admin` with your authorized staff account. Open **Customize website** in the Website menu.
2. Use the search box to find the tool you need. You only see tools allowed by your staff role.
3. Under **Fonts, layout & motion**, choose heading/body fonts, page width, button/card corners, sticky navigation, animation preferences and desktop shop columns. You can edit the shop heading and introduction here too. Press **Save** to apply that group immediately.
4. Under **Brand colours**, change the palette and check the preview before saving. **Load brand defaults** loads the original UNAR palette or appearance choices into the form; press **Save** to apply them. It does not change the logo.
5. Open **Homepage builder** to edit images, headings, buttons and product choices. The arrow buttons reorder sections; the eye hides/shows them; the copy button duplicates them. Expand a section to choose its background and spacing. You can add up to 30 sections.
6. Press **Save draft** to keep unpublished changes. **Save & preview** opens your private preview. **Publish** makes the draft public. **Discard draft** returns the draft to the current published homepage. Publishing affects visitors immediately.
7. Open **Menus & footer** to edit navigation links, footer text, social links and contact details. Each settings group has its own Save button. Unsaved changes are indicated in the form.

Customer reduced-motion preferences take priority over enabled animations. Animations can also be disabled for the storefront. Mobile product layouts remain responsive regardless of desktop columns. Gallery images preserve the pouch proportions.

## Manage the business

| Task | Dashboard screen |
| --- | --- |
| Products, prices, MRP, descriptions, ingredients, nutrition, SEO and galleries | Products; edit a product, then Save |
| Product collections | Products → Collections |
| Real stock and stock history | Inventory |
| Orders, payment state, fulfilment, tracking, invoices and permitted cancellations/refunds | Orders; open an order |
| Customer history and customer messages | Customers and Messages |
| About/story pages and store policies | Content → Pages & policies; save a draft, then publish |
| Homepage and private preview | Content → Homepage |
| FAQs and promotional/shipping announcements | Content → FAQs / Banners |
| Website image uploads | Content → Media library |
| Journal stories and real Instagram gallery entries | Content → Journal / Instagram |
| Genuine reviews and photo/video moderation | Reviews |
| Discount codes, consented newsletter subscribers and abandoned carts | Marketing |
| Shipping zones, delivery prices and COD availability | Shipping |
| Store details, official logo uploads, menus/footer, SEO, checkout, tax and email text | Settings |
| Email/payment/courier connection status | Integrations |
| Real sales totals, exports and reports | Overview and Reports |
| Staff roles and permission limits | Staff |
| Recorded administrative changes | Activity log |

Product photo uploads can be reordered and removed from the product editor. Save the product after editing its gallery. Keep the five supplied pouch photos in the intended sequence. Set stock from your actual inventory; zero-stock published products remain visible as sold out. Use the approved packaging artwork for legal, allergen and nutrition details.

Review photos and video remain private until approval. Customers can upload up to five photos and one bounded MP4. Video processing needs FFmpeg and FFprobe installed on the hosting server; the website reports an unavailable message if these tools are absent.

Staff roles are enforced on the server. A normal customer account cannot open the customization workspace or change settings, content, prices or stock. Only the owner can sign off store policies as reviewed. Never put passwords or provider keys in page text, media, product fields or GitHub.

## Payments later

The admin/customization tools work independently of payment-provider setup. Until online payments are connected, enable Cash on Delivery only if your business offers it, and enable COD on the relevant shipping zones. Existing checkout hides unavailable online methods and never reports a simulated payment as a real success.

When you choose Razorpay, add its merchant credentials securely in Hostinger, verify the webhook and run a provider sandbox purchase before enabling live online payments. PhonePe requires a separate backend integration if you choose it. The current changes do not claim a PhonePe connection.

## Deployment and recovery

The existing Hostinger URL and GitHub repository are preserved. Hostinger/staging access and verified production database/email configuration are still needed before live deployment. Review [the repair delivery report](REPAIR_DELIVERY.md) for the existing deployment and catalog rollback procedure.

Before a live update, back up the database and try the change in staging. Record current appearance settings so you can restore them if needed. Appearance uses a new validated `appearance` settings row; no customer or order records are deleted. Homepage draft replacement now runs in a transaction: an insertion failure restores the previous draft automatically.

This dashboard edits structured content and supported design options. It does not accept arbitrary CSS, JavaScript or page templates from the browser. New integrations or new kinds of page components still require code changes.
