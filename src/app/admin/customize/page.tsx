import { requireStaffPage } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";
import { getAllSettings } from "@/lib/settings";
import { defaultSettings } from "@/lib/settings/schema";
import { SettingsForm } from "@/components/admin/settings-form";
import { CustomizationLinks, type CustomizationLink } from "@/components/admin/customization-links";
import { Notice, PageHeader } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Customize website" };
const TOOLS: (CustomizationLink & { permission: Permission })[] = [
  { title: "Homepage builder", description: "Edit images, headings and buttons. Add, duplicate, reorder and style sections, then preview and publish.", href: "/admin/content", permission: "content.write" },
  { title: "Products & galleries", description: "Descriptions, prices, variants, ingredients, nutrition, SEO and product photos.", href: "/admin/products", permission: "products.write" },
  { title: "Collections", description: "Create and organize your product collections.", href: "/admin/products/collections", permission: "products.write" },
  { title: "Pages & policies", description: "About, story, contact and store policies with draft and publication controls.", href: "/admin/content/pages", permission: "content.write" },
  { title: "Menus & footer", description: "Navigation links, contact details, social links and footer text.", href: "/admin/settings#set-navigation", permission: "settings.write" },
  { title: "Brand, contact & SEO", description: "Official logo files, business details, page titles and sharing images.", href: "/admin/settings", permission: "settings.write" },
  { title: "Banners & announcements", description: "Promotional and shipping messages, images and scheduled announcements.", href: "/admin/content/banners", permission: "content.write" },
  { title: "FAQs", description: "Product, storage, order and delivery questions and answers.", href: "/admin/content/faqs", permission: "content.write" },
  { title: "Media library", description: "Upload images for products, pages and homepage sections.", href: "/admin/content/media", permission: "media.write" },
  { title: "Journal", description: "Publish brand stories and editorial posts.", href: "/admin/content/posts", permission: "content.write" },
  { title: "Instagram gallery", description: "Choose real photos and links for your social gallery.", href: "/admin/content/instagram", permission: "content.write" },
  { title: "Shipping & delivery", description: "Delivery zones, charges, free-shipping thresholds and COD availability.", href: "/admin/shipping", permission: "shipping.write" },
  { title: "Checkout & payment options", description: "Guest checkout, quantity limits and COD. Configure online payments when you are ready.", href: "/admin/settings#set-checkout", permission: "settings.write" },
  { title: "Coupons & newsletter", description: "Discount codes, subscriber consent and marketing lists.", href: "/admin/marketing/coupons", permission: "marketing.write" },
  { title: "Newsletter subscribers", description: "Manage subscriber consent and export mailing lists.", href: "/admin/marketing/subscribers", permission: "marketing.write" },
  { title: "Customer reviews", description: "Approve or hide genuine ratings, text, photos and videos.", href: "/admin/reviews", permission: "reviews.moderate" },
  { title: "Staff access", description: "Give team members only the permissions they need.", href: "/admin/staff", permission: "staff.manage" },
];

export default async function CustomizePage() {
  const { access } = await requireStaffPage();
  const settings = await getAllSettings();
  const defaults = defaultSettings();
  return <div className="space-y-8">
    <PageHeader title="Customize website" description="Manage the look, content and shopping experience from one workspace." actions={<ButtonLink href="/" target="_blank" rel="noopener noreferrer" variant="secondary">View storefront</ButtonLink>} />
    <Notice>Homepage and page edits have draft previews. Appearance and store settings update the live website when you press Save. Payment-provider setup can be completed later.</Notice>
    <CustomizationLinks items={TOOLS.filter((tool) => access.permissions.has(tool.permission))} />
    {access.permissions.has("settings.write") ? <>
      <SettingsForm id="set-appearance" settingKey="appearance" title="Fonts, layout & motion" description="Use the existing brand fonts and choose how products and navigation appear. Customer reduced-motion preferences always take priority." initial={settings.appearance} defaults={defaults.appearance} fields={[
        { name: "heading_font", label: "Heading font", type: "select", options: [{ value: "fraunces", label: "Fraunces — brand serif" }, { value: "montserrat", label: "Montserrat — clean sans serif" }, { value: "georgia", label: "Georgia — classic serif" }] },
        { name: "body_font", label: "Body font", type: "select", options: [{ value: "montserrat", label: "Montserrat — brand font" }, { value: "system", label: "System font" }] },
        { name: "content_width", label: "Page width", type: "select", options: [{ value: "compact", label: "Compact" }, { value: "standard", label: "Standard" }, { value: "wide", label: "Wide" }] },
        { name: "button_style", label: "Button shape", type: "select", options: [{ value: "pill", label: "Pill" }, { value: "soft", label: "Soft corners" }, { value: "square", label: "Minimal corners" }] },
        { name: "image_style", label: "Product card corners", type: "select", options: [{ value: "organic", label: "Rounded" }, { value: "soft", label: "Soft corners" }, { value: "square", label: "Minimal corners" }] },
        { name: "sticky_header", label: "Keep navigation visible while scrolling", type: "boolean" },
        { name: "animations_enabled", label: "Enable storefront animations", type: "boolean" },
        { name: "shop_columns", label: "Shop products per row on desktop", type: "number", min: 2, max: 4, step: 1, help: "Mobile layouts stay responsive." },
        { name: "shop_heading", label: "Shop page heading", type: "text", max: 120 },
        { name: "shop_description", label: "Shop page introduction", type: "textarea", max: 400, help: "Collection descriptions are edited under Collections." },
      ]} />
      <SettingsForm id="set-theme" settingKey="theme" title="Brand colours" description="Keep text readable against backgrounds. Load the original UNAR palette whenever needed; your logo stays unchanged." initial={settings.theme} defaults={defaults.theme} fields={[
        { name: "forest", label: "Forest green", type: "color" }, { name: "olive", label: "Olive green", type: "color" }, { name: "cream", label: "Warm cream", type: "color" }, { name: "sage", label: "Sage green", type: "color" }, { name: "accent", label: "Accent", type: "color" },
      ]} />
    </> : null}
  </div>;
}
