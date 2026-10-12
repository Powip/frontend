export const partnersKeys = {
  all: ["partners"] as const,

  user: (userId?: string | null) => [...partnersKeys.all, "user", userId ?? null] as const,

  me: (userId?: string | null) => [...partnersKeys.user(userId), "me"] as const,

  summary: () => [...partnersKeys.all, "summary"] as const,

  referralsAll: (userId?: string | null) => [...partnersKeys.user(userId), "referrals"] as const,

  referrals: (limit?: number, userId?: string | null) =>
    [...partnersKeys.referralsAll(userId), limit] as const,

  attributions: (userId?: string | null) => [...partnersKeys.user(userId), "attributions"] as const,

  commissions: () => [...partnersKeys.all, "commissions"] as const,

  payoutHistory: () => [...partnersKeys.all, "payout-history"] as const,

  payoutSettings: (userId?: string | null, epoch = 0) =>
    [...partnersKeys.user(userId), "payout-settings-v2", "session", epoch] as const,

  link: () => [...partnersKeys.all, "link"] as const,

  resources: (userId?: string | null, epoch = 0) =>
    [...partnersKeys.all, "resources-v2", userId ?? "anonymous", "session", epoch] as const,

  commissionOptions: () => [...partnersKeys.all, "commission-options"] as const,

  adminRead: (userId?: string | null) => [...partnersKeys.user(userId), "admin-read-v1"] as const,

  adminDashboardSummary: (userId?: string | null, epoch = 0) =>
    [...partnersKeys.adminRead(userId), "session", epoch, "dashboard-summary"] as const,

  adminPartners: (userId?: string | null, status?: string | null, limit?: number, epoch = 0) =>
    [
      ...partnersKeys.adminRead(userId),
      "session",
      epoch,
      "partners",
      status ?? null,
      limit ?? 20,
    ] as const,

  adminPartner: (id: string, userId?: string | null, epoch = 0) =>
    [...partnersKeys.adminRead(userId), "session", epoch, "partner", id] as const,

  adminPartnerReferrals: (id: string, userId?: string | null, limit?: number, epoch = 0) =>
    [...partnersKeys.adminPartner(id, userId, epoch), "referrals", limit ?? 20] as const,

  adminPartnerActivity: (id: string, userId?: string | null, limit?: number, epoch = 0) =>
    [...partnersKeys.adminPartner(id, userId, epoch), "activity", limit ?? 20] as const,

  adminReviewQueue: (userId?: string | null, origin?: string | null, limit = 20, epoch = 0) =>
    [
      ...partnersKeys.adminRead(userId),
      "session",
      epoch,
      "review-queue",
      origin ?? null,
      limit,
    ] as const,

  adminApplicationsAll: (userId?: string | null) =>
    [...partnersKeys.user(userId), "admin-applications"] as const,

  adminApplications: (status: string | null, userId?: string | null) =>
    [...partnersKeys.adminApplicationsAll(userId), status] as const,

  reviewQueue: () => [...partnersKeys.all, "review-queue"] as const,

  pendingPaymentConfirmations: () =>
    [...partnersKeys.all, "pending-payment-confirmations"] as const,

  unopenedInvitations: () => [...partnersKeys.all, "unopened-invitations"] as const,

  adminLiquidations: () => [...partnersKeys.all, "admin-liquidations"] as const,

  adminClawbacks: () => [...partnersKeys.all, "admin-clawbacks"] as const,

  adminThresholdQueue: () => [...partnersKeys.all, "admin-threshold-queue"] as const,

  adminCommissionSettings: () => [...partnersKeys.all, "admin-commission-settings"] as const,

  programCases: () => [...partnersKeys.all, "program-cases"] as const,
};
