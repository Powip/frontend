export type QuotationStatus = "PREVENTA" | "VENCIDA" | "CONVERTIDA";
export type QuotationPaymentType = "COMPLETO" | "ADELANTO";
export type QuotationPaymentMethod = "YAPE_QR" | "MERCADO_PAGO" | "TRANSFERENCIA";
export type QuotationPaymentStatus = "PENDIENTE" | "APROBADO" | "RECHAZADO";

export interface QuotationLine {
  id?: string;
  productVariantId?: string | null;
  productId?: string | null;
  sku?: string | null;
  name: string;
  variant?: string | null;
  quantity: number;
  unitPrice: number;
  isManual?: boolean;
  packId?: string | null;
  isPack?: boolean;
  isGift?: boolean;
  stockAvailable?: number | null;
  stockInsufficient?: boolean;
  addedBy?: "VENDEDOR" | "CLIENTE";
  attributes?: Record<string, unknown>;
}

export interface QuotationCatalogItem {
  productVariantId: string;
  productId?: string;
  name: string;
  sku?: string;
  variant?: string;
  unitPrice: number;
  stockAvailable: number | null;
  imageUrl?: string;
  attributes?: Record<string, unknown>;
}

export interface QuotationPayment {
  id: string;
  amount: number;
  method: QuotationPaymentMethod;
  status: QuotationPaymentStatus;
  proofUrl?: string | null;
  createdAt: string;
  registeredBy?: "VENDEDOR" | "CLIENTE";
}

export interface QuotationAddress {
  address: string;
  district: string;
  department?: string;
  province?: string;
  reference?: string;
}

export interface Quotation {
  id: string;
  number: string;
  storeId: string;
  customerName: string;
  customerPhone: string;
  status: QuotationStatus;
  paymentType: QuotationPaymentType;
  suggestedDeposit?: number | null;
  expiresAt: string;
  lines: QuotationLine[];
  payments: QuotationPayment[];
  total: number;
  pendingBalance: number;
  approvedDeposit: number;
  depositAmount?: number;
  verifiedBalance?: number | null;
  publicToken: string;
  publicUrl: string;
  customerConfirmed: boolean;
  address?: QuotationAddress | null;
  internalNote?: string | null;
  sellerName?: string | null;
  orderId?: string | null;
  orderNumber?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateQuotationInput {
  storeId: string;
  customerName: string;
  customerPhone: string;
  lines: QuotationLine[];
  paymentType: QuotationPaymentType;
  suggestedDeposit?: number | null;
  validityHours?: number;
  expiresAt?: string;
  internalNote?: string;
}

export interface ConvertQuotationInput extends QuotationAddress {
  currency?: string;
  zone?: string;
  documentNumber?: string;
  clientType?: string;
  salesChannel: string;
  closingChannel: string;
  deliveryType: string;
  courierId?: string;
  courier?: string;
  shippingTotal?: number;
  salesRegion?: string;
  paymentMethod?: string;
}

export interface QuotationListParams {
  storeId: string;
  status?: QuotationStatus;
  page?: number;
  limit?: number;
  search?: string;
}

export interface QuotationListResponse {
  data: Quotation[];
  total: number;
  page: number;
  limit: number;
  summary: Record<QuotationStatus, number> & { totalAmount: number };
}

export interface QuotationPaymentInput {
  amount: number;
  method: QuotationPaymentMethod;
  proofUrl?: string;
}

export interface ReconcileQuotationLeadPaymentInput {
  /** Explicit financial reconciliation; historical JSON does not declare currency. */
  currency: string;
  /** Acknowledge the approved JSON evidence with the current Finance actor. */
  confirmApproved?: boolean;
}

export interface ReconciledQuotationLeadPayment {
  id: string;
  leadId: string;
  currency: string;
  amount: number | string;
  status: "PENDING" | "PAID" | "LOST";
  leadPaymentVersion: number;
  order?: { id: string } | null;
}

/** Public endpoint deliberately omits internal notes and staff/tenant identifiers. */
export interface PublicQuotation {
  number: string;
  customerName: string;
  status: QuotationStatus;
  paymentType: QuotationPaymentType;
  suggestedDeposit?: number | null;
  expiresAt: string;
  lines: QuotationLine[];
  payments: QuotationPayment[];
  total: number;
  pendingBalance: number;
  approvedDeposit: number;
  depositAmount?: number;
  verifiedBalance?: number | null;
  customerConfirmed: boolean;
  address?: QuotationAddress | null;
  orderNumber?: string | null;
  trackingStatus?: string | null;
  trackingUrl?: string | null;
  sellerPhone?: string | null;
  storeName?: string | null;
}
