import { z } from "zod";

export const sectionLayoutSchema = z.object({
  background: z.enum(["original", "cream", "paper", "sage"]).default("original"),
  spacing: z.enum(["standard", "compact", "airy"]).default("standard"),
});
export type SectionLayout = z.output<typeof sectionLayoutSchema>;
export function readSectionLayout(content: unknown): SectionLayout {
  const raw = content && typeof content === "object" ? (content as Record<string, unknown>)._layout : undefined;
  const result = sectionLayoutSchema.safeParse(raw ?? {});
  return result.success ? result.data : sectionLayoutSchema.parse({});
}
