import { z } from "zod";

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

/** Strips spaces, dashes and an optional +91 / 0 prefix. */
export function normalizeIndianPhone(input: string): string {
  let digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return digits.replace(/\D/g, "");
}

export const phoneSchema = z
  .string()
  .trim()
  .transform(normalizeIndianPhone)
  .refine((v) => /^[6-9]\d{9}$/.test(v), "Enter a valid 10-digit Indian mobile number");

export const pincodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email is too long")
  .pipe(z.email("Enter a valid email address"));

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Enter your full name")
  .max(120, "Name is too long")
  .regex(/^[^<>{}$]*$/, "Name contains invalid characters");

export const stateSchema = z.enum(INDIAN_STATES, { error: "Select your state" });

export const addressSchema = z.object({
  full_name: nameSchema,
  phone: phoneSchema,
  line1: z.string().trim().min(3, "Enter your house / flat / street").max(200),
  line2: z.string().trim().max(200).optional().transform((v) => v || undefined),
  landmark: z.string().trim().max(120).optional().transform((v) => v || undefined),
  city: z.string().trim().min(2, "Enter your city / town").max(80),
  state: stateSchema,
  pincode: pincodeSchema,
});

export type AddressInput = z.infer<typeof addressSchema>;

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Password is too long")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens");

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** Internal links only — blocks javascript:, protocol-relative and external URLs. */
export function isSafeInternalPath(href: string): boolean {
  return /^\/(?!\/)[^\s\\]*$/.test(href);
}

/** Internal path, mailto:, tel: or https:// links (for CMS buttons). */
export const linkSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === "" || isSafeInternalPath(v) || /^https:\/\/[^\s]+$/i.test(v) || /^(mailto|tel):[^\s]+$/i.test(v),
    "Use a page link like /shop, or a full https:// address",
  );

export type FieldErrors = Record<string, string>;

/** Flattens zod issues to { "field.path": "message" } for form display. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
