export type OnboardingStep =
  | 'ADDONS'
  | 'REGISTRATION'
  | 'CARD_REDIRECT'
  | 'CARD_WIDGET'
  | 'CARD_VERIFY'
  | 'SUBSCRIBE'
  | 'DONE'
  | 'ERROR';

export interface Invoice {
  id: string;
  externalInvoiceId: number;
  subscriptionId: string;
  subject: string;
  currency: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: string;
  paymentLink?: string;
  createdAt: string;
}

export interface OnboardingState {
  step: OnboardingStep;
  planId: string;
  planName: string;
  price: number;
  isAnnual: boolean;
  addOnIds: string[];
  userId: string | null;
  accessToken: string | null;
  cardToken: string | null;
  subscriptionId: string | null;
  invoices: Invoice[] | null;
  error: string | null;
  isLoading: boolean;
}

export interface BackendAddOn {
  id: string;
  externalAddOnId: number;
  name: string;
  currency: string;
  amount: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface StoredOnboardingState {
  planId: string;
  planName: string;
  price: number;
  isAnnual: boolean;
  addOnIds: string[];
  userId: string;
  cardToken: string;
}
