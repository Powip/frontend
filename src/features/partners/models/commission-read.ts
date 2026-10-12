export interface CommissionCalculationItem {
  id: string;
  observationId: string;
  paymentId: string;
  subscriptionId: string;
  companyId: string;
  attributionId: string;
  partnerId: string;
  businessName: string | null;
  planName: string | null;
  currency: "PEN";
  kind: "FIRST" | "RECURRING" | "ANNUAL";
  initialBase: string | null;
  recurringBase: string | null;
  firstRate: string;
  recurringRate: string;
  residualRate: string;
  grossAmount: string;
  partnerFundedAmount: string;
  netAmount: string;
  approvalId: string;
  createdAt: string;
}

export interface CommissionEvaluation {
  observationId: string;
  companyId: string | null;
  attributionId: string | null;
  state: "BLOCKED" | "GENERATED" | "CONFLICT";
  reasons: string[];
  itemId: string | null;
  firstCheckedAt: string;
  checkedAt: string;
}

export interface CommissionReadPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}
export type CommissionItemsPage = CommissionReadPage<CommissionCalculationItem>;
export type CommissionEvaluationsPage = CommissionReadPage<CommissionEvaluation>;
