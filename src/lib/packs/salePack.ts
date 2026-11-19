import type { CartItem, PackComponentSnapshot } from "@/interfaces/IOrder";
import type { PackView } from "@/services/packsService";

/**
 * FEAT-24 H9 (H9-D2) — vender un pack desde la venta manual.
 *
 * Un pack no tiene ítem de inventario: la línea lleva la variante del pack y ms-ventas la expande por
 * componentes al reservar (H9-B). El disponible es el que calcula ms-products por almacén: el mínimo de
 * ⌊(físico − reservado) ÷ cantidad⌋ de sus componentes.
 */

/** Disponible del pack en un almacén; `null` si ms-products no pudo leer el stock (logística caída). */
export function packAvailableIn(pack: Pick<PackView, "available">, inventoryId: string | null | undefined): number | null {
  if (!pack.available) return null;
  if (!inventoryId) return 0;
  const entry = pack.available.byWarehouse.find((warehouse) => warehouse.inventoryId === inventoryId);
  return entry ? Math.max(0, Number(entry.available) || 0) : 0;
}

/** Foto del contenido por 1 pack, como la guarda ms-ventas en `order_items.pack_components`. */
export function packComponentsSnapshot(pack: Pick<PackView, "components">): PackComponentSnapshot[] {
  return pack.components.map((component) => ({
    variantId: component.variantId,
    quantity: component.quantity,
    sku: component.sku,
    productName: component.productName,
  }));
}

/** Línea del pack ya en el carrito (no de una promo ni un regalo). */
export function findPackLine(cart: readonly CartItem[], packVariantId: string): CartItem | undefined {
  return cart.find((line) => line.variantId === packVariantId && !line.packId && !line.isGift && (line.packComponents?.length ?? 0) > 0);
}

/**
 * Suma una unidad del pack al carrito: si ya está, sube la cantidad; si no, agrega la línea con la
 * variante del pack, su `priceVta` como precio sugerido (la lista de precios lo reemplaza si aplica,
 * `useSuggestedPrices`) y su contenido.
 */
export function addPackLine(cart: CartItem[], pack: PackView, newId: () => string = () => crypto.randomUUID()): CartItem[] {
  const existing = findPackLine(cart, pack.variantId);
  if (existing) return cart.map((line) => (line.id === existing.id ? { ...line, quantity: line.quantity + 1 } : line));
  const price = Math.round((Number(pack.price) || 0) * 100) / 100;
  return [
    ...cart,
    {
      id: newId(),
      // Sin ítem de inventario: el id de la variante (igual que las líneas de un pedido cargado).
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
      packComponents: packComponentsSnapshot(pack),
    },
  ];
}
