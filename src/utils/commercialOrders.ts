export type CommercialOrderProjection = {
  commercialStage?: "LEAD" | "SALE" | null;
  commercialLeadId?: string | null;
  commercialStockState?: "DEFERRED" | "QUEUED" | "PRESERVED" | "NOT_REQUIRED" | null;
};

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
