import z from "zod";

function hasIsoControl(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || (code >= 127 && code <= 159);
  });
}

const text = (max: number) =>
  z
    .string()
    .max(max)
    .refine((value) => value.trim().length > 0 && !value.includes("\0"));
const nullableText = z
  .string()
  .max(1000)
  .refine((value) => !value.includes("\0"))
  .nullable();
const publicUrl = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        !value.includes("?") &&
        !value.includes("#")
      );
    } catch {
      return false;
    }
  })
  .nullable();
const instant = z.iso.datetime({ offset: true });
const version = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const metadata = {
  country: z.string().regex(/^[A-Z]{2}$/),
  kind: z.enum(["VIDEO", "PDF", "LOGOS"]),
  category: text(80),
  title: text(200),
  description: nullableText,
  publicUrl,
  sortOrder: z.number().int().min(-1_000_000).max(1_000_000),
};
function commandText(max: number) {
  return z
    .string()
    .max(max)
    .refine((value) => value.trim().length > 0 && !hasIsoControl(value));
}
const commandMetadata = {
  ...metadata,
  title: commandText(200),
  category: commandText(80),
  description: z
    .string()
    .max(1000)
    .refine((value) => !hasIsoControl(value))
    .nullable(),
};
export const adminResourceMetadataCommandSchema = z
  .object({ ...commandMetadata, reason: commandText(2000) })
  .strict();
export const adminResourceRevisionCommandSchema = z
  .object({ ...commandMetadata, reason: commandText(2000), expectedVersion: version })
  .strict();
export const adminResourceTransitionCommandSchema = z
  .object({ expectedVersion: version, reason: commandText(2000) })
  .strict();
export const adminResourceSchema = z
  .object({
    id: z.uuid(),
    ...metadata,
    state: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    version,
    createdAt: instant,
    updatedAt: instant,
    archivedAt: instant.nullable(),
  })
  .strict()
  .refine((resource) => (resource.state === "ARCHIVED") === (resource.archivedAt !== null), {
    message: "Resource archive state disagrees with persisted date",
  });
export const adminResourcesPageSchema = z
  .object({
    items: z.array(adminResourceSchema),
    nextCursor: z.string().min(1).nullable(),
    hasMore: z.boolean(),
    limit: z.number().int().min(1).max(100),
  })
  .strict()
  .refine((page) => page.hasMore === (page.nextCursor !== null) && page.items.length <= page.limit);
