export interface EffectiveAdvertisingRowWire {
  accountId: string;
  provider: "meta" | "tiktok";
  date: string;
  currency: string;
  amount: string;
  source: "imported" | "fallback" | "additional";
  manualRecordId: string | null;
  revision: string | null;
  provisional: boolean;
}

export interface EffectiveAdvertisingTotalWire {
  currency: string;
  amount: string | null;
  importedAmount: string | null;
  fallbackAmount: string;
  additionalAmount: string;
  coverage: "complete" | "partial" | "pending";
  missingAccountDays: number;
  provisional: boolean;
}

export interface EffectiveAdvertisingSpendWire {
  scope: "company";
  from: string;
  to: string;
  rows: EffectiveAdvertisingRowWire[];
  totals: EffectiveAdvertisingTotalWire[];
  pendingManualCount: number;
  representedManualCount: number;
  excludedManualCount: number;
  conflictedManualIds: string[];
}
