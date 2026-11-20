/**
 * Entrega que se despacha con guía de courier: DOMICILIO, o PUNTO_EXTERNO
 * («Recojo en agencia») cuando ya tiene courier. Sin courier, PUNTO_EXTERNO
 * no es de courier (la agencia se atiende en mostrador).
 */
export interface CourierDeliveryFields {
  deliveryType?: string | null;
  courier?: string | null;
  courierId?: string | null;
}

export function isCourierDelivery(order: CourierDeliveryFields): boolean {
  const type = (order.deliveryType ?? "").trim().toUpperCase().replace(/[\s_]+/g, "_");
  if (type === "DOMICILIO") return true;
  return type === "PUNTO_EXTERNO" && !!(order.courier || order.courierId);
}
