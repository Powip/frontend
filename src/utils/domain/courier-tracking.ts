import type { OrderHeader } from "@/interfaces/IOrder";
import { isCourierDelivery } from "./courier-delivery";

export function isOrderTrackable(order: OrderHeader): boolean {
  if (order.status === "ANULADO") return false;
  return (
    !!order.guideNumber ||
    !!order.evaStatus ||
    !!order.aliclikDispatchStatus ||
    !!order.shalomStatus ||
    !!order.externalTrackingNumber ||
    (order.status === "ENTREGADO" && isCourierDelivery(order))
  );
}
