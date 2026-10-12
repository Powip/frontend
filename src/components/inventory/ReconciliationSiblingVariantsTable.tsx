"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReconciliationTaskDetailProductVariant } from "@/services/reconciliationTask.service";
import type { VariantStock } from "@/services/inventoryItems.service";
import { formatMoney } from "./mergeStockCost";

interface ReconciliationSiblingVariantsTableProps {
  variants: ReconciliationTaskDetailProductVariant[];
  currentVariantId: string;
  stockByVariantId: Map<string, VariantStock>;
  isStockLoading: boolean;
  isStockError: boolean;
}

// Variantes hermanas del producto de una candidata (FEAT-17 Anexo B), con
// costo (Anexo E). Costo va al final para no mover las columnas existentes.
export function ReconciliationSiblingVariantsTable({
  variants,
  currentVariantId,
  stockByVariantId,
  isStockLoading,
  isStockError,
}: ReconciliationSiblingVariantsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="h-7 px-2 text-[10px]">Atributos</TableHead>
          <TableHead className="h-7 px-2 text-[10px]">SKU</TableHead>
          <TableHead className="h-7 px-2 text-right text-[10px]">Precio</TableHead>
          <TableHead className="h-7 px-2 text-right text-[10px]">Stock</TableHead>
          <TableHead className="h-7 px-2 text-right text-[10px]">Costo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {variants.map((variant) => {
          const variantStock = stockByVariantId.get(variant.id);
          const isThisVariant = variant.id === currentVariantId;
          return (
            <TableRow key={variant.id} className={isThisVariant ? "bg-primary/5" : undefined}>
              <TableCell className="px-2 py-1 whitespace-normal">
                {Object.values(variant.attribute_values).filter(Boolean).join(" · ") || "—"}
                {isThisVariant && (
                  <Badge variant="outline" className="ml-1 text-[9px]">
                    Esta variante
                  </Badge>
                )}
              </TableCell>
              <TableCell className="px-2 py-1 font-mono">
                {variant.sku ?? variant.company_sku ?? "—"}
              </TableCell>
              <TableCell className="px-2 py-1 text-right">{formatMoney(variant.price)}</TableCell>
              <TableCell className="px-2 py-1 text-right">
                {isStockLoading ? "…" : isStockError ? "—" : (variantStock?.quantity ?? 0)}
              </TableCell>
              <TableCell className="px-2 py-1 text-right">
                {variant.cost === null || variant.cost === undefined ? "—" : formatMoney(variant.cost)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
