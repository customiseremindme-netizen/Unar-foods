# UNAR admin customization guide

The latest repairs are in draft pull request [#1](https://github.com/customiseremindme-netizen/Unar-foods/pull/1). Your screenshots show an earlier customization dashboard deployed on Hostinger. Deploy the latest PR commit to receive the new size selector, font choices, COD feedback and Google integration. Online-payment setup is deferred at the owner's request. Razorpay support already exists; PhonePe is not connected.

## Change the website

1. Sign in to `/admin` with your authorized staff account. Open **Customize website** in the Website menu.
2. Use the search box to find the tool you need. You only see tools allowed by your staff role.
3. Under **Fonts, layout & motion**, choose Manrope, Inter, DM Sans, Fraunces or Montserrat, or use a recommended heading/body pairing, page width, button/card corners, sticky navigation, animation preferences and desktop shop columns. You can edit the shop heading and introduction here too. Press **Save** to apply that group immediately.
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

Use **Products → New product** to create a draft. Enter a name, unique web address, prices, photos with alt text, and any sizes under **Add a size**. Every size needs a unique SKU. Save, enter its real stock in **Inventory**, then **Save & publish**. The public product page offers every active size; choosing one updates the price, stock and cart item. Cards for products with multiple sizes show **Choose options**. Product saves are atomic: a failed price, SKU, collection or gallery update rolls back the entire edit. Newly saved sizes and photos retain their database IDs across subsequent saves.

In **Content → Homepage → Product showcase**, choose **All published products** to include newly added products automatically, **Featured products only**, or **Selected products only**. Set the maximum number shown. The default automatic mode respects hand-picked products when present; otherwise it includes all published products. A product must be published to appear. Save the draft and Publish.

Homepage standard section spacing is now tighter and empty reviews use a compact honest message. You can still choose Compact, Standard or Airy for each section, edit its headings/body text, change images, hide it, or reorder it. None of these choices fabricates reviews or product claims.

Product photo uploads can be reordered and removed from the product editor. Save the product after editing its gallery. Keep the five supplied pouch photos in the intended sequence. Set stock from your actual inventory; zero-stock published products remain visible as sold out. Use the approved packaging artwork for legal, allergen and nutrition details.

Review photos and video remain private until approval. Customers can upload up to five photos and one bounded MP4. Video processing needs FFmpeg and FFprobe installed on the hosting server; the website reports an unavailable message if these tools are absent.

Staff roles are enforced on the server. A normal customer account cannot open the customization workspace or change settings, content, prices or stock. Only the owner can sign off store policies as reviewed. Never put passwords or provider keys in page text, media, product fields or GitHub.

## Payments later

The admin/customization tools work independently of payment-provider setup. To sell with COD before online payments are connected:

1. Open **Settings → Checkout**, turn on Cash on Delivery, review its fee and maximum order value, and Save. You can turn off online payments while setup is deferred.
2. Open **Shipping**, edit each delivery zone, check **Active** and **Cash on Delivery available here**, select the states/PIN codes you actually serve, and Save.
3. Ensure shipping itself is enabled. An inactive “All India” zone covers nothing. In your screenshot, Tamil Nadu, Kerala and Puducherry were unchecked in the active zone; tick them only if you deliver there.
4. Test a real eligible address. COD restrictions remain visible with an explanation rather than silently disappearing. Prices, stock, order limits and the delivery zone are revalidated on the server.

The overview distinguishes required readiness from optional Razorpay tasks for a COD store. Existing checkout hides unavailable online methods and never reports a simulated payment as a real success.

When you choose Razorpay, add its merchant credentials securely in Hostinger, verify the webhook and run a provider sandbox purchase before enabling live online payments. PhonePe requires a separate backend integration if you choose it. The current changes do not claim a PhonePe connection.

## Deployment and recovery

The existing Hostinger URL and GitHub repository are preserved. Hostinger/staging access and verified production database/email configuration are still needed before live deployment. Review [the repair delivery report](REPAIR_DELIVERY.md) for the existing deployment and catalog rollback procedure.

Before a live update, back up the database and try the change in staging. Record current appearance settings so you can restore them if needed. Appearance uses a new validated `appearance` settings row; no customer or order records are deleted. Homepage draft replacement now runs in a transaction: an insertion failure restores the previous draft automatically.

This dashboard edits structured content and supported design options. It does not accept arbitrary CSS, JavaScript or page templates from the browser. New integrations or new kinds of page components still require code changes.

## Enable account emails and Google sign-in

Your account-creation screenshot matches missing email configuration, and you confirmed no email service is set up. Create a Hostinger mailbox for your domain, then add `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` (full mailbox address), and `SMTP_PASSWORD` (mailbox password) privately in Hostinger. Use the SMTP host/port shown by your email provider. Alternatively, verify a sending domain in Resend and add `RESEND_API_KEY` and `EMAIL_FROM`. Set `NEXT_PUBLIC_SITE_URL` to the exact live HTTPS address, without a trailing slash, and redeploy.

Open **Integrations**, send a test email, then register a new customer, open the confirmation email and sign in. Existing unconfirmed accounts can use **Resend confirmation** after email is working. The site keeps secure verification; it does not pretend an unavailable email was delivered.

For Google, open Google Cloud → APIs & Services → Credentials. Create an OAuth client of type **Web application**, configure its consent screen, and enter the exact authorized redirect URI shown in **Integrations**, e.g. `https://seashell-donkey-270999.hostingersite.com/auth/google/callback`. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` privately to Hostinger and redeploy. Google Testing mode allows only designated test users; publish the consent screen for public customer sign-in.

Google verifies new customer identities and creates real database accounts and sessions. It uses single-login state, PKCE, nonce and signed ID-token validation. Existing unconfirmed email accounts and staff accounts must use the existing email/password route; Google never grants a customer an admin role. Real Google provider acceptance still needs your credentials and a live test.

## Invoices and sharing tracking

Open an order in **Orders** to enter its courier, tracking/AWB number and tracking URL. **Mark shipped** can email the customer once sending email is connected. Both the admin and customer order view offer **Copy tracking number** and **Share tracking**. Sharing includes courier details only; it excludes private order tokens, customer addresses and emails.

Placed COD orders now have printable invoices before cash is collected, clearly marked **Amount due on delivery**. Paid orders show their real payment status. Open **Invoice → Print / Save PDF**, choose the browser's **Save as PDF**, then send that file using your preferred app. This is a browser PDF workflow, not an automatic PDF attachment or WhatsApp API integration. Invoice access requires the owning account, a permitted staff account, or the private guest order token; guessing an order number does not expose it.

## SEO and AI search

Edit the site title/description under **Settings → SEO** and each product's search-engine fields. Only published products go into the sitemap and structured offers. Product schema includes every active size's real price and stock, and approved structured ingredients/allergen/storage text. The optional `/llms.txt` guide gives AI search tools links to public product facts; it is unavailable while indexing is switched off. It does not guarantee a search or AI ranking. Enable indexing after reviewing the store, and submit `/sitemap.xml` to Google Search Console using your own account.
