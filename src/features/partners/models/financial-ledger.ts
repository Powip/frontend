export interface FinancialLedgerEntry {
  id: string;
  postingId: string;
  calculationItemId: string;
  partnerId: string;
  observationId: string;
  companyId: string;
  paymentId: string;
  subscriptionId: string;
  sourceItemKind: "FIRST" | "RECURRING" | "ANNUAL";
  currency: "PEN";
  kind: "GROSS_COMMISSION" | "PARTNER_FUNDED_DISCOUNT";
  signedAmount: string;
  postedAt: string;
}

export interface FinancialLedgerPage {
  items: FinancialLedgerEntry[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

export interface FinancialLedgerBalance {
  partnerId: string;
  currency: "PEN";
  postedLedgerBalance: string;
  postedEntryCount: number;
  availability: "NO_POSTED_ENTRIES" | "POSTED_ENTRIES";
  settlementEligibility: "NOT_EVALUATED";
  asOf: string;
}
