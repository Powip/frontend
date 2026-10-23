export type CommercialOrderProjection = {
  commercialStage?: "LEAD" | "SALE" | null;
  commercialLeadId?: string | null;
  commercialStockState?: "DEFERRED" | "QUEUED" | "PRESERVED" | "NOT_REQUIRED" | null;
};

export type SalesPhysicalOrderProjection = CommercialOrderProjection & {
  externalSource?: string | null;
  shopifyCommercialGate?: boolean | null;
  commercialCommittedAt?: string | null;
  stockVersion?: number | null;
};

const physicalStatuses = new Set(["PREPARADO", "LLAMADO", "ASIGNADO_A_GUIA", "EN_ENVIO", "ENTREGADO"]);

/** Listing a CC order never grants or removes authority to prepare its stock. */
export function salesPhysicalOperationBlockReason(order: SalesPhysicalOrderProjection): string | null {
  if (order.commercialStage === "SALE" && order.commercialStockState === "DEFERRED")
    return "Compra confirmada. Prepara la reserva de stock desde el Lead antes de preparar o despachar el pedido.";
  if (!canOperateCommercialOrder(order)) return "Confirma la compra antes de preparar o despachar el pedido.";
  // Service-only sales retain their existing status flow; the server validates their lines.
  if (order.commercialStage === "SALE" && order.commercialStockState === "NOT_REQUIRED") return null;
  if (order.commercialStockState === "NOT_REQUIRED") return "Confirma la venta antes de prepararla.";
  if (order.externalSource === "shopify" && order.shopifyCommercialGate !== false &&
    !order.commercialCommittedAt && !((order.stockVersion ?? 0) > 0)) {
    return "Confirma el pedido en Ver antes de prepararlo.";
  }
  return null;
}

export function salesStatusBlockReason(order: SalesPhysicalOrderProjection, targetStatus: string): string | null {
  return physicalStatuses.has(targetStatus) ? salesPhysicalOperationBlockReason(order) : null;
}

export const isCommercialLeadOrder = (order: CommercialOrderProjection) =>
  order.commercialStage === "LEAD";
export const isCommercialSaleOrder = (order: CommercialOrderProjection) =>
  !isCommercialLeadOrder(order);
export const canOperateCommercialOrder = (order: CommercialOrderProjection) =>
  isCommercialSaleOrder(order) && order.commercialStockState !== "DEFERRED";
/** Physical guides exclude service-only sales; financial/order operation remains available. */
export const canShipCommercialOrder = (order: CommercialOrderProjection) =>
  canOperateCommercialOrder(order) && order.commercialStockState !== "NOT_REQUIRED";
export const commercialLeadHref = (leadId: string) =>
  `/leads-comerciales?leadId=${encodeURIComponent(leadId)}`;

export function notifyCommercialChange(
  companyId: string | undefined,
  leadId?: string,
) {
  if (typeof window !== "undefined" && companyId)
    window.dispatchEvent(
      new CustomEvent("commercial-leads:changed", {
        detail: { companyId, leadId },
      }),
    );
}
