import { OrderStatus } from "@/interfaces/IOrder";

export const ORDER_STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  PENDIENTE: ["PREPARADO", "ANULADO"],
  PREPARADO: ["LLAMADO", "ANULADO"],
  LLAMADO: ["EN_ENVIO", "ANULADO"],
  EN_ENVIO: ["ENTREGADO", "ANULADO"],
  ENTREGADO: [],
  ANULADO: [],
};
