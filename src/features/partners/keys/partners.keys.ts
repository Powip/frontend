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

  payoutSettings: () => [...partnersKeys.all, "payout-settings"] as const,

  link: () => [...partnersKeys.all, "link"] as const,

  resources: () => [...partnersKeys.all, "resources"] as const,

  commissionOptions: () => [...partnersKeys.all, "commission-options"] as const,

  adminDashboardSummary: () => [...partnersKeys.all, "admin-dashboard-summary"] as const,

  adminPartners: () => [...partnersKeys.all, "admin-partners"] as const,

  adminPartner: (id: string) => [...partnersKeys.all, "admin-partners", id] as const,

  adminPartnerReferrals: (id: string) => [...partnersKeys.all, "admin-partners", id, "referrals"] as const,

  adminApplicationsAll: (userId?: string | null) =>
    [...partnersKeys.user(userId), "admin-applications"] as const,

  adminApplications: (status: string | null, userId?: string | null) =>
    [...partnersKeys.adminApplicationsAll(userId), status] as const,

  reviewQueue: () =>[...partnersKeys.all, "review-queue"] as const,

  pendingPaymentConfirmations: () => [...partnersKeys.all, "pending-payment-confirmations"] as const,

  unopenedInvitations: () => [...partnersKeys.all, "unopened-invitations"] as const,

  adminLiquidations: () => [...partnersKeys.all, "admin-liquidations"] as const,

  adminClawbacks: () => [...partnersKeys.all, "admin-clawbacks"] as const,

  adminThresholdQueue: () => [...partnersKeys.all, "admin-threshold-queue"] as const,

  adminCommissionSettings: () => [...partnersKeys.all, "admin-commission-settings"] as const,

  programCases: () => [...partnersKeys.all, "program-cases"] as const,
};
