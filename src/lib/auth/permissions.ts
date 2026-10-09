/**
 * Staff roles and permissions — the single source of truth. Server actions
 * check these, and the database layer (src/lib/db/rest/policies.ts) applies
 * the same permissions to every query made on behalf of a signed-in user.
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

const FULL_ACCESS: Permission[] = PERMISSIONS.filter((p) => p !== "staff.manage");

export const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  owner: [...FULL_ACCESS, "staff.manage"],
  admin: FULL_ACCESS,
  content_editor: ["dashboard.view", "products.read", "products.write", "inventory.read", "content.write", "media.write", "reviews.moderate"],
  fulfillment: ["dashboard.view", "products.read", "inventory.read", "inventory.write", "orders.read", "orders.write"],
};

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value);
}

export function permissionsForRole(role: StaffRole): Set<Permission> {
  return new Set(ROLE_PERMISSIONS[role]);
}
