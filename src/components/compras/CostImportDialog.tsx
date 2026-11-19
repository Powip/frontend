"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { warehouseErrorMessage } from "@/components/forms/warehouseUi";
import {
  buildCostPreview,
  buildCostTemplate,
  costItems,
  lookupCostCodes,
  readCostWorkbook,
  type CostPreviewRow,
} from "@/lib/costImport";
import { newOperationId } from "@/lib/purchaseOrders";
import { getVariantCosts, setVariantCosts } from "@/services/purchasesService";
import { lookupVariantsByCodes } from "@/services/variantCodesService";
import { Money } from "./PurchaseBits";

// FEAT-24 H3-E (H3-D17) — carga del costo promedio por Excel (solo
// Administrador): columnas «SKU de la empresa» y «Costo» (sin IGV). Se ve la
// vista previa fila por fila con el costo actual y nada se guarda hasta
// confirmar; las filas con errores no se cargan. Cada vista previa tiene su
// `operationId`: reintentar el mismo envío no lo duplica.

interface Props {
  companyId: string;
  onClose: () => void;
  onSaved?: () => void;
}

interface Preview {
  fileName: string;
  rows: CostPreviewRow[];
  current: Map<string, number | null>;
  operationId: string;
}

export default function CostImportDialog({ companyId, onClose, onSaved }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reason, setReason] = useState("Carga por Excel");
  const [saveError, setSaveError] = useState<string | null>(null);

  const read = async (file: File) => {
    setReading(true);
    setReadError(null);
    setSaveError(null);
    setPreview(null);
    try {
      const sheet = await readCostWorkbook(await file.arrayBuffer());
      if (sheet.error) {
        setReadError(sheet.error);
        return;
      }
      const matches = await lookupCostCodes(sheet.rows, (codes) => lookupVariantsByCodes(codes, companyId));
      const rows = buildCostPreview(sheet.rows, matches);
      const current = new Map<string, number | null>();
      const ids = rows.filter((row) => row.variantId).map((row) => row.variantId as string);
      try {
        for (const cost of await getVariantCosts(ids)) current.set(cost.variantId, cost.averageCost);
      } catch {
        // Sin el costo actual la vista previa igual sirve.
      }
      setPreview({ fileName: file.name, rows, current, operationId: newOperationId() });
    } catch (error) {
      setReadError(warehouseErrorMessage(error, "No se pudo leer el archivo. Revisa que sea un Excel (.xlsx)."));
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const downloadTemplate = async () => {
    const blob = await buildCostTemplate();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla-costos.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  };

  const items = preview ? costItems(preview.rows) : [];
  const errors = preview ? preview.rows.filter((row) => row.status === "error").length : 0;

  const save = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error("Sin vista previa");
      return setVariantCosts({ items, reason: reason.trim() || undefined, operationId: preview.operationId });
    },
    onSuccess: (result) => {
      if (result.duplicate) toast.info("Esa carga ya estaba registrada: no se cambió nada.");
      else toast.success(`Se cargó el costo de ${result.items.length} ${result.items.length === 1 ? "variante" : "variantes"}`);
      onSaved?.();
      onClose();
    },
    onError: (error) => setSaveError(warehouseErrorMessage(error, "No se pudieron guardar los costos. Inténtalo de nuevo.")),
  });
  const busy = reading || save.isPending;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Cargar costos por Excel</DialogTitle>
          <DialogDescription>
            Para los productos que todavía no tienen costo. Columnas: «SKU de la empresa» y «Costo» (sin IGV, por unidad). Revisa la vista
            previa antes de confirmar; las compras siguientes promedian desde este costo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void downloadTemplate()}>
            <Download className="mr-2 h-4 w-4" />
            Bajar plantilla
          </Button>
          <Label htmlFor="cost-import-file" className="sr-only">
            Archivo de costos
          </Label>
          <Input
            ref={inputRef}
            id="cost-import-file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="max-w-xs"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void read(file);
            }}
          />
          {reading ? (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Revisando el archivo…
            </span>
          ) : null}
        </div>

        {readError ? (
          <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            {readError}
          </p>
        ) : null}

        {preview ? (
          <>
            <p className="flex items-center gap-2 text-sm" role="status">
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              {preview.fileName}: <strong>{items.length}</strong> {items.length === 1 ? "fila se carga" : "filas se cargan"}
              {errors > 0 ? (
                <>
                  {" "}
                  · <strong className="text-destructive">{errors}</strong> con errores (no se cargan)
                </>
              ) : null}
            </p>
            <div className="max-h-80 overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Fila</th>
                    <th className="p-2 text-left">SKU</th>
                    <th className="p-2 text-left">Producto</th>
                    <th className="p-2 text-right">Costo actual</th>
                    <th className="p-2 text-right">Costo nuevo</th>
                    <th className="p-2 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.row} className="border-t" data-testid={`cost-row-${row.row}`}>
                      <td className="p-2 tabular-nums">{row.row}</td>
                      <td className="p-2 font-mono text-xs">{row.code || "—"}</td>
                      <td className="p-2">{row.productName ?? "—"}</td>
                      <td className="p-2 text-right">
                        {row.variantId ? <Money value={preview.current.get(row.variantId) ?? null} decimals={4} /> : "—"}
                      </td>
                      <td className="p-2 text-right">
                        <Money value={row.cost} decimals={4} />
                      </td>
                      <td className={row.status === "ok" ? "p-2 text-teal-700 dark:text-teal-300" : "p-2 text-destructive"}>
                        {row.status === "ok" ? "Se carga" : row.problem}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cost-import-reason">Motivo</Label>
              <Input id="cost-import-reason" maxLength={255} value={reason} disabled={busy} onChange={(e) => setReason(e.target.value)} />
            </div>
          </>
        ) : null}

        {saveError ? (
          <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            {saveError}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={!preview || items.length === 0 || busy} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {items.length > 0 ? `Cargar ${items.length} ${items.length === 1 ? "costo" : "costos"}` : "Cargar costos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
