import type { OrderHeader } from "@/interfaces/IOrder";

/** Match the existing Shopify COD confirmation authority without granting other channels. */
export function canManageCustomerServiceOrder(
  hasPermission: (permission: string) => boolean,
  canalOrigen?: string | null,
): boolean {
  return (
    hasPermission("MANAGE_CUSTOMER_SERVICE") ||
    (canalOrigen === "shopify_cod" && hasPermission("CONFIRM_SALE"))
  );
}

/** Commercial confirmation keeps its own authority, including for manual orders. */
export function canConfirmCustomerServicePurchase(
  hasPermission: (permission: string) => boolean,
  canalOrigen?: string | null,
): boolean {
  return canalOrigen === "shopify_cod"
    ? canManageCustomerServiceOrder(hasPermission, canalOrigen)
    : hasPermission("CONFIRM_SALE");
}

function hasConfirmedOrClosedPurchase(order: Partial<OrderHeader>): boolean {
  return Boolean(order.commercialStage === "SALE" || order.commercialCommittedAt || order.ccConfirmadoAt ||
    order.commercialLead?.confirmedAt || ["PERDIDO", "CONVERTIDO"].includes(order.commercialLead?.status ?? "") ||
    ["PREPARADO", "LLAMADO", "ASIGNADO_A_GUIA", "EN_ENVIO", "ENTREGADO", "ANULADO"].includes(order.status ?? ""));
}

/** Historical manual CC records also need a purchase confirmation before dispatch. */
export function isCustomerServicePurchasePending(order: Partial<OrderHeader>): boolean {
  return order.commercialStage === "LEAD" || (!hasConfirmedOrClosedPurchase(order) && order.externalSource == null &&
    order.subEstadoCc != null && !["confirmado", "anulado_cc", "carrito_recuperado"].includes(order.subEstadoCc));
}

export function canCompleteCustomerServicePurchaseData(order: Partial<OrderHeader>): boolean {
  return !hasConfirmedOrClosedPurchase(order) && isCustomerServicePurchasePending(order) &&
    order.subEstadoCc !== "anulado_cc";
}
