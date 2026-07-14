import { InventoryItemForSale } from "@/interfaces/IProduct";

export interface ProductGroup {
  /** Clave estable del "modelo" — usamos el nombre de producto */
  key: string;
  productName: string;
  items: InventoryItemForSale[];
  /** Claves de atributo presentes en TODOS los items del grupo (ej: ["color","talla"]) */
  commonAttributeKeys: string[];
  totalStock: number;
  minPrice: number;
  maxPrice: number;
  imageUrl?: string | null;
}

/** Agrupa variantes planas (una fila por variantId) en "modelos" por nombre de producto */
export function groupProductsByModel(
  items: InventoryItemForSale[],
): ProductGroup[] {
  const map = new Map<string, InventoryItemForSale[]>();
  items.forEach((item) => {
    const list = map.get(item.productName) ?? [];
    list.push(item);
    map.set(item.productName, list);
  });

  return Array.from(map.entries()).map(([productName, groupItems]) => {
    const keySets = groupItems.map(
      (i) => new Set(Object.keys(i.attributes ?? {})),
    );
    const commonAttributeKeys =
      keySets.length > 0
        ? Array.from(keySets[0]).filter((k) =>
            keySets.every((s) => s.has(k)),
          )
        : [];

    const prices = groupItems.map((i) => i.price);
    const stock = groupItems.reduce(
      (acc, i) => acc + Math.max(0, i.availableStock),
      0,
    );

    return {
      key: productName,
      productName,
      items: groupItems,
      commonAttributeKeys,
      totalStock: stock,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      imageUrl: groupItems.find((i) => i.imageUrl)?.imageUrl ?? null,
    };
  });
}

/** true si el grupo se puede representar como matriz 2D (fila x columna) */
export function isMatrixGroup(group: ProductGroup): boolean {
  return group.commonAttributeKeys.length === 2 && group.items.length > 1;
}

export function uniqueAttrValues(
  items: InventoryItemForSale[],
  key: string,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  items.forEach((i) => {
    const v = i.attributes?.[key];
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  });
  return out;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}
