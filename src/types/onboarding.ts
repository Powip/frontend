export type OnboardingStep =
  | 'REGISTRATION'
  | 'ADDONS'
  | 'CARD_REDIRECT'
  | 'CARD_WIDGET'
  | 'CONFIRMING'
  | 'PAYMENT_PENDING'
  | 'DONE'
  | 'ERROR';

/** Add-on del catálogo de ms-subscription (GET /subscription/add-ons). */
export interface BackendAddOn {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  amount: number;
  currency: string;
  active?: boolean;
}

/** Plan de ms-subscription (GET /subscription/plans). */
export interface BackendPlan {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  durationInDays: number;
}

/** GET /subscription/subscriptions/me — null si el usuario no tiene suscripción. */
export interface SubscriptionMe {
  id: string;
  status: 'ACTIVE' | 'PENDING_PAYMENT' | 'PENDING_RENEWAL' | 'EXPIRED' | 'CANCELED';
  gateway: 'FLOW' | 'MERCADOPAGO' | 'MANUAL';
  autoRenewal: boolean | null;
  startDate: string | null;
  endDate: string | null;
  plan: { id: string; name: string; price: number; durationInDays: number };
  addOns: { code: string; name: string; amount: number }[];
}

/** POST /subscription/subscriptions/flow/checkout */
export interface FlowCheckoutResponse {
  subscriptionId: string;
  status: string;
  redirectUrl: string;
  cardToken: string;
}

export interface OnboardingState {
  step: OnboardingStep;
  planId: string;
  planName: string;
  price: number;
  addOnIds: string[];
  userId: string | null;
  cardToken: string | null;
  redirectUrl: string | null;
  subscription: SubscriptionMe | null;
  error: string | null;
  isLoading: boolean;
}

/** Lo que sobrevive a la redirección a Flow (localStorage). */
export interface StoredOnboardingState {
  planId: string;
  planName: string;
  price: number;
  addOnIds: string[];
  userId: string;
  cardToken: string;
}
