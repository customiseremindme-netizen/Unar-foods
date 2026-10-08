/**
 * Staff roles and permissions. The authoritative mapping lives in the
 * database table `role_permissions` (checked by row level security); this
 * file only lists the names so TypeScript can catch typos.
 */
export const PERMISSIONS = [
  "dashboard.view",
  "products.read",
  "products.write",
  "inventory.read",
  "inventory.write",
  "orders.read",
  "orders.write",
  "orders.cancel",
  "orders.refund",
  "customers.read",
  "content.write",
  "media.write",
  "marketing.write",
  "reviews.moderate",
  "reports.view",
  "shipping.write",
  "settings.write",
  "staff.manage",
  "audit.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const STAFF_ROLES = ["owner", "admin", "content_editor", "fulfillment"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  admin: "Admin",
  content_editor: "Content editor",
  fulfillment: "Fulfilment staff",
};

export const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  owner: "Full access, including managing staff accounts.",
  admin: "Full access except managing staff accounts.",
  content_editor: "Products, website content, images and reviews. No orders, customers or settings.",
  fulfillment: "Orders, shipping updates and stock. No refunds, settings or content.",
};
