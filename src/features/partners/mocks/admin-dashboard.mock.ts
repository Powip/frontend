import type { AdminDashboardSummary } from "../models/admin-dashboard-summary";

export const ADMIN_DASHBOARD_SUMMARY_MOCK: AdminDashboardSummary = {
  referredMrr: 4230,
  monthlyCommissions: 1340,
  discountsGiven: 412,
  channelCost: 1752,
  ltvBrought: 63450,
  channelRoiMultiplier: 36,
  monthlyMrr: [
    { month: "mar", mrr: 1607 },
    { month: "abr", mrr: 2200 },
    { month: "may", mrr: 2538 },
    { month: "jun", mrr: 3003 },
    { month: "jul", mrr: 3553 },
    { month: "ago", mrr: 4230 },
  ],
  referralsByOrigin: { link: 55, manual: 23, codigo: 22 },
  clickToPayConversionPct: 37,
  funnel: [
    { label: "Leads", count: 220 },
    { label: "Cuenta creada", count: 110 },
    { label: "Activaron", count: 48 },
    { label: "Pagando", count: 31 },
  ],
};
