/**
 * Panel de pedido de la Bandeja (auditoría filas 23-27). Mismas formas que
 * devuelve ms-crm en `/crm/order-panel` y `/crm/conversations/:id/order-panel`.
 */

export type FirstOffer = "full" | "dep" | "cod";
export type CodAsk = "dep" | "full" | "confirm";

export interface QuantityPromo {
  minQty: number;
  percent: number;
  productId?: string | null;
  label: string;
}

export interface StorePolicy {
  storeId: string;
  /** true si la tienda tiene política propia; false = usa la general o la de fábrica. */
  saved: boolean;
  shipCharge: number;
  firstOffer: FirstOffer;
  depositEnabled: boolean;
  depositAmount: number;
  codFull: boolean;
  codAsk: CodAsk;
  /** Descuento máximo (%) que una vendedora aplica sin pedir permiso. */
  discountCap: number;
  promoText: string;
  quantityPromos: QuantityPromo[];
}

export type SavePolicyInput = Omit<StorePolicy, "saved">;

export interface BundleItem {
  productId?: string | null;
  productKey?: string | null;
  productName: string;
  price: number;
  variantId?: string | null;
  sku?: string | null;
}

export interface Bundle {
  id: string;
  name: string;
  active: boolean;
  channels: string[];
  items: BundleItem[];
  packPrice: number;
}

export interface PromosResponse {
  /** «core» = combos leídos de Powip; «local» = Powip no respondió y solo se usa la política. */
  source: "core" | "local";
  warning: string | null;
  bundles: Bundle[];
  quantityPromos: QuantityPromo[];
  discountCap: number;
  promoText: string;
}

export interface PromoHit {
  label: string;
  percent: number;
  productVariantIds: string[];
  saving: number;
}

export interface ComboSuggestion {
  bundleId: string;
  name: string;
  packPrice: number;
  listPrice: number;
  saving: number;
  inCart: number;
  total: number;
  missing: BundleItem[];
}

export interface EvaluateResponse extends PromosResponse {
  quantityHits: PromoHit[];
  combos: ComboSuggestion[];
}

export interface PanelCartLine {
  productVariantId: string;
  productId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface EvaluateInput {
  storeId?: string;
  channel?: string;
  lines: PanelCartLine[];
}

export type DiscountStatus = "pendiente" | "aprobado" | "rechazado";

export interface DiscountRequest {
  id: string;
  conversationId: string;
  percent: number;
  cap: number;
  status: DiscountStatus;
  reason: string | null;
  requestedByName: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface DiscountResult {
  approved: boolean;
  percent: number;
  cap: number;
  /** Solicitud al supervisor cuando el descuento pasa el tope. */
  request: DiscountRequest | null;
}

export interface AiCartLine {
  productVariantId: string;
  productId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  evidence: string;
  /** Stock del catálogo al momento de armar. */
  stockAvailable?: number;
  sku?: string | null;
  variant?: string | null;
}

export interface AiCartResult {
  lines: AiCartLine[];
  /** «ai» = proveedor real; «mock» = lector local sin llave. */
  source: "ai" | "mock";
  model: string | null;
  warning: string | null;
  storeId: string;
}

export const RECEIPT_METHODS = [
  "YAPE",
  "PLIN",
  "TRANSFERENCIA",
  "BCP",
  "BANCO_NACION",
  "MERCADO_PAGO",
  "EFECTIVO",
] as const;
export type ReceiptMethod = (typeof RECEIPT_METHODS)[number];

export const RECEIPT_METHOD_LABELS: Record<ReceiptMethod, string> = {
  YAPE: "Yape",
  PLIN: "Plin",
  TRANSFERENCIA: "Transferencia",
  BCP: "BCP",
  BANCO_NACION: "Banco de la Nación",
  MERCADO_PAGO: "Mercado Pago",
  EFECTIVO: "Efectivo",
};

export type ReceiptStatus = "porval" | "aprobado" | "rechazado";

export interface PaymentReceipt {
  id: string;
  conversationId: string;
  orderId: string | null;
  orderNumber: string | null;
  quotationId: string | null;
  status: ReceiptStatus;
  method: string;
  methodLabel: string;
  amount: number;
  operationNumber: string | null;
  mime: string | null;
  fileName: string | null;
  hasFile: boolean;
  destination: "core" | "local" | "simulated";
  coreError: string | null;
  uploadedByName: string | null;
  reviewedByName: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface UploadReceiptInput {
  method: ReceiptMethod;
  amount: number;
  operationNumber?: string;
  orderId?: string;
  quotationId?: string;
  file?: File;
  /** Adjunto entrante de WhatsApp: ms-crm toma el archivo del mensaje, sin descargar ni resubir. */
  messageId?: string;
}

export interface SimulatePaymentInput {
  amount: number;
  method?: ReceiptMethod;
  orderId?: string;
}

export const CANCEL_REASONS = {
  no_contesta: "No contesta",
  cancelo: "El cliente canceló",
  datos_falsos: "Datos falsos",
  sin_stock: "Sin stock",
  otro: "Otro motivo",
} as const;
export type CancelReason = keyof typeof CANCEL_REASONS;

/** Pedido contra entrega tal como lo lee el CRM desde Gestión CC. */
export interface CodOrder {
  id: string;
  orderNumber: string | null;
  storeId: string | null;
  status: string;
  subEstadoCc: string | null;
  dniCliente: string | null;
  dniValid: boolean;
  /** Ya confirmado en Gestión CC (también en pedidos sin etapa comercial). */
  confirmed?: boolean;
  /** Core aún ofrece confirmar este pedido. */
  canConfirm?: boolean;
  customerName: string | null;
  phoneNumber: string | null;
  address: string | null;
  district: string | null;
  city: string | null;
  province: string | null;
  referenciaEntrega: string | null;
  courier: string | null;
  total: number;
  paymentMethod: string | null;
}
