import type { PartnerSummary } from "../models/partner-summary";

export const PARTNER_SUMMARY_MOCK: PartnerSummary = {
  tier: {
    level: "plata",
    activeMrr: 458,
    nextLevelThreshold: 1500,
    extraResidualPct: 1,
  },
  commissionOption: {
    code: "A",
    firstMonthPct: 40,
    recurringPct: 6,
  },
  recurringActiveMonthly: 27.48,
  firstMonthCommissionThisMonth: 68.04,
  pendingCommission: 11.34,
  totalPaidToDate: 512.9,
  reversals: -5.94,
  funnel: [
    { label: "Clic / código", count: 24 },
    { label: "Cuenta creada", count: 11 },
    { label: "Activó", count: 4 },
    { label: "Pagó", count: 2 },
  ],
  nextPayout: {
    amount: 95.52,
    payoutDate: "2026-08-25",
    breakdown: [
      { label: "Livii Moda · 1er mes (40%)", amount: 68.04 },
      { label: "2 recurrentes (6%)", amount: 27.48 },
    ],
  },
};
