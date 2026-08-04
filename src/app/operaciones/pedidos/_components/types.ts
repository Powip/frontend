import { OrderHeader, OrderStatus } from "@/interfaces/IOrder";
import type { OpsPermission } from "@/config/operationsPermissions";
import { ORDER_STATUS_FLOW } from "@/utils/domain/orders-status-flow";

/* -----------------------------------------------------------------------
   Modelo de fila para las tablas de Pedidos.
   Es el mismo shape que usaba /operaciones viejo (mapOrderToSale) — se
   preserva tal cual para poder reusar SalesTableFilters/applyFilters sin
   tocarlos, más los campos que necesita Necesita Atención que en el viejo
   vivían solo en el OrderHeader crudo.
------------------------------------------------------------------------ */
export interface Sale {
  id: string;
  customerId: string;
  orderNumber: string;
  clientName: string;
  phoneNumber: string;
  documentType?: string | null;
  documentNumber?: string | null;
  date: string;
  total: number;
  status: OrderStatus;
  paymentMethod: string;
  deliveryType: string;
  salesRegion: "LIMA" | "PROVINCIA";
  province?: string;
  city?: string;
  district: string;
  address: string;
  advancePayment: number;
  pendingPayment: number;
  notes: string;
  courier?: string | null;
  courierId?: string | null;
  guideNumber?: string | null;
  hasStockIssue?: boolean;
  zone?: string;
  callStatus?: "PENDING" | "NO_ANSWER" | "CONFIRMED" | "SCHEDULED" | null;
  callAttempts?: number;
  callbackAt?: string | null;
  cancellationReason?: string | null;
  hasPendingApprovalPayments: boolean;
  sellerName: string | null;
  externalSource?: string | null;
  externalId?: string | null;
  aliclikDispatchStatus?: string | null;
  aliclikSyncedAt?: string | null;
  evaStatus?: string | null;
  evaSyncedAt?: string | null;
  shalomStatus?: string | null;
  shalomError?: string | null;
  syncErrors?: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
  items: SaleItem[];
}

export interface SaleItem {
  productName: string;
  sku: string;
  quantity: number;
  /** = subtotal del ítem. No hay COGS real en el modelo de datos (OrderItem
   *  no trae costo) — se usa como proxy de "valor" para Devoluciones. */
  subtotal: number;
}

export function paidAmount(order: OrderHeader): number {
  return (order.payments ?? [])
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
}

export function mapOrderToSale(order: OrderHeader): Sale {
  const total = Number(order.grandTotal || 0);
  const advancePayment = paidAmount(order);
  const pendingPayment = Math.max(total - advancePayment, 0);
  const hasPendingApprovalPayments = (order.payments ?? []).some(
    (p) => p.status === "PENDING",
  );

  return {
    id: order.id,
    customerId: order.customer?.id,
    orderNumber: order.orderNumber,
    clientName: order.customer?.fullName ?? "—",
    phoneNumber: order.customer?.phoneNumber ?? "",
    documentType: order.customer?.documentType ?? null,
    documentNumber: order.customer?.documentNumber ?? null,
    date: order.created_at
      ? new Date(order.created_at).toLocaleDateString("es-PE")
      : "—",
    total,
    courier: order.courier ?? null,
    courierId: order.courierId ?? null,
    status: order.status,
    paymentMethod:
      order.payments?.length > 0 ? order.payments[0].paymentMethod : "—",
    deliveryType: (order.deliveryType ?? "").replace("_", " "),
    salesRegion: order.salesRegion,
    province: order.customer?.province ?? "",
    city: order.customer?.city ?? "",
    district: order.customer?.district ?? "",
    address: order.customer?.address ?? "",
    advancePayment,
    pendingPayment,
    notes: order.notes ?? "",
    hasStockIssue: order.hasStockIssue ?? false,
    zone: order.customer?.zone ?? undefined,
    guideNumber: order.guideNumber ?? null,
    callStatus: order.callStatus,
    callAttempts: order.callAttempts ?? 0,
    callbackAt: order.callbackAt ?? null,
    cancellationReason: order.cancellationReason ?? null,
    hasPendingApprovalPayments,
    sellerName: order.sellerName ?? null,
    externalSource: order.externalSource ?? null,
    externalId: order.externalId ?? null,
    aliclikDispatchStatus: order.aliclikDispatchStatus ?? null,
    aliclikSyncedAt: order.aliclikSyncedAt ?? null,
    evaStatus: order.evaStatus ?? null,
    evaSyncedAt: order.evaSyncedAt ?? null,
    shalomStatus: order.shalomStatus ?? null,
    shalomError: order.shalomError ?? null,
    syncErrors: order.syncErrors ?? null,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items: (order.items ?? []).map((it) => ({
      productName: it.productName,
      sku: it.sku,
      quantity: it.quantity,
      subtotal: Number(it.subtotal || 0),
    })),
  };
}

/** "Crema x2, Serum x1" — resumen corto para columnas de tabla. */
export function formatProductsShort(items: SaleItem[]): string {
  if (!items || items.length === 0) return "—";
  return items.map((it) => `${it.productName} x${it.quantity}`).join(", ");
}

/** Normalización de teléfono peruano para WhatsApp (misma regla que el resto de la app). */
export function normalizePeruPhone(phoneNumber: string): string {
  let cleanPhone = phoneNumber.replace(/\D/g, "");
  if (!cleanPhone.startsWith("51")) {
    if (cleanPhone.startsWith("0")) {
      cleanPhone = cleanPhone.substring(1);
    }
    cleanPhone = `51${cleanPhone}`;
  }
  return cleanPhone;
}

export function buildTrackingWhatsAppMessage(
  clientName: string | undefined,
  orderNumber: string | undefined,
): string {
  let message = `Hola${clientName ? ` ${clientName}` : ""}! `;
  if (orderNumber) {
    const trackingUrl = `${process.env.NEXT_PUBLIC_LANDING_URL}/rastreo/${orderNumber}`;
    message += `Te contactamos por tu pedido ${orderNumber}.\n\nPuedes rastrear tu pedido aquí: ${trackingUrl}`;
  }
  return message;
}

export function openWhatsApp(
  phoneNumber: string,
  orderNumber?: string,
  clientName?: string,
) {
  const cleanPhone = normalizePeruPhone(phoneNumber);
  const message = buildTrackingWhatsAppMessage(clientName, orderNumber);
  window.open(
    `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
    "_blank",
  );
}

export function daysSince(dateStr?: string | null): number {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function money(n: number): string {
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const ITEMS_PER_PAGE = 15;

export type SaleSource = "listos" | "reprogramado" | "vendido";

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Día (YYYY-MM-DD) al que pertenece el pedido en el cockpit de despacho: su
 *  `callbackAt` si tiene fecha comprometida, si no HOY (recién preparado). */
export function saleDayKey(sale: Sale): string {
  if (sale.callbackAt) return dayKey(new Date(sale.callbackAt));
  return dayKey(new Date());
}

export function saleSource(sale: Sale): SaleSource {
  if (sale.callStatus === "SCHEDULED") return "reprogramado";
  if (sale.callbackAt) return "vendido";
  return "listos";
}

/**
 * Acciones/handlers compartidos que la orquestadora (PedidosContent) pasa a
 * cada pestaña. Se centraliza acá para que las 5 pestañas hablen el mismo
 * contrato y toda la lógica de red / modales viva en un solo lugar.
 */
export interface PedidosActions {
  can: (permission: OpsPermission) => boolean;
  apiCouriers: string[];
  isBulkLoading: boolean;
  onView: (sale: Sale) => void;
  onOpenPayment: (sale: Sale) => void;
  onOpenGuide: (sale: Sale) => void;
  onReassignSeller: (sale: Sale) => void;
  onCancel: (sale: Sale) => void;
  onChangeStatus: (saleId: string, status: OrderStatus) => void | Promise<void>;
  onMarkNoAnswer: (saleId: string) => void;
  onBulkMarkNoAnswer: (ids: string[]) => void;
  onDeliveryReschedule: (sale: Sale) => void;
  onBulkDeliveryReschedule: (ids: string[]) => void;
  onOpenCreateGuide: (selected: Sale[]) => void;
  onOpenAddToGuide: (selected: Sale[]) => void;
  onAssignCourierBulk: (selected: Sale[]) => void;
  onBulkStatusChange: (ids: string[], status: OrderStatus) => void;
  onBulkWhatsApp: (selected: Sale[]) => void;
  onBulkPrint: (selected: Sale[]) => void;
  onCopySelected: (selected: Sale[]) => void;
  onExportExcel: (selected: Sale[], tabName: string) => void;
  onWhatsApp: (sale: Sale) => void;
  onEdit: (sale: Sale) => void;
  onSyncCourier: () => void;
  onReturnToStock: (sale: Sale) => void;
  onMarkAsLoss: (sale: Sale) => void;
  companyId?: string;
}

/**
 * Intersección de estados siguientes disponibles para una selección
 * (regla de bulk: si hay estados mixtos, solo se ofrecen los que aplican a
 * TODOS los seleccionados; si alguno está ANULADO, no se ofrece nada).
 */
export function computeBulkAvailableStatuses(selected: Sale[]): OrderStatus[] {
  if (selected.length === 0) return [];
  if (selected.some((s) => s.status === "ANULADO")) return [];

  let intersection: OrderStatus[] | null = null;
  for (const sale of selected) {
    const next: OrderStatus[] = (ORDER_STATUS_FLOW[sale.status] ?? []).filter(
      (s) => s !== "ANULADO",
    );
    intersection =
      intersection === null
        ? next
        : intersection.filter((s) => next.includes(s));
  }
  return intersection ?? [];
}
