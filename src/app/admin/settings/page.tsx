import { requireStaffPage } from "@/lib/auth/session";
import { getAllSettings } from "@/lib/settings";
import { INDIAN_STATES } from "@/lib/validation/common";
import { Notice, PageHeader } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata = { title: "Settings" };

const SECTIONS = [
  ["store", "Business details"],
  ["brand", "Logo"],
  ["theme", "Colours"],
  ["seo", "Search & sharing"],
  ["social", "Social links"],
  ["navigation", "Menus"],
  ["footer", "Footer"],
  ["checkout", "Checkout & payments"],
  ["tax", "Tax / GST"],
  ["notifications", "Emails"],
  ["reviews", "Reviews & newsletter"],
  ["product_defaults", "Product defaults"],
  ["shiprocket", "Shiprocket"],
  ["maintenance", "Maintenance mode"],
] as const;

export default async function SettingsPage() {
  await requireStaffPage("settings.write");
  const s = await getAllSettings();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your business details and how the store works. Each box saves on its own." />
      <nav aria-label="Settings sections" className="flex flex-wrap gap-1.5 text-[0.78rem]">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#set-${id}`} className="rounded-full border border-line bg-paper px-3 py-1 hover:border-forest">
            {label}
          </a>
        ))}
      </nav>
      {!s.store.details_confirmed ? (
        <Notice tone="warning">
          Please check your business details below (address, phone, email, FSSAI number — copied from your packaging) and tick “I have checked these details”.
        </Notice>
      ) : null}

      <SettingsForm
        id="set-store"
        settingKey="store"
        title="Business details"
        description="Shown in the footer, contact page, invoices and emails."
        initial={s.store}
        fields={[
          { name: "name", label: "Store name", type: "text", max: 80 },
          { name: "legal_name", label: "Registered business name (for invoices)", type: "text", max: 160 },
          { name: "tagline", label: "Tagline", type: "text", max: 120 },
          { name: "email", label: "Customer service email", type: "email" },
          { name: "phone", label: "Phone", type: "text", max: 20 },
          { name: "whatsapp", label: "WhatsApp number", type: "text", max: 20 },
          { name: "address_lines", label: "Address (one line per row)", type: "lines", rows: 3 },
          { name: "city", label: "City", type: "text", max: 80 },
          { name: "state", label: "State", type: "select", options: INDIAN_STATES.map((st) => ({ value: st, label: st })) },
          { name: "pincode", label: "PIN code", type: "text", max: 10 },
          { name: "fssai_license", label: "FSSAI licence number", type: "text", max: 40 },
          { name: "business_hours", label: "Business hours (optional)", type: "text", max: 160, placeholder: "Mon–Sat, 10am–6pm" },
          { name: "details_confirmed", label: "I have checked these details and they are correct", type: "boolean" },
        ]}
      />

      <SettingsForm
        id="set-brand"
        settingKey="brand"
        title="Logo"
        description="Use your official logo file only. A transparent PNG, WebP or SVG works best."
        initial={s.brand}
        fields={[
          { name: "logo_url", label: "Logo", type: "image", widthField: "logo_width", heightField: "logo_height", help: "Used in the header, footer and emails." },
          { name: "logo_svg_url", label: "Logo as SVG (optional, sharper)", type: "image", allowSvg: true, help: "Only upload an SVG exported from your original logo file." },
          { name: "logo_alt", label: "Logo description", type: "text", max: 160 },
          { name: "favicon_url", label: "Browser tab icon (optional, square)", type: "image", help: "Leave empty to use the built-in UNAR leaf icon." },
        ]}
      />

      <SettingsForm
        id="set-theme"
        settingKey="theme"
        title="Colours"
        description="Your brand colours. Keep strong contrast between text and background so everyone can read the site."
        initial={s.theme}
        fields={[
          { name: "forest", label: "Forest green (main)", type: "color" },
          { name: "olive", label: "Olive green", type: "color" },
          { name: "cream", label: "Cream (background)", type: "color" },
          { name: "sage", label: "Sage", type: "color" },
          { name: "accent", label: "Banana yellow (small accents only)", type: "color" },
        ]}
      />

      <SettingsForm
        id="set-seo"
        settingKey="seo"
        title="Search & sharing"
        description="How your site appears on Google and when links are shared."
        initial={s.seo}
        fields={[
          { name: "site_title", label: "Homepage title", type: "text", max: 120 },
          { name: "title_template", label: "Title pattern for other pages", type: "text", max: 60, help: "%s is replaced by the page name, e.g. “%s · UNAR”." },
          { name: "description", label: "Site description", type: "textarea", max: 300 },
          { name: "og_image_url", label: "Default sharing image", type: "image" },
          { name: "allow_indexing", label: "Allow search engines to list the site", type: "boolean", help: "Untick while you are still testing so unfinished pages don't appear on Google." },
        ]}
      />

      <SettingsForm
        id="set-social"
        settingKey="social"
        title="Social links"
        description="Leave empty to hide an icon."
        initial={s.social}
        fields={[
          { name: "instagram_url", label: "Instagram page", type: "url", placeholder: "https://www.instagram.com/…" },
          { name: "facebook_url", label: "Facebook page", type: "url", placeholder: "https://www.facebook.com/…" },
          { name: "youtube_url", label: "YouTube channel", type: "url" },
          { name: "whatsapp_number", label: "WhatsApp chat number (10 digits)", type: "text", max: 20 },
        ]}
      />

      <SettingsForm
        id="set-navigation"
        settingKey="navigation"
        title="Menus"
        description="Links in the header and footer. Use page addresses like /shop or /about."
        initial={s.navigation}
        fields={[
          { name: "header", label: "Header menu", type: "links", max: 8 },
          { name: "footer_shop", label: "Footer — Shop column", type: "links", max: 10 },
          { name: "footer_help", label: "Footer — Help column", type: "links", max: 10 },
        ]}
      />

      <SettingsForm
        id="set-footer"
        settingKey="footer"
        title="Footer"
        initial={s.footer}
        fields={[
          { name: "blurb", label: "Short text under the logo", type: "textarea", max: 300 },
          { name: "note", label: "Small print (optional)", type: "textarea", max: 300 },
        ]}
      />

      <SettingsForm
        id="set-checkout"
        settingKey="checkout"
        title="Checkout & payments"
        description="Online payments use Razorpay (set up under Integrations). Cash on Delivery also needs “COD available” on a shipping zone."
        initial={s.checkout}
        fields={[
          { name: "online_payments_enabled", label: "Accept online payments (UPI, cards, net banking via Razorpay)", type: "boolean" },
          { name: "cod_enabled", label: "Offer Cash on Delivery", type: "boolean" },
          { name: "cod_fee_paise", label: "COD handling fee", type: "rupees", help: "Shown clearly to the customer before they order. Use 0 for no fee." },
          { name: "cod_max_order_paise", label: "Maximum order value for COD (optional)", type: "rupees", optional: true },
          { name: "min_order_paise", label: "Minimum order value", type: "rupees", help: "0 = no minimum." },
          { name: "max_quantity_per_item", label: "Maximum packs of one item per order", type: "number", min: 1, max: 99 },
          { name: "guest_checkout_enabled", label: "Allow checkout without an account", type: "boolean" },
          { name: "reservation_minutes", label: "Minutes to hold stock while a customer pays online", type: "number", min: 10, max: 120 },
        ]}
      />

      <SettingsForm
        id="set-tax"
        settingKey="tax"
        title="Tax / GST"
        description="Only switch GST on if your business is GST-registered. Then set the HSN code and GST rate on every product (ask your tax advisor — the website never guesses rates)."
        initial={s.tax}
        fields={[
          { name: "gst_registered", label: "My business is GST-registered — show GST on invoices", type: "boolean" },
          { name: "gstin", label: "GSTIN", type: "text", max: 15 },
          { name: "legal_name", label: "Legal name as on GST certificate", type: "text", max: 160 },
          { name: "prices_include_tax", label: "My product prices already include GST", type: "boolean" },
          { name: "seller_state", label: "State of registration", type: "select", options: INDIAN_STATES.map((st) => ({ value: st, label: st })) },
          { name: "invoice_footer", label: "Invoice footer note (optional)", type: "textarea", max: 400 },
        ]}
      />

      <SettingsForm
        id="set-notifications"
        settingKey="notifications"
        title="Emails"
        description="Order emails are sent automatically once email is connected (Integrations → Email)."
        initial={s.notifications}
        fields={[
          { name: "from_name", label: "Sender name", type: "text", max: 80 },
          { name: "reply_to", label: "Replies go to (optional)", type: "email" },
          { name: "notify_admin_new_order", label: "Email me when a new order is placed", type: "boolean" },
          { name: "admin_recipients", label: "Send new-order emails to (one email per line)", type: "lines", rows: 2 },
          {
            name: "templates",
            label: "Customer emails",
            type: "templates",
            templates: [
              { key: "order_placed", label: "Order received" },
              { key: "payment_confirmed", label: "Payment confirmed" },
              { key: "order_shipped", label: "Order shipped" },
              { key: "order_delivered", label: "Order delivered" },
              { key: "order_cancelled", label: "Order cancelled" },
              { key: "refund_issued", label: "Refund issued" },
            ],
          },
        ]}
      />

      <div id="set-reviews" className="grid scroll-mt-6 gap-6 lg:grid-cols-2">
        <SettingsForm
          settingKey="reviews"
          title="Reviews"
          initial={s.reviews}
          fields={[
            { name: "enabled", label: "Let customers write reviews", type: "boolean", help: "Every review waits for your approval before it appears." },
            { name: "require_verified_purchase", label: "Only customers who bought the product can review", type: "boolean" },
          ]}
        />
        <SettingsForm
          settingKey="newsletter"
          title="Newsletter"
          initial={s.newsletter}
          fields={[
            { name: "enabled", label: "Show the newsletter sign-up", type: "boolean" },
            { name: "consent_text", label: "Consent wording next to the tick box", type: "textarea", max: 300 },
          ]}
        />
      </div>

      <SettingsForm
        id="set-product_defaults"
        settingKey="product_defaults"
        title="Product defaults"
        initial={s.product_defaults}
        fields={[{ name: "shipping_returns_md", label: "Shipping & returns text shown on every product (unless the product has its own)", type: "textarea", rows: 5, max: 4000 }]}
      />

      <SettingsForm
        id="set-shiprocket"
        settingKey="shiprocket"
        title="Shiprocket (optional)"
        description="Lets you send orders to Shiprocket with one click. Your Shiprocket login is stored as a secret in Vercel, not here. Check the connection under Integrations."
        initial={s.shiprocket}
        fields={[
          { name: "enabled", label: "Use Shiprocket for shipments", type: "boolean" },
          { name: "pickup_location", label: "Pickup location name (exactly as in Shiprocket)", type: "text", max: 120 },
          { name: "default_length_cm", label: "Default parcel length (cm)", type: "number", min: 1, max: 200, step: 0.5 },
          { name: "default_breadth_cm", label: "Default parcel breadth (cm)", type: "number", min: 1, max: 200, step: 0.5 },
          { name: "default_height_cm", label: "Default parcel height (cm)", type: "number", min: 1, max: 200, step: 0.5 },
        ]}
      />

      <SettingsForm
        id="set-maintenance"
        settingKey="maintenance"
        title="Maintenance mode"
        description="Temporarily closes the shop for visitors. You (signed in with preview mode) can still see it."
        initial={s.maintenance}
        fields={[
          { name: "enabled", label: "Close the shop temporarily", type: "boolean" },
          { name: "message", label: "Message for visitors", type: "textarea", max: 300 },
        ]}
      />
    </div>
  );
}
