import type { CartItem } from "@/interfaces/IOrder";
import type { EvaluateItem, PackSuggestion, SaleEngineLine } from "@/services/promotionsService";
import type { PackView } from "@/services/packsService";
import { packComponentsSnapshot } from "@/lib/packs/salePack";
import { getOrderItemPricing, isEnginePriced } from "./orderItemPricing";

/**
 * FEAT-32 M6a — precios de la venta nueva con el motor de promociones de ms-ventas (`POST /promos/evaluate`).
 * Funciones puras: el carrito guarda el precio sugerido de siempre y el motor se aplica encima al mostrar,
 * sumar y guardar (así nunca se pisa lo que escribió el vendedor).
 */

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Línea que el motor puede tocar. No elegibles (su precio queda como hoy): precio escrito a mano, un bundle
 * anterior aplicado (`packId`), regalos y líneas sin variante.
 */
export function isEngineEligible(line: CartItem): boolean {
  if (line.isGift || !line.variantId || line.quantity <= 0) return false;
  if (line.priceSource === "manual" || line.discMode === "man") return false;
  return !line.packId;
}

export interface EngineRequestLine extends EvaluateItem {
  /** Línea del carrito (para aplicar la respuesta, que llega en el mismo orden). */
  id: string;
  productVariantId: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
}

export interface EngineRequest {
  storeId: string;
  channel?: string;
  inventoryId?: string;
  lines: EngineRequestLine[];
}

/**
 * Cuerpo del motor: todas las líneas vendidas (también las no elegibles, cuentan para el volumen y el regalo),
 * con su precio de catálogo/sugerido (`unitPrice`, el motor parte del precio del canal) y su descuento.
 * `null` si no hay tienda o no hay líneas.
 */
export function buildEngineRequest(
  cart: readonly CartItem[],
  scope: { storeId?: string | null; channel?: string | null; inventoryId?: string | null },
): EngineRequest | null {
  if (!scope.storeId) return null;
  const lines = cart
    .filter((line) => line.quantity > 0 && !line.isGift && !!line.variantId)
    .map((line) => {
      const { unitPrice, discountAmount } = getOrderItemPricing(line);
      return { id: line.id, productVariantId: line.variantId, quantity: line.quantity, unitPrice, discountAmount };
    });
  if (!lines.length) return null;
  return {
    storeId: scope.storeId,
    ...(scope.channel ? { channel: scope.channel } : {}),
    ...(scope.inventoryId ? { inventoryId: scope.inventoryId } : {}),
    lines,
  };
}

/**
 * Precio de una línea elegible con el motor: lista = `listPrice`, promo = `promoTotal` y el descuento manual
 * (`pct`/`amt`, por unidad) se aplica SOBRE el precio de promo.
 */
export function priceEngineLine(
  line: CartItem,
  engine: { listPrice: number; promoTotal: number; promoId: string | null; labels: string[] },
): CartItem {
  const quantity = line.quantity;
  const listPrice = round2(engine.listPrice);
  const promoTotal = Math.min(round2(engine.promoTotal), round2(listPrice * quantity));
  const promoUnitPrice = round2(promoTotal / quantity);
  const value = Math.max(0, Number(line.discValue) || 0);
  const manual =
    line.discMode === "pct"
      ? round2((promoTotal * Math.min(value, 100)) / 100)
      : line.discMode === "amt"
        ? round2(Math.min(value, promoUnitPrice) * quantity)
        : 0;
  const lineTotal = Math.max(0, round2(promoTotal - Math.min(manual, promoTotal)));
  return {
    ...line,
    pvp: listPrice,
    price: round2(lineTotal / quantity),
    listPrice,
    promoUnitPrice,
    promoId: engine.promoId,
    promoLabels: engine.labels,
    promoDiscountAmount: Math.max(0, round2(listPrice * quantity - promoTotal)),
    lineTotal,
  };
}

/**
 * Aplica la respuesta del motor a las líneas elegibles. La respuesta trae su pedido (`request`): si la línea ya
 * no es la misma variante se deja como está; si solo cambió la cantidad (respuesta en camino) se usa el precio
 * por unidad de la respuesta anterior hasta que llegue la nueva.
 */
export function applyEngineResult(
  cart: CartItem[],
  request: Pick<EngineRequest, "lines">,
  lines: readonly SaleEngineLine[],
): CartItem[] {
  if (!lines.length) return cart;
  const byId = new Map(
    request.lines.map((sent, position) => [sent.id, { sent, result: lines.find((line) => line.index === position) }]),
  );
  return cart.map((line) => {
    if (!isEngineEligible(line)) return line;
    const hit = byId.get(line.id);
    if (!hit?.result || hit.result.isGift || hit.sent.productVariantId !== line.variantId) return line;
    const same = hit.sent.quantity === line.quantity && hit.result.quantity === line.quantity;
    return priceEngineLine(line, {
      listPrice: hit.result.listPrice,
      promoTotal: same ? hit.result.lineTotal : hit.result.unitPrice * line.quantity,
      promoId: hit.result.promoId,
      labels: hit.result.labels,
    });
  });
}

/** Neto de la línea: el del motor si lo tiene; si no, precio × cantidad (como hoy). */
export function lineNet(line: CartItem): number {
  return isEnginePriced(line) ? line.lineTotal : line.price * line.quantity;
}

/**
 * Totales de la venta con motor: Subtotal (a precio de lista), Descuentos por promociones (motor y bundles
 * anteriores) y Descuento manual (el resto).
 */
export function saleDiscountBreakdown(lines: readonly CartItem[]): {
  listSubtotal: number;
  promoDiscount: number;
  manualDiscount: number;
  subtotal: number;
} {
  let listSubtotal = 0;
  let promoDiscount = 0;
  let manualDiscount = 0;
  let subtotal = 0;
  for (const line of lines) {
    const gross = getOrderItemPricing(line).unitPrice * line.quantity;
    const net = lineNet(line);
    listSubtotal += gross;
    subtotal += net;
    if (isEnginePriced(line)) {
      const promo = Math.max(0, line.promoDiscountAmount ?? 0);
      promoDiscount += promo;
      manualDiscount += Math.max(0, gross - promo - net);
    } else if (line.packId) {
      promoDiscount += Math.max(0, gross - net);
    } else {
      manualDiscount += Math.max(0, gross - net);
    }
  }
  return {
    listSubtotal: round2(listSubtotal),
    promoDiscount: round2(promoDiscount),
    manualDiscount: round2(manualDiscount),
    subtotal: round2(subtotal),
  };
}

/** Líneas vendidas sin SKU (no se pueden registrar: el almacén no sabe qué sacar). */
export function linesWithoutSku(cart: readonly CartItem[]): CartItem[] {
  return cart.filter((line) => !line.isGift && !line.sku?.trim());
}

/** Texto del badge de promo: a una campaña sola se le suma el % («Cyber Wow −20%»). */
export function promoBadgeLabel(label: string, line: Pick<CartItem, "promoLabels" | "listPrice" | "promoUnitPrice">): string {
  const list = line.listPrice ?? 0;
  const promo = line.promoUnitPrice ?? list;
  if ((line.promoLabels?.length ?? 0) !== 1 || label.startsWith("Volumen") || list <= 0 || promo >= list) return label;
  const percent = Math.round((1 - promo / list) * 100);
  return percent >= 1 ? `${label} −${percent}%` : label;
}

/**
 * «Agregar pack» desde una sugerencia: la línea del pack con su variante, nombre, SKU, precio y contenido. Con
 * el pack de ms-products (`pack`) el contenido lleva nombres y SKU; sin él, el de la sugerencia. Si ya está,
 * suma una unidad.
 */
export function addSuggestedPackLine(
  cart: CartItem[],
  suggestion: PackSuggestion,
  pack?: PackView | null,
  newId: () => string = () => crypto.randomUUID(),
): CartItem[] {
  const existing = cart.find((line) => line.variantId === suggestion.packVariantId && !line.packId && !line.isGift);
  if (existing) return cart.map((line) => (line.id === existing.id ? { ...line, quantity: line.quantity + 1 } : line));
  const price = round2(suggestion.packPrice);
  const components = pack?.variantId === suggestion.packVariantId && pack.components.length
    ? packComponentsSnapshot(pack)
    : suggestion.components.map((component) => ({ variantId: component.variantId, quantity: component.quantity }));
  return [
    ...cart,
    {
      id: newId(),
      // Sin ítem de inventario: el id de la variante (igual que `addPackLine`).
      inventoryItemId: suggestion.packVariantId,
      variantId: suggestion.packVariantId,
      trackingMode: "NONE",
      productName: suggestion.name,
      sku: suggestion.sku ?? "",
      imageUrl: pack?.variantId === suggestion.packVariantId ? pack.imageUrl : null,
      quantity: 1,
      price,
      pvp: price,
      discount: 0,
      packId: null,
      priceSource: "catalog",
      packComponents: components,
    },
  ];
}
