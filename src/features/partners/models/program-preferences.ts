export type ProgramPreferencesOptionCode = "A" | "B" | "C";

export interface ProgramPreferencesSettings {
  optionCode: ProgramPreferencesOptionCode;
  discountPct: string;
  version: number;
  updatedAt: string;
}

export interface ProgramPreferencesEffectiveTerms {
  status: "NOT_CONFIGURED";
  policyVersion: null;
  firstPaymentRate: null;
  recurringPaymentRate: null;
}

export interface ProgramPreferencesCatalog {
  source: "POWIP_PARTNERS_PROGRAM_SPEC";
  version: "2.0";
  date: "2026-08-17";
  options: [
    { code: "A"; firstPaymentPct: "40"; recurringPaymentPct: "6" },
    { code: "B"; firstPaymentPct: "70"; recurringPaymentPct: "3" },
    { code: "C"; firstPaymentPct: "50"; recurringPaymentPct: "8" },
  ];
}

export interface ProgramPreferencesResponse {
  settings: ProgramPreferencesSettings | null;
  effectiveTerms: ProgramPreferencesEffectiveTerms;
  catalog: ProgramPreferencesCatalog;
}

export interface ProgramPreferencesCommand {
  optionCode: ProgramPreferencesOptionCode;
  discountPct: string;
  expectedVersion: number | null;
  reason: string;
}
