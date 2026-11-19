import { PackageOpen } from "lucide-react";

/** Foto del contenido de un pack guardada en la línea del pedido (`order_items.pack_components`, por 1 pack). */
export interface PackLineComponent {
  variantId: string;
  quantity: number;
  sku?: string | null;
  productName?: string | null;
}

export function isPackLine(line: { packComponents?: PackLineComponent[] | null }): boolean {
  return Array.isArray(line.packComponents) && line.packComponents.length > 0;
}

type OrderLineLike = { sku?: string | null; productName?: string | null; quantity?: number; packComponents?: PackLineComponent[] | null };

/**
 * El comprobante del detalle no trae `packComponents`: se toman de la línea del pedido que coincide por
 * posición (mismo SKU y nombre) o, si no, de la primera con el mismo SKU y nombre que sea un pack.
 */
export function packComponentsForReceiptItem(
  item: OrderLineLike,
  index: number,
  orderItems: readonly OrderLineLike[] | null | undefined,
): PackLineComponent[] | null {
  if (isPackLine(item)) return item.packComponents ?? null;
  if (!orderItems?.length) return null;
  const same = (line: OrderLineLike) => (line.sku ?? "") === (item.sku ?? "") && (line.productName ?? "") === (item.productName ?? "");
  const byIndex = orderItems[index];
  if (byIndex && same(byIndex) && isPackLine(byIndex)) return byIndex.packComponents ?? null;
  return orderItems.find((line) => same(line) && isPackLine(line))?.packComponents ?? null;
}

/**
 * FEAT-24 H9 (H9-D2) — contenido de una línea de pack: «Pack · contiene 2 × Polo M, 1 × Gorra». La
 * cantidad de cada componente se multiplica por las unidades de la línea cuando se pasa `lineQuantity`.
 */
export function PackLineContents({
  components,
  lineQuantity,
  className,
}: {
  components?: PackLineComponent[] | null;
  lineQuantity?: number;
  className?: string;
}) {
  if (!components || components.length === 0) return null;
  const multiplier = lineQuantity && lineQuantity > 1 ? lineQuantity : 1;
  return (
    <div className={className ?? "mt-1 text-xs text-muted-foreground"} data-testid="pack-line-contents">
      <span className="inline-flex items-center gap-1 font-medium text-foreground">
        <PackageOpen className="h-3.5 w-3.5" aria-hidden="true" />
        Pack{multiplier > 1 ? ` × ${multiplier}` : ""} · contiene:
      </span>
      <ul className="ml-5 list-disc">
        {components.map((component) => (
          <li key={component.variantId}>
            {component.quantity * multiplier} × {component.productName || component.sku || "Componente"}
            {component.sku && component.productName ? <span className="font-mono"> ({component.sku})</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
