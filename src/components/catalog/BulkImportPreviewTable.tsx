"use client";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROW_STATUS_LABEL, previewSummaryText, type BulkImportSummary, type PreviewRow } from "@/lib/catalog/bulkImportPreview";

const STATUS_CLASS: Record<PreviewRow["status"], string> = {
  crear: "border-green-300 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400",
  actualizar: "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  error: "border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
};

/**
 * FEAT-24 H4 (H4-D9) — vista previa del servidor (`bulk-import?dryRun=true`): qué hace cada fila del
 * Excel (crear / actualizar / error), con sus errores y avisos, y el resumen. No escribe nada.
 */
export default function BulkImportPreviewTable({ rows, summary }: { rows: PreviewRow[]; summary: BulkImportSummary }) {
  const warnings = rows.reduce((total, row) => total + row.warnings.length, 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm" aria-label="Resumen de la vista previa">
        <span className="font-medium">{previewSummaryText(summary)}</span>
        {warnings ? <Badge variant="outline" className="border-amber-300 text-amber-700">{warnings} avisos</Badge> : null}
        {summary.marcasNuevas.length ? <span className="text-muted-foreground">· Marcas nuevas: {summary.marcasNuevas.join(", ")}</span> : null}
      </div>
      <div className="max-h-[500px] overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-secondary">
            <TableRow>
              <TableHead className="w-20">Fila Excel</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>SKU base</TableHead>
              <TableHead>SKU de variante</TableHead>
              <TableHead className="w-28">Estado</TableHead>
              <TableHead className="min-w-[260px]">Errores y avisos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.index} data-status={row.status} className={row.status === "error" ? "bg-red-50/40 dark:bg-red-950/10" : ""}>
                <TableCell className="text-xs text-muted-foreground">{row.excelRow ?? "—"}</TableCell>
                <TableCell className="text-xs font-medium">{row.productName ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{row.productSku ?? "Se genera"}</TableCell>
                <TableCell className="font-mono text-xs">{row.variantSku ?? "Se genera"}</TableCell>
                <TableCell><Badge variant="outline" className={STATUS_CLASS[row.status]}>{ROW_STATUS_LABEL[row.status]}</Badge></TableCell>
                <TableCell className="text-xs">
                  {row.errors.length || row.warnings.length ? (
                    <ul className="space-y-0.5">
                      {row.errors.map((message, i) => <li key={`e${i}`} className="text-red-700 dark:text-red-400">{message}</li>)}
                      {row.warnings.map((message, i) => <li key={`w${i}`} className="text-amber-700 dark:text-amber-400">Aviso: {message}</li>)}
                    </ul>
                  ) : <span className="text-muted-foreground">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
