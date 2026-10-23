/** Página "Plan y facturación" (FEAT-25 E2.2): GET /subscription/subscriptions/billing. */
export type BillingMode = "FLOW_ACTIVE" | "FLOW_CANCELING" | "FLOW_SCHEDULED" | "NO_FLOW" | "EXEMPT";

export interface BillingPlan {
  id: string;
  name: string;
  price: number;
  durationInDays: number;
}

export interface BillingPendingPlan {
  planId: string;
  name: string;
  price: number;
  /** yyyy-MM-dd */
  startsOn: string;
}

export interface BillingAddOn {
  id: string;
  code: string;
  name: string;
  amount: number;
  /** Último día que se tiene el add-on (baja programada); null si sigue. */
  endsOn: string | null;
}

export interface BillingAvailableAddOn {
  id: string;
  code: string;
  name: string;
  description: string | null;
  amount: number;
}

export interface BillingPayment {
  date: string;
  amount: number;
  status: "PAID" | "FAILED";
}

export interface PlanBilling {
  mode: BillingMode;
  isOwner: boolean;
  currency: string;
  plan: BillingPlan | null;
  paidUntil: string | null;
  nextChargeDate: string | null;
  nextChargeTotal: number | null;
  firstChargeDate: string | null;
  pendingPlan: BillingPendingPlan | null;
  addOns: BillingAddOn[];
  payments: BillingPayment[];
  availablePlans: BillingPlan[];
  availableAddOns: BillingAvailableAddOn[];
}

export interface PlanChangePreview {
  direction: "UP" | "DOWN";
  /** Lo que Flow cobra hoy al subir de plan. */
  balance: number | null;
  currency: string | null;
  startsOn: string | null;
  nextChargeTotal: number | null;
}
