import type { PartnerTier } from "./partner-tier";

export interface PartnerFunnelStep {
  label: string;
  count: number;
}

export interface PartnerNextPayout {
  amount: number;
  payoutDate: string;
  breakdown: { label: string; amount: number }[];
}

export interface PartnerCommissionOption {
  code: "A" | "B" | "C";
  firstMonthPct: number;
  recurringPct: number;
}

export interface PartnerSummary {
  tier: PartnerTier;
  commissionOption: PartnerCommissionOption;
  recurringActiveMonthly: number;
  firstMonthCommissionThisMonth: number;
  pendingCommission: number;
  totalPaidToDate: number;
  reversals: number;
  funnel: PartnerFunnelStep[];
  nextPayout: PartnerNextPayout;
}
