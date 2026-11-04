import { describe, expect, it } from "vitest";
import { passwordSchema } from "@/lib/validation/common";

describe("password rules", () => {
  it("accepts a reasonable password", () => {
    expect(passwordSchema.safeParse("green-mango-42").success).toBe(true);
  });
  it("refuses common passwords whatever the case", () => {
    for (const p of ["Password123", "QWERTY123", "india@123", "Admin1234"]) expect(passwordSchema.safeParse(p).success).toBe(false);
  });
  it("refuses short, letter-only, digit-only and sequence passwords", () => {
    for (const p of ["ab12", "onlyletters", "12345678", "123456789x"]) expect(passwordSchema.safeParse(p).success).toBe(false);
  });
});
