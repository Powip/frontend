export const partnersKeys = {
  all: ["partners"] as const,

  summary: () => [...partnersKeys.all, "summary"] as const,

  referrals: (limit?: number) => [...partnersKeys.all, "referrals", limit] as const,

  commissions: () => [...partnersKeys.all, "commissions"] as const,

  payoutHistory: () => [...partnersKeys.all, "payout-history"] as const,

  payoutSettings: () => [...partnersKeys.all, "payout-settings"] as const,

  link: () => [...partnersKeys.all, "link"] as const,

  resources: () => [...partnersKeys.all, "resources"] as const,

  commissionOptions: () => [...partnersKeys.all, "commission-options"] as const,
};
