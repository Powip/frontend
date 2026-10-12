export interface AdminCommissionPolicyDraftCommand {
  code: string;
  currency: string;
  firstPaymentRate: string;
  recurringPaymentRate: string;
  recurringPaymentCount: number | null;
  effectiveFrom: string | null;
  reason: string;
}

export interface AdminCommissionPolicyVersion {
  id: string;
  code: string;
  state: "DRAFT";
  currency: string;
  firstPaymentRate: string;
  recurringPaymentRate: string;
  recurringPaymentCount: number | null;
  effectiveFrom: string | null;
  createdAt: string;
}

export interface AdminCommissionPolicyPage {
  items: AdminCommissionPolicyVersion[];
  nextCursor: string | null;
}
