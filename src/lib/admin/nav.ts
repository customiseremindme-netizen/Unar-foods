import type { Permission } from "@/lib/auth/permissions";

export type AdminNavItem = { href: string; label: string; icon: string; permission: Permission; children?: { href: string; label: string }[] };

/** Dashboard navigation. Items are hidden when the staff member lacks the permission (and the pages re-check it). */
export const ADMIN_NAV: { group: string; items: AdminNavItem[] }[] = [
  {
    group: "Store",
    items: [
      { href: "/admin", label: "Overview", icon: "layout-dashboard", permission: "dashboard.view" },
      { href: "/admin/orders", label: "Orders", icon: "clipboard-list", permission: "orders.read" },
      {
        href: "/admin/products",
        label: "Products",
        icon: "package",
        permission: "products.read",
        children: [
          { href: "/admin/products", label: "All products" },
          { href: "/admin/products/collections", label: "Collections" },
        ],
      },
      { href: "/admin/inventory", label: "Inventory", icon: "boxes", permission: "inventory.read" },
      { href: "/admin/customers", label: "Customers", icon: "users", permission: "customers.read" },
      { href: "/admin/messages", label: "Messages", icon: "mail", permission: "customers.read" },
      { href: "/admin/reviews", label: "Reviews", icon: "message-square-quote", permission: "reviews.moderate" },
    ],
  },
  {
    group: "Website",
    items: [
      { href: "/admin/customize", label: "Customize website", icon: "settings", permission: "content.write" },
      {
        href: "/admin/content",
        label: "Content",
        icon: "panels-top-left",
        permission: "content.write",
        children: [
          { href: "/admin/content", label: "Homepage" },
          { href: "/admin/content/pages", label: "Pages & policies" },
          { href: "/admin/content/posts", label: "Journal" },
          { href: "/admin/content/faqs", label: "FAQs" },
          { href: "/admin/content/banners", label: "Banners" },
          { href: "/admin/content/instagram", label: "Instagram" },
          { href: "/admin/content/media", label: "Media library" },
        ],
      },
      {
        href: "/admin/marketing/coupons",
        label: "Marketing",
        icon: "megaphone",
        permission: "marketing.write",
        children: [
          { href: "/admin/marketing/coupons", label: "Coupons" },
          { href: "/admin/marketing/subscribers", label: "Subscribers" },
          { href: "/admin/marketing/abandoned-carts", label: "Abandoned carts" },
        ],
      },
    ],
  },
  {
    group: "Business",
    items: [
      { href: "/admin/reports", label: "Reports", icon: "chart-column", permission: "reports.view" },
      { href: "/admin/shipping", label: "Shipping", icon: "truck", permission: "shipping.write" },
      { href: "/admin/settings", label: "Settings", icon: "settings", permission: "settings.write" },
      { href: "/admin/integrations", label: "Integrations", icon: "plug", permission: "settings.write" },
      { href: "/admin/staff", label: "Staff", icon: "user-cog", permission: "staff.manage" },
      { href: "/admin/activity", label: "Activity log", icon: "scroll-text", permission: "audit.view" },
    ],
  },
];
