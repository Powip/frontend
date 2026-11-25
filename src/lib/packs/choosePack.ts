import type { CartItem, ChoosePackRef, OrderItem, PackChoiceEntry, PackComponentSnapshot } from "@/interfaces/IOrder";
import type { VariantStock } from "@/services/inventoryItems.service";
import type { PackChoiceComponentView, PackView } from "@/services/packsService";

/**
 * FEAT-32 M6b (spec §6.14, §7.17) — vender un pack «a elegir» desde la venta manual.
 *
 * Cada combinación elegida es UNA línea del pedido: la línea sigue siendo el pack (su variante, SKU y precio) y
 * lleva la variante elegida por unidad de cada componente (`packChoice`). La identidad de la línea es el pack más
 * la combinación canónica (variantes con cantidades, ordenadas, como la `packKey` de ms-ventas): la misma
 * combinación suma cantidad y otra combinación es otra línea. Al editar un pedido, la línea cargada reenvía su
 * `packKey` mientras no se cambie la elección.
 */

/** Variante elegida por unidad de cada componente: `slot → [variantId | null, …]` (una posición por unidad). */
export type UnitPicks = Record<number, Array<string | null>>;

/** Lo elegido en la ventana: lo que se manda (`choice`) y lo que se muestra en la línea (`components`, por 1 pack). */
export interface ChosenPack {
  choice: PackChoiceEntry[];
  components: PackComponentSnapshot[];
}

/** Formato de la `packKey` de ms-ventas: `<variante del pack>:<16 hex>`. */
export const PACK_KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{16}$/;

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const lower = (id: string) => id.toLowerCase();
const isActive = (variant: { active?: boolean }) => variant.active !== false;

/** Componentes del «a elegir» en el orden del pack (por `slot`). */
export function choiceSlots(pack: Pick<PackView, "choiceComponents">): PackChoiceComponentView[] {
  return [...(pack.choiceComponents ?? [])].sort((a, b) => a.slot - b.slot);
}

/** Talla / color de una variante («M / Crema»); vacío si no tiene atributos. */
export function variantAttributesLabel(attributes: Record<string, string> | null | undefined): string {
  return Object.values(attributes ?? {}).filter(Boolean).join(" / ");
}

/** Una posición vacía por unidad de cada componente. */
export function emptyPicks(pack: Pick<PackView, "choiceComponents">): UnitPicks {
  return Object.fromEntries(
    choiceSlots(pack).map((component) => [component.slot, Array.from({ length: Math.max(1, component.quantity) }, () => null)]),
  );
}

/**
 * Elige la variante de una unidad. Los selectores de un componente arrancan iguales: si las demás unidades siguen
 * sin elegir, toman la misma variante; después cada unidad se cambia sola.
 */
export function pickUnit(picks: UnitPicks, slot: number, unit: number, variantId: string | null): UnitPicks {
  const units = picks[slot] ?? [];
  const othersEmpty = units.every((value, index) => index === unit || value === null);
  const next = variantId && othersEmpty ? units.map(() => variantId) : units.map((value, index) => (index === unit ? variantId : value));
  return { ...picks, [slot]: next };
}

/** Todas las unidades de todos los componentes tienen variante. */
export function picksComplete(pack: Pick<PackView, "choiceComponents">, picks: UnitPicks): boolean {
  const slots = choiceSlots(pack);
  return (
    slots.length > 0 &&
    slots.every((component) => {
      const units = picks[component.slot];
      return !!units && units.length === component.quantity && units.every((value) => !!value);
    })
  );
}

/** `packChoice` de ms-ventas: por componente, una entrada por variante con sus unidades (suman la del componente). */
export function picksToChoice(pack: Pick<PackView, "choiceComponents">, picks: UnitPicks): PackChoiceEntry[] {
  return choiceSlots(pack).flatMap((component) => {
    const counts = new Map<string, number>();
    for (const variantId of picks[component.slot] ?? []) if (variantId) counts.set(variantId, (counts.get(variantId) ?? 0) + 1);
    return [...counts].map(([variantId, quantity]) => ({ slot: component.slot, variantId, quantity }));
  });
}

/**
 * Lo elegido para mostrar en la línea, por variante y en el orden del pack: «2 × Blusa Sofía M / Crema (SOF-M-CRE)».
 * Mismo formato que el contenido de un pack fijo (`PackLineContents`).
 */
export function choiceSnapshot(pack: Pick<PackView, "choiceComponents">, choice: readonly PackChoiceEntry[]): PackComponentSnapshot[] {
  const slots = choiceSlots(pack);
  const byVariant = new Map<string, PackComponentSnapshot>();
  for (const entry of choice) {
    const component = slots.find((slot) => slot.slot === entry.slot);
    const variant = component?.variants.find((option) => lower(option.variantId) === lower(entry.variantId));
    const key = lower(entry.variantId);
    const previous = byVariant.get(key);
    if (previous) {
      previous.quantity += entry.quantity;
      continue;
    }
    const attributes = variantAttributesLabel(variant?.attributeValues);
    byVariant.set(key, {
      variantId: entry.variantId,
      quantity: entry.quantity,
      sku: variant?.sku ?? null,
      productName: component ? [component.productName, attributes].filter(Boolean).join(" ") : null,
    });
  }
  return [...byVariant.values()];
}

/** La elección completa de la ventana, o `null` si falta alguna unidad. */
export function chosenPack(pack: Pick<PackView, "choiceComponents">, picks: UnitPicks): ChosenPack | null {
  if (!picksComplete(pack, picks)) return null;
  const choice = picksToChoice(pack, picks);
  return { choice, components: choiceSnapshot(pack, choice) };
}

/** Combinación canónica: variantes (en minúscula) con sus cantidades sumadas, ordenadas («a*1,b*2»). */
export function canonicalCombination(components: ReadonlyArray<{ variantId: string; quantity: number }>): string {
  const byVariant = new Map<string, number>();
  for (const { variantId, quantity } of components) byVariant.set(lower(variantId), (byVariant.get(lower(variantId)) ?? 0) + quantity);
  return [...byVariant]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([variantId, quantity]) => `${variantId}*${quantity}`)
    .join(",");
}

/** La línea es de un pack «a elegir» (agregada con la ventana o cargada de un pedido con su `packKey`). */
export function isChooseLine(line: Pick<CartItem, "choosePack" | "packKey">): boolean {
  return !!line.choosePack || !!line.packKey;
}

/** Identidad de la línea de un «a elegir»: el pack y su combinación canónica; `null` si no es una o no tiene elección. */
export function chooseLineIdentity(line: Pick<CartItem, "variantId" | "choosePack" | "packKey" | "packChoice" | "packComponents">): string | null {
  if (!isChooseLine(line)) return null;
  const components = line.packChoice?.length ? line.packChoice : line.packComponents;
  if (components?.length) return `${lower(line.variantId)}|${canonicalCombination(components)}`;
  return line.packKey ? `${lower(line.variantId)}|key:${line.packKey}` : null;
}

const identityOf = (pack: Pick<PackView, "variantId">, chosen: ChosenPack) => `${lower(pack.variantId)}|${canonicalCombination(chosen.choice)}`;

/**
 * Le falta la elección a una línea de un «a elegir» (no se puede registrar): sin `packChoice` completo (cada
 * componente con todas sus unidades) ni una `packKey` válida.
 */
export function choiceIncomplete(line: Pick<CartItem, "choosePack" | "packKey" | "packChoice">): boolean {
  if (!isChooseLine(line)) return false;
  if (line.packChoice?.length) {
    const slots = line.choosePack?.slots ?? [];
    if (!slots.length) return true;
    if (line.packChoice.some((entry) => !Number.isInteger(entry.quantity) || entry.quantity < 1 || !slots.some((slot) => slot.slot === entry.slot)))
      return true;
    return !slots.every(
      (slot) => line.packChoice!.filter((entry) => entry.slot === slot.slot).reduce((sum, entry) => sum + entry.quantity, 0) === slot.quantity,
    );
  }
  return !(typeof line.packKey === "string" && PACK_KEY_RE.test(line.packKey));
}

/** Líneas de un «a elegir» sin la elección completa. */
export function linesWithIncompleteChoice(cart: readonly CartItem[]): CartItem[] {
  return cart.filter((line) => !line.isGift && choiceIncomplete(line));
}

/** Campos del «a elegir» en el ítem del pedido: `packChoice` (línea nueva o cambiada) o la `packKey` cargada. */
export function packChoicePayload(item: Pick<CartItem, "packChoice" | "packKey">): { packChoice?: PackChoiceEntry[]; packKey?: string } {
  if (item.packChoice?.length) return { packChoice: item.packChoice.map(({ slot, variantId, quantity }) => ({ slot, variantId, quantity })) };
  if (item.packKey) return { packKey: item.packKey };
  return {};
}

/**
 * Al cargar un pedido para editarlo: la `packKey` de la línea de un «a elegir» (se reenvía si no se cambia la
 * elección). Una clave con otro formato no se puede reenviar: la línea queda para volver a elegir.
 */
export function loadedPackChoice(item: Pick<OrderItem, "packKey">): Pick<CartItem, "packKey" | "choosePack"> {
  if (typeof item.packKey !== "string" || !item.packKey) return {};
  return { packKey: PACK_KEY_RE.test(item.packKey) ? item.packKey : null, choosePack: { packProductId: null, slots: [] } };
}

function chooseFields(pack: Pick<PackView, "id" | "choiceComponents">, chosen: ChosenPack): Pick<CartItem, "packChoice" | "packComponents" | "packKey" | "choosePack"> {
  const ref: ChoosePackRef = {
    packProductId: pack.id,
    slots: choiceSlots(pack).map((component) => ({ slot: component.slot, quantity: component.quantity })),
  };
  return { packChoice: chosen.choice, packComponents: chosen.components, packKey: null, choosePack: ref };
}

const sameChooseLine = (identity: string) => (line: CartItem) => !line.packId && !line.isGift && chooseLineIdentity(line) === identity;

/**
 * Agrega un pack «a elegir» con la combinación elegida: si ya hay una línea con la misma combinación, suma 1; si no,
 * una línea nueva con la variante, el SKU y el precio del pack.
 */
export function addChosenPackLine(cart: CartItem[], pack: PackView, chosen: ChosenPack, newId: () => string = () => crypto.randomUUID()): CartItem[] {
  const existing = cart.find(sameChooseLine(identityOf(pack, chosen)));
  if (existing) return cart.map((line) => (line.id === existing.id ? { ...line, quantity: line.quantity + 1 } : line));
  const price = round2(Number(pack.price) || 0);
  return [
    ...cart,
    {
      id: newId(),
      // Sin ítem de inventario: el id de la variante (igual que `addPackLine`).
      inventoryItemId: pack.variantId,
      variantId: pack.variantId,
      trackingMode: "NONE",
      productName: pack.name,
      sku: pack.sku ?? pack.productSku ?? "",
      imageUrl: pack.imageUrl,
      quantity: 1,
      price,
      pvp: price,
      discount: 0,
      packId: null,
      priceSource: "catalog",
      ...chooseFields(pack, chosen),
    },
  ];
}

/**
 * «Cambiar variantes» de una línea. La misma combinación deja la línea como estaba (con su `packKey`); otra pasa a
 * mandar `packChoice`. Si otra línea ya tiene esa combinación, se juntan (suma la cantidad).
 */
export function changePackChoice(cart: CartItem[], lineId: string, pack: PackView, chosen: ChosenPack): CartItem[] {
  const target = cart.find((line) => line.id === lineId);
  if (!target) return cart;
  const identity = identityOf(pack, chosen);
  if (!choiceIncomplete(target) && chooseLineIdentity(target) === identity) return cart;
  const other = cart.find((line) => line.id !== lineId && sameChooseLine(identity)(line));
  if (other)
    return cart.filter((line) => line.id !== lineId).map((line) => (line.id === other.id ? { ...line, quantity: line.quantity + target.quantity } : line));
  return cart.map((line) => (line.id === lineId ? { ...line, ...chooseFields(pack, chosen) } : line));
}

/** Variantes de la elección actual de la línea (se siguen ofreciendo aunque ya no tengan stock libre). */
export function lineChoiceVariantIds(line: Pick<CartItem, "packChoice" | "packComponents">): Set<string> {
  return new Set((line.packChoice?.length ? line.packChoice : (line.packComponents ?? [])).map((component) => lower(component.variantId)));
}

/** Para «Cambiar variantes»: la elección de la línea (o su contenido guardado) repartida por unidad. */
export function picksFromLine(pack: Pick<PackView, "choiceComponents">, line: Pick<CartItem, "packChoice" | "packComponents">): UnitPicks {
  const picks = emptyPicks(pack);
  const slots = choiceSlots(pack);
  const allowed = (component: PackChoiceComponentView, variantId: string) =>
    component.variants.find((variant) => isActive(variant) && lower(variant.variantId) === lower(variantId));
  if (line.packChoice?.length) {
    for (const component of slots) {
      let unit = 0;
      for (const entry of line.packChoice.filter((choice) => choice.slot === component.slot)) {
        const variant = allowed(component, entry.variantId);
        for (let n = 0; variant && n < entry.quantity && unit < component.quantity; n += 1) picks[component.slot][unit++] = variant.variantId;
      }
    }
    return picks;
  }
  const remaining = new Map((line.packComponents ?? []).map((component) => [lower(component.variantId), component.quantity]));
  for (const component of slots) {
    for (let unit = 0; unit < component.quantity; unit += 1) {
      const variant = component.variants.find((option) => isActive(option) && (remaining.get(lower(option.variantId)) ?? 0) > 0);
      if (!variant) continue;
      picks[component.slot][unit] = variant.variantId;
      remaining.set(lower(variant.variantId), (remaining.get(lower(variant.variantId)) ?? 0) - 1);
    }
  }
  return picks;
}

/** Disponible de cada variante en el almacén (físico − reservado, mínimo 0); 0 si la variante no está en ese almacén. */
export function availableInWarehouse(rows: readonly VariantStock[], inventoryId: string): Map<string, number> {
  const available = new Map<string, number>();
  for (const row of rows) {
    const entry = row.inventories?.find((inventory) => inventory.inventory_id === inventoryId);
    available.set(lower(row.variant_id), entry ? Math.max(0, Number(entry.quantity) - Number(entry.reserved_quantity)) || 0 : 0);
  }
  return available;
}

export type OfferedVariant = PackChoiceComponentView["variants"][number] & {
  /** Disponible en el almacén; `null` = stock sin confirmar. */
  available: number | null;
};

/**
 * Variantes que se ofrecen en un componente: las permitidas activas con stock en el almacén (las sin stock no se
 * ofrecen). Sin dato de stock (`null`) se ofrecen todas, con «stock sin confirmar». Las de `keep` (la elección actual
 * de la línea) se ofrecen siempre.
 */
export function offeredVariants(
  component: PackChoiceComponentView,
  stock: ReadonlyMap<string, number> | null,
  keep: ReadonlySet<string> = new Set(),
): OfferedVariant[] {
  return component.variants
    .filter(isActive)
    .map((variant) => ({ ...variant, available: stock ? (stock.get(lower(variant.variantId)) ?? 0) : null }))
    .filter((variant) => variant.available === null || variant.available > 0 || keep.has(lower(variant.variantId)));
}
