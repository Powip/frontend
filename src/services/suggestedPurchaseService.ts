import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { writeConfigArgs } from "@/lib/idempotency";
import type { PurchaseOrderDetail } from "@/services/purchasesService";

// FEAT-24 H13 — pedido sugerido y precio de compra por proveedor. Va por la
// fachada autenticada de ms-products, que toma la empresa, el usuario y el rol
// del token: este servicio nunca envía un companyId.
//
// Costo por rol: a quien no ve costos la fachada le OMITE `lastUnitCost`,
// `estimatedAmount`, `averageUnitCost`, `minUnitCost` y `maxUnitCost` (no los
// manda en 0). Por eso son opcionales: si la clave no está, se muestra «••••».

const products = () => process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products;

/* ---------------------------------------------------------------------------
   Pedido sugerido (H13-D3)
--------------------------------------------------------------------------- */

export interface SuggestedPurchaseItem {
  variantId: string;
  sku: string | null;
  productName: string | null;
  attributes: Record<string, string> | null;
  /** Unidades vendidas en la ventana. */
  unitsSold: number;
  /** Venta diaria = unidades vendidas ÷ días de la ventana. */
  vd: number;
  /** Días que dura el disponible a la venta diaria; `null` = sin ventas. */
  coverageDays: number | null;
  physical: number;
  reserved: number;
  available: number;
  minStock: number;
  /** Llegando por traslado. */
  incomingTransfer: number;
  /** Ya pedido: OC emitidas (Pedida / Recibida parcial) menos lo recibido. */
  pendingPurchase: number;
  /** En OC en borrador: se informa, no resta. */
  draftQuantity: number;
  targetDays: number;
  /** Unidades que faltan (antes de redondear a la unidad de compra). */
  needed: number;
  purchaseUnit: string | null;
  purchaseFactor: number;
  /** Sugerido en unidades de compra (cajas). */
  purchaseQuantity: number;
  /** Sugerido en unidades de stock = cajas × factor. */
  suggested: number;
  supplierId: string | null;
  supplierName: string | null;
  supplierActive: boolean | null;
  /** Último costo neto (sin IGV) por unidad de stock. Sin permiso: no viene. */
  lastUnitCost?: number | null;
  lastPurchaseDate: string | null;
  lastPurchaseNumber: string | null;
  lastPurchaseOrderId: string | null;
  /** Sugerido × último costo. Sin permiso: no viene; sin costo: `null`. */
  estimatedAmount?: number | null;
}

export interface SuggestedPurchaseTotals {
  variants: number;
  units: number;
  purchaseQuantity: number;
  estimatedAmount?: number | null;
  /** Cantidad de líneas sin costo (no es un monto). */
  withoutPrice: number;
  groups?: number;
}

export interface SuggestedPurchaseGroup {
  /** `null` = nunca se le compró a nadie. */
  supplierId: string | null;
  supplierName: string | null;
  supplierActive: boolean | null;
  items: SuggestedPurchaseItem[];
  totals: SuggestedPurchaseTotals;
}

export interface SuggestedPurchase {
  inventoryId: string | null;
  warehouseIds: string[];
  days: number;
  targetDays: number;
  includeWithoutSales: boolean;
  supplierId: string | null;
  generatedAt: string;
  groups: SuggestedPurchaseGroup[];
  totals: SuggestedPurchaseTotals;
  skipped: { notInCatalog: number };
}

export interface SuggestedPurchaseFilters {
  inventoryId?: string;
  /** Días de la ventana de venta (1..365; 30 si no viene). */
  days?: number;
  /** Días a cubrir (1..365; sin él, la regla de la empresa). */
  targetDays?: number;
  supplierId?: string;
  /** También las variantes sin ventas que quedaron bajo el mínimo. */
  includeWithoutSales?: boolean;
}

const EMPTY_TOTALS: SuggestedPurchaseTotals = { variants: 0, units: 0, purchaseQuantity: 0, withoutPrice: 0 };

export async function getSuggestedPurchase(filters: SuggestedPurchaseFilters = {}, signal?: AbortSignal): Promise<SuggestedPurchase> {
  const params: Record<string, string | number> = {};
  if (filters.inventoryId) params.inventoryId = filters.inventoryId;
  if (filters.days) params.days = filters.days;
  if (filters.targetDays) params.targetDays = filters.targetDays;
  if (filters.supplierId) params.supplierId = filters.supplierId;
  if (filters.includeWithoutSales) params.includeWithoutSales = "true";
  const { data } = await axiosAuth.get<SuggestedPurchase>(`${products()}/suggested-purchase`, { params, signal });
  return {
    ...data,
    warehouseIds: Array.isArray(data?.warehouseIds) ? data.warehouseIds : [],
    groups: Array.isArray(data?.groups) ? data.groups.map((group) => ({ ...group, items: Array.isArray(group.items) ? group.items : [] })) : [],
    totals: data?.totals ?? EMPTY_TOTALS,
    skipped: { notInCatalog: Number(data?.skipped?.notInCatalog) || 0 },
  };
}

export interface GenerateSuggestedLine {
  variantId: string;
  /** Unidades de STOCK (1..10.000); el servidor las sube a la unidad de compra del producto. */
  quantity: number;
  supplierId: string;
  /** Costo sin IGV por unidad de stock; sin él, el último costo comprado. */
  unitCost?: number;
}

export interface GenerateSuggestedBody {
  lines: GenerateSuggestedLine[];
  /** Almacén al que llegan las OC; sin él, el principal de la empresa. */
  inventoryId?: string;
  notes?: string;
}

export interface GenerateSuggestedResult {
  runId: string;
  inventoryId: string;
  /** Una OC en BORRADOR por proveedor. */
  purchaseOrders: PurchaseOrderDetail[];
  /** La misma generación ya estaba registrada (misma clave): son las mismas OC. */
  duplicate: boolean;
}

/**
 * Solo Administrador u Operaciones (403 al resto). `operationKey` es la clave de idempotencia: se manda como
 * `operationId` en el cuerpo y, si el header está habilitado, también como `Idempotency-Key` (el mismo valor).
 * Repetirla devuelve las mismas OC con `duplicate: true`.
 */
export async function generateSuggestedPurchase(body: GenerateSuggestedBody, operationKey: string): Promise<GenerateSuggestedResult> {
  const { data } = await axiosAuth.post<GenerateSuggestedResult>(
    `${products()}/suggested-purchase/generate`,
    { ...body, operationId: operationKey },
    ...writeConfigArgs({ idempotencyKey: operationKey, timeoutMs: 60_000 }),
  );
  return {
    runId: data?.runId ?? "",
    inventoryId: data?.inventoryId ?? "",
    purchaseOrders: Array.isArray(data?.purchaseOrders) ? data.purchaseOrders : [],
    duplicate: data?.duplicate === true,
  };
}

/* ---------------------------------------------------------------------------
   Precio de compra por proveedor (H13-D4)
--------------------------------------------------------------------------- */

export interface SupplierPrice {
  variantId: string;
  sku: string | null;
  productName: string | null;
  supplierId: string;
  supplierName: string | null;
  supplierActive: boolean | null;
  /** Compras distintas (no es un monto). */
  purchases: number;
  units: number;
  /** Costos netos (sin IGV) por unidad de stock. Sin permiso: no vienen. */
  lastUnitCost?: number | null;
  averageUnitCost?: number | null;
  minUnitCost?: number | null;
  maxUnitCost?: number | null;
  lastPurchaseUnit: string | null;
  lastPurchaseFactor: number | null;
  lastPurchaseNumber: string | null;
  lastPurchaseOrderId: string | null;
  /** YYYY-MM-DD de la primera y la última compra. */
  firstDate: string | null;
  lastDate: string | null;
}

export interface SupplierPrices {
  items: SupplierPrice[];
  /** Cantidad de filas (no es un monto). */
  total: number;
  /** Se cortó en 5000 filas. */
  truncated: boolean;
}

export async function getSupplierPrices(
  filters: { variantId?: string; supplierId?: string },
  signal?: AbortSignal,
): Promise<SupplierPrices> {
  const params: Record<string, string> = {};
  if (filters.variantId) params.variantId = filters.variantId;
  if (filters.supplierId) params.supplierId = filters.supplierId;
  const { data } = await axiosAuth.get<SupplierPrices>(`${products()}/supplier-prices`, { params, signal });
  const items = Array.isArray(data?.items) ? data.items : [];
  return { items, total: typeof data?.total === "number" ? data.total : items.length, truncated: data?.truncated === true };
}
