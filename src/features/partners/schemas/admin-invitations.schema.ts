import z from "zod";

const uuid = z.uuid().refine((value) => value === value.toLowerCase());
const instant = z.iso.datetime();
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (value) => !/[\u0000-\u001f\u007f-\u009f]/.test(value),
      "No se permiten caracteres de control",
    );
export const invitationStateFilterSchema = z.enum([
  "ALL",
  "UNOPENED",
  "QUEUED",
  "TRANSPORT_ACCEPTED",
  "ACCEPTED",
  "EXPIRED",
  "FAILED",
]);
export type InvitationStateFilter = z.infer<typeof invitationStateFilterSchema>;
export const invitationCreateCommandSchema = z
  .object({
    email: text(320).email(),
    displayName: text(160),
    country: z.literal("PE"),
    profile: z.enum(["AGENCY", "DEVELOPER", "CREATOR"]),
    note: text(2000).optional(),
  })
  .strict();
export const invitationResendCommandSchema = z.object({ reason: text(2000) }).strict();
export const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/);
export const invitationAcceptReceiptSchema = z
  .object({
    invitationId: uuid,
    state: z.literal("ACCEPTED"),
    acceptedAt: instant,
  })
  .strict();
export const invitationCreateReceiptSchema = z
  .object({
    invitationId: uuid,
    state: z.literal("QUEUED"),
    createdAt: instant,
  })
  .strict();
export const invitationResendReceiptSchema = z
  .object({
    invitationId: uuid,
    state: z.literal("QUEUED"),
    queuedAt: instant,
  })
  .strict();
export const adminInvitationSchema = z
  .object({
    id: uuid,
    displayName: text(160),
    maskedEmail: text(320),
    country: z.literal("PE"),
    profile: z.enum(["AGENCY", "DEVELOPER", "CREATOR"]),
    state: z.enum(["QUEUED", "TRANSPORT_ACCEPTED", "ACCEPTED", "EXPIRED", "FAILED"]),
    createdAt: instant,
    expiresAt: instant,
    sentAt: instant.nullable(),
    acceptancePending: z.boolean(),
    transportAvailability: z.enum(["AVAILABLE", "DISABLED", "MISSING_CONFIGURATION"]),
  })
  .strict();
export const invitationPageParamsSchema = z
  .object({
    cursor: z
      .string()
      .min(1)
      .max(256)
      .regex(/^[A-Za-z0-9_-]+$/)
      .nullable()
      .optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict();
export const adminInvitationsPageSchema = z
  .object({
    items: z.array(adminInvitationSchema).max(100),
    nextCursor: z
      .string()
      .min(1)
      .max(256)
      .regex(/^[A-Za-z0-9_-]+$/)
      .nullable(),
  })
  .strict()
  .refine((page) => new Set(page.items.map((item) => item.id)).size === page.items.length);
export type InvitationCreateCommand = z.infer<typeof invitationCreateCommandSchema>;
export type InvitationResendCommand = z.infer<typeof invitationResendCommandSchema>;
export type AdminInvitation = z.infer<typeof adminInvitationSchema>;
