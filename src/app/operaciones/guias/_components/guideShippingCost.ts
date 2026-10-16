/**
 * Costo de envío de una guía: el `quotedAmount` guardado (Shalom/EVA) o, si no hay, la
 * suma de `carrierShippingCost` de sus pedidos (envíos EVA individuales, guías viejas).
 * Los decimales pueden llegar como string desde la API.
 */
export function guideShippingCost(
  guide: { quotedAmount?: number | string | null; orderIds?: string[] },
  ordersById: Map<string, { carrierShippingCost?: number | string | null }>,
): number | null {
  const quoted = Number(guide.quotedAmount);
  if (
    guide.quotedAmount !== null &&
    guide.quotedAmount !== undefined &&
    Number.isFinite(quoted) &&
    quoted > 0
  ) {
    return quoted;
  }
  const sum = (guide.orderIds ?? []).reduce((acc, id) => {
    const raw = ordersById.get(id)?.carrierShippingCost;
    const cost = raw === null || raw === undefined ? NaN : Number(raw);
    return Number.isFinite(cost) ? acc + cost : acc;
  }, 0);
  return sum > 0 ? Math.round(sum * 100) / 100 : null;
}
