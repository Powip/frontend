/**
 * FEAT-33 A6/A7: cómo se lee una venta en las listas y el detalle.
 * Solo texto: los valores guardados (deliveryType, externalSource, canales) no cambian.
 */
type OriginInput = { externalSource?: string | null; closingChannel?: string | null };

/** Clave de origen para filtrar: un pedido Live que cerró por el link de WhatsApp o de una creadora es POWIP_LINK. */
export function saleSourceKey(order: OriginInput): string | null {
  if (order.externalSource === "POWIP_LIVE" && order.closingChannel === "POWIP_LINK") return "POWIP_LINK";
  return order.externalSource ?? null;
}

/** «POWIP Live» / «POWIP Link» para los pedidos que entraron por Live; null para el resto. */
export function saleOriginLabel(order: OriginInput): string | null {
  const key = saleSourceKey(order);
  if (key === "POWIP_LIVE") return "POWIP Live";
  if (key === "POWIP_LINK") return "POWIP Link";
  return null;
}

/** «TIKTOK_LIVE» → «TIKTOK LIVE». */
export function channelLabel(value?: string | null): string {
  const text = (value ?? "").trim();
  return text ? text.replace(/_/g, " ").toUpperCase() : "—";
}

/** «AGENCIA SHALOM», «AGENCIA OLVA COURIER», «DOMICILIO»… */
export function deliveryLabel(order: { deliveryType?: string | null; courier?: string | null }): string {
  const type = (order.deliveryType ?? "").trim().toUpperCase();
  if (!type) return "—";
  if (type === "PUNTO_EXTERNO") {
    const courier = (order.courier ?? "").trim();
    if (!courier) return "PUNTO EXTERNO";
    const key = courier.toLowerCase();
    if (key.includes("shalom")) return "AGENCIA SHALOM";
    if (key.includes("olva")) return "AGENCIA OLVA COURIER";
    return `AGENCIA ${courier.toUpperCase()}`;
  }
  return type.replace(/_/g, " ");
}
