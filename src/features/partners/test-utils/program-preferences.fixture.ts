import type { ProgramPreferencesResponse } from "../models/program-preferences";

export function programPreferencesFixture(
  settings: ProgramPreferencesResponse["settings"] = null,
): ProgramPreferencesResponse {
  return {
    settings,
    effectiveTerms: {
      status: "NOT_CONFIGURED",
      policyVersion: null,
      firstPaymentRate: null,
      recurringPaymentRate: null,
    },
    catalog: {
      source: "POWIP_PARTNERS_PROGRAM_SPEC",
      version: "2.0",
      date: "2026-08-17",
      options: [
        { code: "A", firstPaymentPct: "40", recurringPaymentPct: "6" },
        { code: "B", firstPaymentPct: "70", recurringPaymentPct: "3" },
        { code: "C", firstPaymentPct: "50", recurringPaymentPct: "8" },
      ],
    },
  };
}
