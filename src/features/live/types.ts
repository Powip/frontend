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
  hideSoldOut?: boolean;
  slug?: string;
  advisorId?: string;
  advisorName?: string;
  advisors?: { id: string; name: string; code: string; commission?: boolean }[];
  /** FEAT-33 B5: cómo ve el comprador el catálogo. El logo llega como URL firmada. */
  appearance?: LiveAppearanceConfig;
}
export interface LiveAppearanceConfig {
  theme?: "dark" | "light";
  color?: string;
  displayName?: string;
  logoUrl?: string | null;
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
  /** FEAT-32 M7: foto PROPIA de la variante (la de su color), sin caer en la del producto. */
  variantImageUrl?: string | null;
  variantLabel?: string | null;
  attributes?: Record<string, string>;
  regularPrice: number;
  livePrice: number;
  availableStock: number;
  maxPerCustomer: number | null;
  remainingLimit?: number | null;
  enabled: boolean;
  /**
   * FEAT-32 M7 — contenido del producto en la vitrina (igual en todas sus variantes). En `/live`, `photos` son
   * las hasta 3 fotos del live; en `/catalogo`, las del Catálogo web. Ausente si ms-products no respondió.
   */
  content?: LiveProductContent;
}
/** FEAT-32 M7 — lo que trae la tarjeta en el catálogo público (liviano: se consulta cada 5 s). */
export interface LiveProductContent {
  title: string;
  shortDescription: string;
  photos: string[];
}
/** FEAT-32 M7 — detalle del producto en la vitrina (`GET live/public/:storeId/products/:productId/content`). */
export interface LiveProductContentDetail extends LiveProductContent {
  productId: string;
  /** Ya saneado por ms-products (lista blanca); el front lo vuelve a sanear antes de mostrarlo. */
  descriptionHtml: string;
  features: string[];
}
export interface LiveCustomer {
  id?: string;
  name: string;
  phone: string;
  socialUsername?: string;
  savedDelivery?: LiveDelivery;
  savedReceipt?: LivePurchaseInput["receipt"];
}
export interface LiveReservation {
  id: string;
  sessionId?: string;
  variantId: string;
  checkoutId?: string | null;
  reviewHold?: boolean;
  productName?: string;
  name?: string;
  variantLabel?: string | null;
  attributes?: Record<string, string>;
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
  pendingSales?: number;
  pendingPaymentCount?: number;
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
  /** Clientes que entraron al live de esta tienda (FEAT-33 D3: buscar para marcar de confianza). */
  customers?: LiveTrustedCustomer[];
  trustedCustomers: LiveTrustedCustomer[];
  metrics: LiveMetrics;
  paymentMethods: LivePaymentMethod[];
  capabilities: LiveConsoleCapabilities;
  serverNow: string;
}
export interface LivePublicOrder {
  buyerStatus?: string;
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
  items: {
    variantId?: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }[];
}
export interface LivePublicData {
  channel?: "LIVE" | "WHATSAPP";
  deliveryOptions?: StoreDeliveryOption[];
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
  delivery: LiveDelivery;
  receipt: {
    dni?: string;
    type: "BOLETA" | "FACTURA";
    ruc?: string;
    businessName?: string;
  };
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
  trackingUrl?: string | null;
  buyerStatus?: string;
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
  hasProof?: boolean;
  rejectionReason?: string | null;
  reason?: string | null;
}
export interface LiveCheckoutSnapshot extends LiveCheckout {
  paymentAttempts?: {
    status: string;
    operationNumber?: string;
    reason?: string;
    submittedAt?: string;
    reviewedAt?: string;
  }[];
  orderStatus?: string | null;
  trackingUrl?: string | null;
  checkoutId: string;
  method?: LivePaymentMethod;
  customer?: LiveCustomer;
  delivery?: LiveQuoteInput["delivery"];
  receipt?: LiveQuoteInput["receipt"];
  orderNumber?: string | null;
  createdAt?: string;
  manualPayment?: LiveManualPayment | null;
  canReview?: boolean;
}
export interface LiveYapeReview extends LiveCheckoutSnapshot {
  reviewFlags?: string[];
  quote: LiveQuote;
  customer: LiveCustomer;
  createdAt: string;
}

export interface LiveDelivery {
  type: "HOME" | "AGENCY";
  department?: string;
  province?: string;
  district?: string;
  address?: string;
  reference?: string;
  courier?: "MOTORIZADO" | "SHALOM" | "OLVA";
  agencyId?: string;
  agency?: string;
  dni?: string;
  lat?: number;
  lng?: number;
}
export interface StoreDeliveryOption extends LiveDelivery {
  id: string;
  enabled: boolean;
  price: number;
  hours?: string;
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

/** FEAT-33 C1: acuerdo de comisión con cada creadora o vendedor (nunca por producto). */
export type LiveAgreement =
  | { type: "PERCENT"; percent: number }
  | { type: "PER_UNIT"; amount: number }
  | { type: "RESELLER"; percent: number }
  | { type: "VOLUME"; period: "MONTH" | "LIVE"; tiers: { from: number; percent: number }[] };
export interface LiveSellerStats {
  sales: number;
  units: number;
  orders: number;
  earned: number;
  pendingConfirmation: number;
  paid: number;
  toPay: number;
}
/** FEAT-33 L5b: acceso de la creadora a su portal (lo que ve el negocio). */
export interface LiveSellerAccess {
  status: "INVITED" | "ACTIVE" | "PAUSED";
  hasPassword: boolean;
  lastLoginAt: string | null;
  locked: boolean;
  lockedUntil: string | null;
  pendingLink: { kind: "INVITE" | "RESET"; expiresAt: string } | null;
}
export interface LiveSeller {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  social: string | null;
  code: string;
  userId: string | null;
  status: "ACTIVE" | "REMOVED";
  agreement: LiveAgreement;
  createdAt: string;
  productIds: string[];
  stats: LiveSellerStats;
  /** null = todavía no tiene acceso al portal. */
  access?: LiveSellerAccess | null;
}
export interface LiveSellersData {
  sellers: LiveSeller[];
  /** Asesoras de la configuración que todavía no venden por comisión. */
  advisors: { id: string; name: string; code: string }[];
  kpis: { sales: number; earned: number; toPay: number; pendingConfirmation: number; sellers: number };
  suggestedAgreement: LiveAgreement;
}
export interface LiveSellerSaleLine {
  id: string;
  orderId: string;
  orderNumber: string;
  createdAt: string;
  quantity: number;
  paid: number;
  state: "CONFIRMED" | "PENDING" | "VOID";
  commission: number;
  customer: string;
  product: string;
}
export interface LiveSellerSales {
  seller: Omit<LiveSeller, "productIds" | "stats">;
  stats: LiveSellerStats;
  lines: LiveSellerSaleLine[];
  payouts: { id: string; amount: number; note: string | null; paidAt: string }[];
}
export interface LiveSellerInput {
  name: string;
  email?: string;
  phone?: string;
  social?: string;
  agreement: LiveAgreement;
  productIds: string[];
  fromAdvisorId?: string;
}

/* FEAT-33 L5b: portal de la creadora. */
export interface LiveSellerPortalSession {
  token: string;
  expiresAt: string;
  seller: { name: string };
}
export interface LiveSellerPortalMe {
  seller: { name: string; social: string | null; code: string; agreement: LiveAgreement };
  store: { name: string; slug: string };
  stats: LiveSellerStats;
  today: { units: number; orders: number };
  lastPayoutAt: string | null;
}
export interface LiveSellerPortalProduct {
  productId: string;
  name: string;
  imageUrl: string | null;
  regularPrice: number;
  livePrice: number;
  available: number;
}
export interface LiveSellerPortalSales {
  stats: LiveSellerStats;
  lines: LiveSellerSaleLine[];
  payouts: { amount: number; paidAt: string }[];
}
