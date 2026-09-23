import type { OrderHeader } from "@/interfaces/IOrder";

export function isOrderTrackable(order: OrderHeader): boolean {
  if (order.status === "ANULADO") return false;
  return (
    !!order.guideNumber ||
    !!order.evaStatus ||
    !!order.aliclikDispatchStatus ||
    !!order.shalomStatus ||
    !!order.externalTrackingNumber ||
    (order.status === "ENTREGADO" && order.deliveryType === "DOMICILIO")
  );
}
