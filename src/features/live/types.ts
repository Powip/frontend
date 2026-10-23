export type LivePlatform = "TIKTOK" | "INSTAGRAM" | "FACEBOOK" | "YOUTUBE";
export type LiveStatus = "LIVE" | "ENDED" | "CLOSED";
export type LiveReservationStatus =
  | "PENDING"
  | "ACTIVE"
  | "PAID"
  | "EXPIRED"
  | "RELEASED"
  | "RELEASING";
export type LivePaymentMethod = "yape";
export interface LiveConfig {
  enabled: boolean;
  allowBuyNow: boolean;
  allowReservations: boolean;
  reservationMinutes: number;
  maxReservedUnits: number;
  allowAccumulation: boolean;
  combineShipping: boolean;
  homeShipping: number | null;
  agencyShipping: number | null;
  reminderEnabled: boolean;
  showBackLink: boolean;
  allowSellerLive: boolean;
  closePolicy: "END_OF_DAY" | "24_HOURS" | "MANUAL";
  liveUrl: string;
}
export interface LiveSession {
  id: string;
  status: LiveStatus;
  platform: LivePlatform;
  pinnedVariantId: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  closesAt?: string | null;
}
export interface LiveProduct {
  variantId: string;
  productId?: string;
  name: string;
  sku: string;
  imageUrl?: string | null;
  variantLabel?: string | null;
  regularPrice: number;
  livePrice: number;
  availableStock: number;
  maxPerCustomer: number | null;
  remainingLimit?: number | null;
  enabled: boolean;
}
export interface LiveCustomer {
  id?: string;
  name: string;
  phone: string;
  socialUsername?: string;
}
export interface LiveReservation {
  id: string;
  variantId: string;
  checkoutId?: string | null;
  reviewHold?: boolean;
  productName?: string;
  name?: string;
  variantLabel?: string | null;
  quantity: number;
  unitPrice: number;
  customer: LiveCustomer;
  status: LiveReservationStatus;
  expiresAt: string | null;
  ownerId?: string | null;
  createdAt: string;
  type: "TIMED" | "ACCUMULATED";
}
export interface LiveTrustedCustomer extends LiveCustomer {
  id: string;
}
export interface LiveMetrics {
  totalSales: number;
  orderCount: number;
  instantOrderCount: number;
  activeReservations: number;
  visits: number;
}
export interface LiveConsoleCapabilities {
  readConsole?: boolean;
  read?: boolean;
  operate: boolean;
  manage: boolean;
  reviewPayments?: boolean;
}
export interface LiveReviewConsoleData {
  store: { id: string; name: string; logoUrl?: string | null };
  capabilities: LiveConsoleCapabilities & { readConsole: false };
  serverNow: string;
}
export interface LiveConsoleData {
  readiness?: LiveReadiness;
  deliveryMethods?: LiveDeliveryMethod[];
  paymentIssues?: Array<{
    checkoutId: string;
    orderNumber: string | null;
    customer: LiveCustomer;
    total: number;
    requiresRefund: boolean;
    needsReview: boolean;
    refundStatus: string | null;
    message: string;
  }>;
  store?: { id: string; name: string; logoUrl?: string | null };
  config: LiveConfig;
  session: LiveSession | null;
  products: LiveProduct[];
  reservations: LiveReservation[];
  trustedCustomers: LiveTrustedCustomer[];
  metrics: LiveMetrics;
  paymentMethods: LivePaymentMethod[];
  capabilities: LiveConsoleCapabilities;
  serverNow: string;
}
export interface LivePublicOrder {
  checkoutId?: string;
  method?: LivePaymentMethod;
  manualPayment?: LiveManualPayment | null;
  id: string;
  orderNumber?: string | null;
  status: string;
  paymentStatus: string;
  total: number;
  trackingUrl?: string | null;
  createdAt: string;
  items: { variantId?: string; name: string; quantity: number; unitPrice: number }[];
}
export interface LivePublicData {
  deliveryMethods?: LiveDeliveryMethod[];
  store: { id: string; name: string; logoUrl?: string | null };
  config: LiveConfig;
  session: LiveSession | null;
  products: LiveProduct[];
  reservations: LiveReservation[];
  serverNow: string;
  isTrusted: boolean;
  customer?: LiveCustomer | null;
  orders?: LivePublicOrder[];
  paymentMethods?: LivePaymentMethod[];
}
export interface LiveQuoteInput {
  items: { variantId: string; quantity: number }[];
  reservationIds?: string[];
  customer: LiveCustomer;
  delivery: {
    type: "HOME" | "AGENCY";
    department: string;
    province: string;
    district: string;
    address: string;
    agency?: string;
  };
  receipt: { type: "BOLETA"; dni: string } | { type: "FACTURA"; ruc: string; businessName: string };
}
export interface LivePurchaseInput extends LiveQuoteInput {
  method: LivePaymentMethod;
  idempotencyKey: string;
  quoteId: string;
}
export interface LiveQuote {
  quoteId: string;
  expiresAt: string;
  items?: { variantId: string; name: string; sku: string; quantity: number; unitPrice: number }[];
  serverNow?: string;
  subtotal: number;
  shipping: number;
  total: number;
  currency?: string;
  combinedOrderId?: string | null;
  combinedOrderNumber?: string | null;
}
export interface LiveCheckout {
  manualPayment?: LiveManualPayment | null;
  checkoutId?: string;
  quote?: LiveQuote;
  serverNow?: string;
  checkoutUrl?: string | null;
  paymentUrl?: string | null;
  orderId?: string;
  status?: string;
  message?: string;
}

export interface LiveYapeConfig {
  enabled: boolean;
  phone: string;
  holder: string;
  qrUrl: string | null;
  reviewHours: number;
}
export type LiveManualPaymentStatus =
  | "AWAITING_PROOF"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";
export interface LiveManualPayment {
  status: LiveManualPaymentStatus;
  phone: string;
  holder: string;
  qrUrl?: string | null;
  operationNumber?: string | null;
  proofDeadlineAt: string | null;
  reviewDeadlineAt: string | null;
  proofUploadedAt?: string | null;
  overdue?: boolean;
  rejectionReason?: string | null;
  reason?: string | null;
}
export interface LiveCheckoutSnapshot extends LiveCheckout {
  orderStatus?: string | null;
  trackingUrl?: string | null;
  checkoutId: string;
  method?: LivePaymentMethod;
  customer?: LiveCustomer;
  orderNumber?: string | null;
  createdAt?: string;
  manualPayment?: LiveManualPayment | null;
  canReview?: boolean;
}
export interface LiveYapeReview extends LiveCheckoutSnapshot {
  quote: LiveQuote;
  customer: LiveCustomer;
  createdAt: string;
}

export type LiveDeliveryMethod = "HOME" | "AGENCY";
export interface LiveReadiness {
  ready: boolean;
  checks: {
    code: "YAPE" | "PRODUCTS" | "STOCK" | "SHIPPING" | "CUSTOMER_REVIEW";
    ready: boolean;
    message: string;
  }[];
}
