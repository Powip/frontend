export type LeadPaymentStatus = "PENDING" | "PAID" | "LOST";
export type LeadPaymentMethod =
  | "YAPE"
  | "PLIN"
  | "CONTRAENTREGA"
  | "CONTRA_ENTREGA"
  | "BCP"
  | "BANCO_NACION"
  | "MERCADO_PAGO"
  | "POS"
  | "TRANSFERENCIA"
  | "EFECTIVO";

/** One monetary identity: conversion adds order to this same payment. */
export interface LeadPayment {
  id: string;
  companyId: string | null;
  leadId: string | null;
  currency: string | null;
  captureId: string | null;
  amount: string | number;
  paymentMethod: LeadPaymentMethod;
  status: LeadPaymentStatus;
  leadPaymentVersion: number | null;
  /** Provider/order payments retain their original review and refund routes. */
  management?: "LEAD_ADVANCE" | "ORDER_PAYMENT";
  commercialLeadId?: string;
  contactName?: string | null;
  paymentDate: string;
  externalReference: string | null;
  paymentProofUrl: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  order: { id: string; orderNumber?: string } | null;
  leadStatus?:
    | "NUEVO"
    | "CONTACTADO"
    | "SEGUIMIENTO"
    | "PERDIDO"
    | "CONVERTIDO";
  storeId?: string | null;
  typeCode?: string;
}

export interface LeadPaymentCapabilities {
  enabled: boolean;
  canView: boolean;
  canCapture: boolean;
  canReview: boolean;
}

export interface CaptureLeadPaymentInput {
  /** Generate once for a real advance and reuse the same payload on retries. */
  captureId: string;
  amount: number;
  currency: string;
  paymentMethod: LeadPaymentMethod;
  paymentDate?: string;
  externalReference?: string;
  paymentProofUrl?: string;
  notes?: string;
}

export interface LeadPaymentQuery {
  leadId?: string;
  storeId?: string;
  status?: LeadPaymentStatus;
  page?: number;
  limit?: number;
}

export interface LeadPaymentList {
  data: LeadPayment[];
  total: number;
  page: number;
  limit: number;
}

export interface ReviewLeadPaymentInput {
  version: number;
  notes?: string;
}
export interface ChangeLeadPaymentAmountInput {
  version: number;
  amount: number;
}
export interface ChangeLeadPaymentProofInput {
  version: number;
  paymentProofUrl: string;
}
