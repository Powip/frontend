import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { writeConfigArgs, type WriteOptions } from "@/lib/idempotency";

// FEAT-24 H3-E — compras con costo: órdenes de compra, devoluciones a
// proveedor, proveedores de compras y costo promedio. Todo va por la fachada
// autenticada de ms-products (H3-C), que toma la empresa y el autor del token:
// este servicio nunca envía un companyId.
//
// Costo por rol (H3-D6): a quien no ve costos la fachada le OMITE las claves de
// costo y montos (no las manda en 0). Por eso esos campos son opcionales: si la
// clave no está, la pantalla muestra «••••».

const products = () => process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products;

/* ---------------------------------------------------------------------------
   Órdenes de compra
--------------------------------------------------------------------------- */

export type PurchaseOrderStatus = "BORRADOR" | "PEDIDA" | "RECIBIDA_PARCIAL" | "RECIBIDA" | "ANULADA";
export type PurchasePaymentStatus = "pendiente" | "pagada";
export type PurchaseOrigin = "order" | "direct";

export interface PurchaseOrderLine {
  id: string;
  variantId: string;
  sku: string;
  productName: string;
  attributes: Record<string, string> | null;
  supplierId: string | null;
  supplierName: string | null;
  purchaseUnit: string | null;
  purchaseFactor: number;
  /** Cantidad en unidades de compra (cajas). */
  purchaseQuantity: number;
  /** Unidades de stock = cantidad de compra × factor. */
  quantity: number;
  receivedQuantity: number;
  returnedQuantity: number;
  pendingQuantity: number;
  /** Precio por unidad de compra, como se tipeó (con o sin IGV). Sin permiso: no viene. */
  unitPrice?: number | null;
  /** Costo por unidad de stock sin IGV. Sin permiso: no viene. */
  unitCostNet?: number | null;
  /** Costo de entrada (sin IGV + gastos prorrateados). Sin permiso: no viene. */
  entryCost?: number | null;
}

export interface PurchaseOrder {
  id: string;
  companyId: string;
  /** OC-0001 (orden) o COM-0001 (compra directa de antes). */
  number: string;
  origin: PurchaseOrigin;
  status: PurchaseOrderStatus;
  supplierId: string | null;
  supplierName: string | null;
  inventoryId: string;
  storeId: string | null;
  pricesIncludeIgv: boolean;
  expenses?: number;
  subtotal?: number;
  igvAmount?: number;
  total?: number;
  document: string | null;
  notes: string | null;
  purchaseDate: string | null;
  receiptType: string | null;
  paymentMethod: string | null;
  paymentStatus: PurchasePaymentStatus;
  paidAt: string | null;
  /** YYYY-MM-DD (lo fija la 1ª recepción según la condición del proveedor). */
  dueDate: string | null;
  orderedAt: string | null;
  receivedAt: string | null;
  hasTrackedUnits: boolean;
  cancelReason: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  userEmail: string | null;
  userName: string | null;
  createdAt: string;
  updatedAt: string;
  lines: PurchaseOrderLine[];
}

export interface PurchaseReceptionLine {
  id: string;
  itemId: string;
  variantId: string;
  quantity: number;
  entryCost?: number | null;
  movementId: string | null;
  /** FEAT-24 H5-L: lote en que entró (null en productos sin lotes). */
  lotId?: string | null;
  lotNumber?: string | null;
  expiresAt?: string | null;
}

export interface PurchaseReception {
  id: string;
  /** REC-0001 */
  number: string;
  purchaseOrderId?: string;
  inventoryId: string;
  operationId: string | null;
  notes: string | null;
  userEmail: string | null;
  userName: string | null;
  createdAt: string;
  lines: PurchaseReceptionLine[];
}

export interface PurchaseOrderReturnSummary {
  id: string;
  number: string;
  status: SupplierReturnStatus;
  total?: number;
  creditNoteNumber: string | null;
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  receptions?: PurchaseReception[];
  supplierReturns?: PurchaseOrderReturnSummary[];
}

export interface PurchaseOrderPage {
  items: PurchaseOrder[];
  /** Cantidad de resultados (no es un monto). */
  total: number;
  page: number;
  limit: number;
}

export interface PurchaseOrderFilters {
  status?: PurchaseOrderStatus;
  supplierId?: string;
  origin?: PurchaseOrigin;
  page?: number;
  limit?: number;
}

export interface PurchaseOrderLineInput {
  variantId: string;
  /** Cantidad en unidades de compra. */
  purchaseQuantity: number;
  purchaseFactor: number;
  purchaseUnit: string | null;
  /** Precio por unidad de compra, con o sin IGV según `pricesIncludeIgv`. */
  unitPrice: number;
}

/** Alta y edición (PUT reemplaza la OC completa; solo en BORRADOR). Los montos los calcula el servidor. */
export interface SavePurchaseOrderBody {
  supplierId: string;
  inventoryId: string;
  pricesIncludeIgv: boolean;
  expenses: number;
  document: string | null;
  notes: string | null;
  purchaseDate: string | null;
  receiptType: string | null;
  lines: PurchaseOrderLineInput[];
}

/** `itemId` = id de la línea de la OC; `quantity` en unidades de stock. */
export interface ReceivePurchaseOrderLineInput {
  itemId: string;
  quantity: number;
  /**
   * FEAT-24 H5-L: lote (≤40), vencimiento (YYYY-MM-DD) y comentario (≤300). Obligatorios si el producto maneja lotes
   * (si no, 400). La misma línea puede venir varias veces con lotes distintos.
   */
  lotNumber?: string;
  expiresAt?: string;
  lotComment?: string;
}

export interface ReceivePurchaseOrderBody {
  lines: ReceivePurchaseOrderLineInput[];
  /** Idempotencia: repetir la misma recepción devuelve la registrada (`duplicate: true`). */
  operationId?: string;
  notes?: string | null;
}

export interface ReceivePurchaseOrderResult {
  reception: PurchaseReception;
  purchaseOrder: PurchaseOrder;
  duplicate: boolean;
}

const orders = () => `${products()}/purchase-orders`;
const id = (value: string) => encodeURIComponent(value);

export async function listPurchaseOrders(filters: PurchaseOrderFilters = {}, signal?: AbortSignal): Promise<PurchaseOrderPage> {
  const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ""));
  const { data } = await axiosAuth.get<PurchaseOrderPage>(orders(), { params, signal });
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    total: typeof data?.total === "number" ? data.total : 0,
    page: typeof data?.page === "number" ? data.page : 1,
    limit: typeof data?.limit === "number" ? data.limit : filters.limit ?? 20,
  };
}

export async function getPurchaseOrder(orderId: string, signal?: AbortSignal): Promise<PurchaseOrderDetail> {
  const { data } = await axiosAuth.get<PurchaseOrderDetail>(`${orders()}/${id(orderId)}`, { signal });
  return data;
}

export async function createPurchaseOrder(body: SavePurchaseOrderBody): Promise<PurchaseOrder> {
  const { data } = await axiosAuth.post<PurchaseOrder>(orders(), body);
  return data;
}

export async function updatePurchaseOrder(orderId: string, body: SavePurchaseOrderBody): Promise<PurchaseOrder> {
  const { data } = await axiosAuth.put<PurchaseOrder>(`${orders()}/${id(orderId)}`, body);
  return data;
}

/** BORRADOR → PEDIDA (idempotente). */
export async function placePurchaseOrder(orderId: string): Promise<PurchaseOrder> {
  const { data } = await axiosAuth.post<PurchaseOrder>(`${orders()}/${id(orderId)}/order`);
  return data;
}

/** Recepción parcial o total. Recibir más de lo pendiente → 409 con el SKU. */
export async function receivePurchaseOrder(
  orderId: string,
  body: ReceivePurchaseOrderBody,
  options?: WriteOptions,
): Promise<ReceivePurchaseOrderResult> {
  const { data } = await axiosAuth.post<ReceivePurchaseOrderResult>(
    `${orders()}/${id(orderId)}/receive`,
    body,
    ...writeConfigArgs(options),
  );
  return data;
}

/** Solo Administrador. Con lo recibido, el servidor genera los movimientos inversos (409 si falta stock). */
export async function cancelPurchaseOrder(orderId: string, reason: string): Promise<PurchaseOrder> {
  const { data } = await axiosAuth.post<{ purchaseOrder?: PurchaseOrder } | PurchaseOrder>(`${orders()}/${id(orderId)}/cancel`, {
    reason,
  });
  return (data as { purchaseOrder?: PurchaseOrder })?.purchaseOrder ?? (data as PurchaseOrder);
}

/** Solo Administrador. */
export async function setPurchaseOrderPayment(
  orderId: string,
  status: PurchasePaymentStatus,
  paidAt?: string,
): Promise<PurchaseOrder> {
  const { data } = await axiosAuth.post<PurchaseOrder>(`${orders()}/${id(orderId)}/payment`, {
    status,
    ...(status === "pagada" && paidAt ? { paidAt } : {}),
  });
  return data;
}

/* ---------------------------------------------------------------------------
   Devoluciones a proveedor
--------------------------------------------------------------------------- */

export type SupplierReturnStatus = "borrador" | "enviada" | "nc_recibida" | "anulada";

export interface SupplierReturnLine {
  id: string;
  itemId: string;
  variantId: string;
  sku: string | null;
  productName: string | null;
  quantity: number;
  unitCost?: number | null;
  unitCostNet?: number | null;
  movementId: string | null;
  cancelMovementId: string | null;
}

export interface SupplierReturn {
  id: string;
  companyId: string;
  /** DEV-0001 */
  number: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string | null;
  supplierId: string | null;
  supplierName: string | null;
  inventoryId: string;
  status: SupplierReturnStatus;
  reason: string | null;
  creditNoteNumber: string | null;
  subtotal?: number;
  igvAmount?: number;
  total?: number;
  userEmail: string | null;
  userName: string | null;
  sentAt: string | null;
  creditNoteAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  lines: SupplierReturnLine[];
}

export interface SupplierReturnFilters {
  status?: SupplierReturnStatus;
  purchaseOrderId?: string;
  supplierId?: string;
}

export interface CreateSupplierReturnBody {
  purchaseOrderId: string;
  reason: string | null;
  lines: Array<{ itemId: string; quantity: number }>;
}

const returns = () => `${products()}/supplier-returns`;

export async function listSupplierReturns(filters: SupplierReturnFilters = {}, signal?: AbortSignal): Promise<SupplierReturn[]> {
  const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ""));
  const { data } = await axiosAuth.get<{ items?: SupplierReturn[] }>(returns(), { params, signal });
  return Array.isArray(data?.items) ? data.items : [];
}

/** Queda en borrador: no mueve stock hasta enviarla. */
export async function createSupplierReturn(body: CreateSupplierReturnBody): Promise<SupplierReturn> {
  const { data } = await axiosAuth.post<SupplierReturn>(returns(), body);
  return data;
}

/** borrador → enviada: sale el físico (409 si no alcanza). */
export async function sendSupplierReturn(returnId: string): Promise<SupplierReturn> {
  const { data } = await axiosAuth.post<SupplierReturn>(`${returns()}/${id(returnId)}/send`);
  return data;
}

/** enviada → nc_recibida, con la serie-número de la nota de crédito. */
export async function registerCreditNote(returnId: string, number: string): Promise<SupplierReturn> {
  const { data } = await axiosAuth.post<SupplierReturn>(`${returns()}/${id(returnId)}/credit-note`, { number });
  return data;
}

/** Solo Administrador. Una enviada vuelve a entrar al stock; con nota de crédito → 409. */
export async function cancelSupplierReturn(returnId: string, reason?: string): Promise<SupplierReturn> {
  const { data } = await axiosAuth.post<SupplierReturn>(`${returns()}/${id(returnId)}/cancel`, reason ? { reason } : {});
  return data;
}

/* ---------------------------------------------------------------------------
   Proveedores de compras (los de ms-logistics, con RUC)
--------------------------------------------------------------------------- */

export type SupplierPaymentTerms = "contado" | "credito_15" | "credito_30" | "credito_60";

export interface PurchaseSupplier {
  id: string;
  companyId: string;
  name: string;
  businessName: string | null;
  tradeName: string | null;
  ruc: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  fiscalAddress: string | null;
  paymentTerms: SupplierPaymentTerms;
  active: boolean;
  purchaseCount: number;
  /** Sin permiso de costos: no viene. */
  purchasedLast12Months?: number;
  /** OC recibidas sin pagar menos sus notas de crédito. Sin permiso: no viene. */
  payable?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaveSupplierBody {
  name?: string;
  businessName?: string | null;
  tradeName?: string | null;
  ruc?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  fiscalAddress?: string | null;
  paymentTerms?: SupplierPaymentTerms;
  active?: boolean;
}

const suppliers = () => `${products()}/purchase-suppliers`;

export async function listPurchaseSuppliers(includeInactive = false, signal?: AbortSignal): Promise<PurchaseSupplier[]> {
  const { data } = await axiosAuth.get<{ items?: PurchaseSupplier[] }>(suppliers(), {
    params: { includeInactive: includeInactive ? "true" : "false" },
    signal,
  });
  return Array.isArray(data?.items) ? data.items : [];
}

export async function createPurchaseSupplier(body: SaveSupplierBody): Promise<PurchaseSupplier> {
  const { data } = await axiosAuth.post<PurchaseSupplier>(suppliers(), body);
  return data;
}

/** Cambio parcial: lo que no se manda queda igual. */
export async function updatePurchaseSupplier(supplierId: string, body: SaveSupplierBody): Promise<PurchaseSupplier> {
  const { data } = await axiosAuth.put<PurchaseSupplier>(`${suppliers()}/${id(supplierId)}`, body);
  return data;
}

/* ---------------------------------------------------------------------------
   Costo promedio
--------------------------------------------------------------------------- */

export interface VariantCost {
  variantId: string;
  /** `null` = sin costo. */
  averageCost: number | null;
}

export interface ManualCostChange {
  variantId: string;
  previous: number | null;
  averageCost: number;
}

export interface ManualCostResult {
  items: ManualCostChange[];
  /** La misma carga ya estaba registrada (mismo `operationId`). */
  duplicate: boolean;
}

/** Máximo de variantes por llamada (lo fija la fachada). */
export const VARIANT_COSTS_CHUNK = 1000;

/** Costo promedio por variante. 403 sin permiso de costos (Administrador u Operaciones). */
export async function getVariantCosts(variantIds: string[]): Promise<VariantCost[]> {
  const unique = [...new Set(variantIds.filter((value) => typeof value === "string" && value !== ""))];
  if (unique.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += VARIANT_COSTS_CHUNK) chunks.push(unique.slice(i, i + VARIANT_COSTS_CHUNK));
  const pages = await Promise.all(
    chunks.map(async (chunk) => {
      const { data } = await axiosAuth.post<VariantCost[]>(`${products()}/variant-costs`, { variantIds: chunk });
      return Array.isArray(data) ? data : [];
    }),
  );
  return pages.flat();
}

/**
 * Carga manual del costo promedio (H3-D17). Solo Administrador. Hasta 1000 variantes, cada una una vez.
 * `operationId` (uuid por envío): repetir el mismo envío devuelve lo registrado con `duplicate: true`.
 */
export async function setVariantCosts(input: {
  items: Array<{ variantId: string; averageCost: number }>;
  reason?: string;
  operationId: string;
}): Promise<ManualCostResult> {
  const { data } = await axiosAuth.put<ManualCostResult>(`${products()}/variant-costs`, {
    items: input.items,
    ...(input.reason ? { reason: input.reason } : {}),
    operationId: input.operationId,
  });
  return { items: Array.isArray(data?.items) ? data.items : [], duplicate: data?.duplicate === true };
}

/* ---------------------------------------------------------------------------
   Catálogo para armar la OC (producto → variantes)
--------------------------------------------------------------------------- */

export interface PurchasableProduct {
  id: string;
  name: string;
  sku: string;
  companySku: string | null;
  status: boolean;
  /** Unidad de compra del producto (ej. «Caja»); `null` = se compra por unidad. */
  purchaseUnit: string | null;
  purchaseFactor: number;
}

export interface PurchasableVariant {
  id: string;
  sku: string;
  companySku: string | null;
  attributeValues: Record<string, string>;
  isActive: boolean;
  mergedInto: string | null;
}

const text = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? value : null);
const factor = (value: unknown) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? number : 1;
};

/** Productos de la empresa (`GET /products/company/:id`): nombre, SKU y unidad de compra. */
export async function listPurchasableProducts(companyId: string, signal?: AbortSignal): Promise<PurchasableProduct[]> {
  if (!companyId) return [];
  const { data } = await axiosAuth.get<unknown[]>(`${products()}/products/company/${id(companyId)}`, { signal });
  if (!Array.isArray(data)) return [];
  return data
    .filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === "object" && typeof (raw as { id?: unknown }).id === "string")
    .map((raw) => ({
      id: raw.id as string,
      name: text(raw.name) ?? "Producto sin nombre",
      sku: text(raw.sku) ?? "",
      companySku: text(raw.companySku),
      status: raw.status !== false,
      purchaseUnit: text(raw.purchaseUnit),
      purchaseFactor: factor(raw.purchaseFactor),
    }));
}

/** Variantes de un producto (`GET /product-variant/by-product/:id`). */
export async function listProductVariants(productId: string): Promise<PurchasableVariant[]> {
  const { data } = await axiosAuth.get<unknown[]>(`${products()}/product-variant/by-product/${id(productId)}`);
  if (!Array.isArray(data)) return [];
  return data
    .filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === "object" && typeof (raw as { id?: unknown }).id === "string")
    .map((raw) => ({
      id: raw.id as string,
      sku: text(raw.sku) ?? "",
      companySku: text(raw.companySku),
      attributeValues:
        raw.attributeValues && typeof raw.attributeValues === "object" ? (raw.attributeValues as Record<string, string>) : {},
      isActive: raw.isActive !== false,
      mergedInto: text(raw.mergedInto),
    }));
}
