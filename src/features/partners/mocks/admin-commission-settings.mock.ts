import type { AdminCommissionSettings } from "../models/admin-commission-settings";

export const ADMIN_COMMISSION_SETTINGS_MOCK: AdminCommissionSettings = {
  commissionRules: [
    { code: "A", firstMonthPct: 40, recurringPct: 6 },
    { code: "C", firstMonthPct: 50, recurringPct: 8 },
    { code: "B", firstMonthPct: 70, recurringPct: 3 },
  ],
  tierThresholds: [
    { level: "bronce", fromMrr: 0, extraResidualPct: 0 },
    { level: "plata", fromMrr: 500, extraResidualPct: 1 },
    { level: "oro", fromMrr: 1500, extraResidualPct: 2 },
  ],
  discount: {
    pct: 10,
    duration: "primer_mes",
    assumedBy: "powip",
  },
  programRules: {
    autoApproveLinkWithoutConflict: true,
    blockSelfReferral: true,
    attributionWindowDays: 60,
    invitationExpirationDays: 30,
    minimumPayoutThreshold: 50,
  },
};
