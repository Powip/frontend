import z from "zod";

const instant = z.iso.datetime({ offset: true });
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const adminPartnerStatusSchema = z.enum(["APPLIED", "ACTIVE", "SUSPENDED", "REJECTED"]);

export const adminPartnerResponseSchema = z
  .object({
    id: z.uuid(),
    displayName: z.string().min(1),
    country: z.string().min(1),
    currency: z.string().min(1),
    status: adminPartnerStatusSchema,
    version: count,
    applicationReference: z.string().min(1),
    appliedAt: instant,
    activatedAt: instant.nullable(),
    createdAt: instant,
    updatedAt: instant,
    referralCode: z.string().min(1).nullable(),
    manualReferralsCount: count,
    linkAttributionsCount: count,
  })
  .strict();

function pageOf<T extends z.ZodType>(item: T) {
  return z
    .object({
      items: z.array(item),
      nextCursor: z.string().min(1).nullable(),
      hasMore: z.boolean(),
      limit: z.number().int().min(1).max(100),
    })
    .strict()
    .refine((page) => page.hasMore === (page.nextCursor !== null), {
      message: "Cursor and pagination state disagree",
    })
    .refine((page) => page.items.length <= page.limit, { message: "Page exceeds its limit" });
}

export const adminPartnersPageResponseSchema = pageOf(adminPartnerResponseSchema);

export const adminPartnerReferralResponseSchema = z
  .object({
    source: z.enum(["MANUAL", "CODE", "LINK_LEGACY", "LINK_ATTRIBUTION"]),
    id: z.uuid(),
    companyId: z.uuid().nullable(),
    businessName: z.string().min(1).nullable(),
    origin: z.enum(["MANUAL", "CODE", "LINK"]),
    state: z.string().min(1),
    capturedAt: instant,
    companyCreatedAt: instant.nullable(),
    attributedAt: instant.nullable(),
  })
  .strict()
  .refine(
    (item) => {
      if (item.source !== "LINK_ATTRIBUTION") {
        const origin = item.source === "LINK_LEGACY" ? "LINK" : item.source;
        return (
          item.origin === origin && item.companyCreatedAt === null && item.attributedAt === null
        );
      }
      return (
        item.origin === "LINK" &&
        item.state === "LINK_ATTRIBUTED" &&
        item.businessName === null &&
        item.companyId !== null &&
        item.companyCreatedAt !== null &&
        item.attributedAt !== null
      );
    },
    { message: "Referral source and persisted origin disagree" },
  );

export const adminPartnerReferralsPageResponseSchema = pageOf(adminPartnerReferralResponseSchema);
export const adminPartnerActivityResponseSchema = z
  .object({
    action: z.string().min(1),
    entityType: z.string().min(1),
    entityId: z.uuid().nullable(),
    occurredAt: instant,
  })
  .strict();
export const adminPartnerActivityPageResponseSchema = pageOf(adminPartnerActivityResponseSchema);

export const adminReviewQueuePageResponseSchema = pageOf(
  z
    .object({
      id: z.uuid(),
      partnerId: z.uuid(),
      partnerDisplayName: z.string().min(1),
      partnerStatus: adminPartnerStatusSchema,
      origin: z.enum(["MANUAL", "CODE"]),
      state: z.enum(["CAPTURED", "UNDER_REVIEW"]),
      version: count,
      businessName: z.string().min(1),
      capturedAt: instant,
      expiresAt: instant.nullable(),
    })
    .strict(),
);

export const adminDashboardSummaryResponseSchema = z
  .object({
    asOf: instant,
    counts: z
      .object({
        partnersTotal: count,
        partnersActive: count,
        partnersSuspended: count,
        applicationsPending: count,
        applicationsRejected: count,
        manualReferrals: count,
        codeReferrals: count,
        legacyLinkReferrals: count,
        linkAttributions: count,
        capturedClaims: count,
        attachedClaims: count,
      })
      .strict(),
    financial: z
      .object({
        availability: z.literal("NOT_AVAILABLE"),
        reason: z.literal("FINANCIAL_ENGINE_NOT_IMPLEMENTED"),
        referredMrr: z.null(),
        monthlyCommissions: z.null(),
        discountsGiven: z.null(),
        channelCost: z.null(),
        ltvBrought: z.null(),
        channelRoiMultiplier: z.null(),
      })
      .strict(),
  })
  .strict();
