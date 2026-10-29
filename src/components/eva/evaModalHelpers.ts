import type {
  EvaLinkableItem,
  EvaOrderItemPayload,
  EvaShippingRates,
} from "@/services/evaService";

/** Variante sin código EVA que hay que vincular (paso "Vincular productos"). */
export interface EvaLinkCandidate {
  variantId: string;
  productName: string;
  powipSku: string;
  attributes?: Record<string, string>;
  totalQuantity: number;
  orderCount: number;
}

/** Costo del envío para un distrito canónico: precio del distrito, si no el por defecto, si no null. */
export function resolveEvaShippingCost(
  rates: EvaShippingRates | null,
  district: string,
): number | null {
  if (!rates) return null;
  return rates.districts[district] ?? rates.defaultCost ?? null;
}

/** Clave del código EVA dentro del modal: compartida por variante; por fila si el ítem no tiene variante. */
export function evaSkuKey(
  orderId: string,
  index: number,
  item: EvaLinkableItem,
): string {
  return item.productVariantId
    ? `v:${item.productVariantId}`
    : `o:${orderId}:${index}`;
}

export function codesFromMappings(
  mappings: Array<{ variantId: string; evaSku: string }>,
): Record<string, string> {
  return Object.fromEntries(mappings.map((m) => [`v:${m.variantId}`, m.evaSku]));
}

/** Mismas reglas que el backend: 1 a 60 caracteres, sin `(`, `)` ni `,`. */
export function isValidEvaSkuCode(code: string): boolean {
  const trimmed = code.trim();
  return trimmed.length > 0 && trimmed.length <= 60 && !/[(),]/.test(trimmed);
}

/** Variantes sin código EVA (sin repetir) de todos los pedidos, sumando cantidades y contando pedidos. */
export function findUnlinkedVariants(
  orders: Array<{ items?: EvaLinkableItem[] }>,
  codes: Record<string, string>,
): EvaLinkCandidate[] {
  const byVariant = new Map<string, EvaLinkCandidate>();
  for (const order of orders) {
    const seenInOrder = new Set<string>();
    for (const item of order.items ?? []) {
      const variantId = item.productVariantId;
      if (!variantId || isValidEvaSkuCode(codes[`v:${variantId}`] ?? "")) continue;
      const candidate = byVariant.get(variantId) ?? {
        variantId,
        productName: item.productName,
        powipSku: item.sku,
        attributes: item.attributes,
        totalQuantity: 0,
        orderCount: 0,
      };
      candidate.totalQuantity += item.quantity;
      if (!seenInOrder.has(variantId)) {
        candidate.orderCount += 1;
        seenInOrder.add(variantId);
      }
      byVariant.set(variantId, candidate);
    }
  }
  return [...byVariant.values()];
}

export function itemsHaveEvaSku(
  orderId: string,
  items: EvaLinkableItem[],
  codes: Record<string, string>,
): boolean {
  return (
    items.length > 0 &&
    items.every((item, index) =>
      isValidEvaSkuCode(codes[evaSkuKey(orderId, index, item)] ?? ""),
    )
  );
}

export function buildEvaItemsPayload(
  orderId: string,
  items: EvaLinkableItem[],
  codes: Record<string, string>,
): EvaOrderItemPayload[] {
  return items.map((item, index) => ({
    ...(item.productVariantId ? { variantId: item.productVariantId } : {}),
    evaSku: (codes[evaSkuKey(orderId, index, item)] ?? "").trim(),
    quantity: item.quantity,
    // Snapshots para mostrar el vínculo: el backend acepta hasta 100 y 200 caracteres.
    powipSku: item.sku?.slice(0, 100),
    productName: item.productName?.slice(0, 200),
  }));
}

/** Redondea a centavos: los montos que salen de restar pagos arrastran residuos de punto flotante. */
export function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Costo de envío escrito en un input: vacío es válido (no se informa); si no, mismas
 * reglas que el backend: número entre 0 y 9999.99 con hasta 2 decimales.
 */
export function isValidShippingCostInput(value: string): boolean {
  if (value.trim() === "") return true;
  const n = Number(value);
  return (
    Number.isFinite(n) &&
    n >= 0 &&
    n <= 9999.99 &&
    Math.abs(Math.round(n * 100) - n * 100) < 1e-6
  );
}
