export interface CommissionRuleRow {
  code: "A" | "C" | "B";
  firstMonthPct: number;
  recurringPct: number;
}

export type PartnerTierLevelSetting = "bronce" | "plata" | "oro";

export interface TierThreshold {
  level: PartnerTierLevelSetting;
  fromMrr: number;
  extraResidualPct: number;
}

export type DiscountDuration = "primer_mes" | "tres_meses" | "fijo_mensual";
export type DiscountAssumedBy = "powip" | "partner";

export interface DiscountSettings {
  pct: number;
  duration: DiscountDuration;
  assumedBy: DiscountAssumedBy;
}

export interface ProgramRules {
  autoApproveLinkWithoutConflict: boolean;
  blockSelfReferral: boolean;
  attributionWindowDays: number;
  invitationExpirationDays: number;
  minimumPayoutThreshold: number;
}

export interface AdminCommissionSettings {
  commissionRules: CommissionRuleRow[];
  tierThresholds: TierThreshold[];
  discount: DiscountSettings;
  programRules: ProgramRules;
}
