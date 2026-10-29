import z from "zod";

const instant = z.iso.datetime({ offset: true });

export const partnerAttributionResponseSchema = z.object({
  id: z.uuid(),
  companyId: z.uuid(),
  claimId: z.uuid(),
  state: z.literal("CONFIRMED"),
  source: z.literal("LINK"),
  reason: z.literal("FIRST_VALID_CLAIM"),
  capturedAt: instant,
  expiresAt: instant,
  companyCreatedAt: instant,
  confirmedAt: instant,
  resolutionVersion: z.number().int().positive(),
}).strict();

export const partnerAttributionPageResponseSchema = z.object({
  items: z.array(partnerAttributionResponseSchema),
  nextCursor: z.string().min(1).nullable(),
}).strict();
