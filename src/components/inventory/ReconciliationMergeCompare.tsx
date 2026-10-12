"use client";

import { Badge } from "@/components/ui/badge";
import type {
  ReconciliationTaskDetailCandidate,
  ReconciliationTaskItem,
} from "@/services/reconciliationTask.service";
import type { VariantStock } from "@/services/inventoryItems.service";
import { formatMoney } from "./mergeStockCost";
import { ReconciliationSiblingVariantsTable } from "./ReconciliationSiblingVariantsTable";
import { ReconciliationSourceChip } from "./ReconciliationSourceChip";

interface ReconciliationMergeCompareProps {
  items: ReconciliationTaskItem[];
  winnerId: string;
  candidateByVariantId: Map<string, ReconciliationTaskDetailCandidate>;
  stockByVariantId: Map<string, VariantStock>;
  isStockLoading: boolean;
  isStockError: boolean;
}

// FEAT-17 Anexo E — paso 2 "Corroborar": solo lectura, la madre primero.
export function ReconciliationMergeCompare({
  items,
  winnerId,
  candidateByVariantId,
  stockByVariantId,
  isStockLoading,
  isStockError,
}: ReconciliationMergeCompareProps) {
  const ordered = [...items]
    .filter((item) => item.variant_id !== null)
    .sort((a, b) => Number(b.variant_id === winnerId) - Number(a.variant_id === winnerId));

  return (
    <div data-testid="merge-compare" className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {ordered.map((item) => {
        const variantId = item.variant_id as string;
        const detail = candidateByVariantId.get(variantId);
        const stock = stockByVariantId.get(variantId);
        const name = detail?.product?.name ?? item.variant_name;
        const attributes = Object.values(
          detail?.variant.attribute_values ?? item.attribute_values ?? {},
        ).filter(Boolean);
        const stockText = isStockLoading
          ? "…"
          : isStockError
            ? "—"
            : `${stock?.quantity ?? 0} (${stock?.reserved_quantity ?? 0} reservado)`;
        return (
          <div key={variantId} className="space-y-2 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{name}</span>
              <ReconciliationSourceChip source={item.source} />
              <Badge variant={variantId === winnerId ? "default" : "outline"}>
                {variantId === winnerId ? "Queda en Powip" : "Se fusiona"}
              </Badge>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Atributos</dt>
              <dd>{attributes.join(" · ") || "—"}</dd>
              <dt className="text-muted-foreground">SKU</dt>
              <dd className="font-mono">{detail?.variant.sku ?? item.sku ?? item.company_sku ?? "Sin SKU"}</dd>
              <dt className="text-muted-foreground">Precio</dt>
              <dd>{detail ? formatMoney(detail.variant.price) : "—"}</dd>
              <dt className="text-muted-foreground">Costo</dt>
              <dd>{detail?.variant.cost === null || detail?.variant.cost === undefined ? "—" : formatMoney(detail.variant.cost)}</dd>
              <dt className="text-muted-foreground">Stock</dt>
              <dd>{stockText}</dd>
            </dl>
            {detail?.product && (
              <ReconciliationSiblingVariantsTable
                variants={detail.product.variants}
                currentVariantId={variantId}
                stockByVariantId={stockByVariantId}
                isStockLoading={isStockLoading}
                isStockError={isStockError}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
