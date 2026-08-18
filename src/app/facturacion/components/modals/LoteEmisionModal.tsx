"use client";

import { Zap } from "lucide-react";
import { useState } from "react";

import {
  CURRENCIES,
  DOCUMENT_TYPES,
  IDENTITY_DOCUMENT_TYPES,
  TAX_TYPES,
  UNIT_CODES,
} from "@/api/sunat/types/sunat-document.types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateManualInvoice } from "@/hooks/sunat/sunat-document/use-create-manual-invoice";
import type { TaxDocumentRow } from "@/hooks/useTaxDocuments";
import type { CreateManualInvoiceInput } from "@/schemas/sunat/create-manual-invoice.schema";

interface LoteEmisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  rows: TaxDocumentRow[];
  onDone: () => void;
}

interface LoteResult {
  orderNumber: string;
  ok: boolean;
  message: string;
}

export default function LoteEmisionModal({ isOpen, onClose, rows, onDone }: LoteEmisionModalProps) {
  const { mutateAsync: createInvoice } = useCreateManualInvoice();

  const [tipo, setTipo] = useState<"01" | "03">("03");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<LoteResult[] | null>(null);

  const buildPayload = (row: TaxDocumentRow): CreateManualInvoiceInput => {
    const { sale } = row;

    const docNumber = sale.customer.documentNumber ?? "";

    const isFactura = tipo === "01";

    const total = Number(sale.grandTotal) || 0;

    return {
      externalId: String(sale.id),

      documentType: isFactura ? DOCUMENT_TYPES.FACTURA : DOCUMENT_TYPES.BOLETA,

      customer: {
        name: sale.customer.fullName,

        documentType: isFactura ? IDENTITY_DOCUMENT_TYPES.RUC : IDENTITY_DOCUMENT_TYPES.DNI,

        documentNumber: docNumber,

        address: sale.customer.address ?? "",
      },

      totals: {
        totalTax: Number(((total * 0.18) / 1.18).toFixed(2)),
        totalValue: Number((total / 1.18).toFixed(2)),
        totalPrice: Number(total.toFixed(2)),
        currency: CURRENCIES.PEN,
      },

      items: sale.items.map((item) => ({
        internalCode: item.sku ?? "PROD001",
        description: item.productName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        unitCode: UNIT_CODES.UNIT,
        taxType: TAX_TYPES.GRAVADO,
      })),
    };
  };

  const runLote = async () => {
    if (rows.length === 0) {
      return;
    }

    setRunning(true);
    setProgress(0);
    setResults(null);

    const accumulatedResults: LoteResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        const payload = buildPayload(row);
        const response = await createInvoice(payload);

        accumulatedResults.push({
          orderNumber: row.sale.orderNumber,
          ok: Boolean(response.success),
          message: response.success
            ? `Comprobante ${response.data?.series}-${response.data?.correlative} generado`
            : response.message || "Error al emitir",
        });
      } catch (error: unknown) {
        const responseData =
          error &&
          typeof error === "object" &&
          "response" in error &&
          error.response &&
          typeof error.response === "object" &&
          "data" in error.response
            ? error.response.data
            : null;

        const message =
          responseData &&
          typeof responseData === "object" &&
          "message" in responseData &&
          typeof responseData.message === "string"
            ? responseData.message
            : "Error de conexión";

        accumulatedResults.push({
          orderNumber: row.sale.orderNumber,
          ok: false,
          message,
        });
      }

      const currentProgress = Math.round(((i + 1) / rows.length) * 100);

      setProgress(currentProgress);
      setResults([...accumulatedResults]);
    }

    setRunning(false);
    onDone();
  };

  const handleClose = () => {
    if (running) {
      return;
    }

    setResults(null);
    setProgress(0);
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Zap className="h-5 w-5 text-primary" />
            Emitir en Lote
          </DialogTitle>

          <DialogDescription>
            {rows.length} comprobante{rows.length === 1 ? "" : "s"} seleccionado
            {rows.length === 1 ? "" : "s"} — se emitirán con el mismo tipo de documento.
          </DialogDescription>
        </DialogHeader>

        {!results && (
          <div className="grid gap-2">
            <Label>Tipo de comprobante para todos</Label>

            <Select
              value={tipo}
              onValueChange={(value) => setTipo(value as "01" | "03")}
              disabled={running}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="03">Boleta de Venta (B001)</SelectItem>
                <SelectItem value="01">Factura (F001)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {running && (
          <div className="my-2">
            <Progress value={progress} />

            <div className="mt-2 text-center text-sm text-muted-foreground">{progress}%</div>
          </div>
        )}

        {results && (
          <div className="max-h-64 divide-y overflow-y-auto rounded-md border text-sm">
            {results.map((result) => (
              <div
                key={result.orderNumber}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <span className="font-medium">{result.orderNumber}</span>

                <span className={result.ok ? "text-green-600" : "text-red-600"}>
                  {result.message}
                </span>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={running}>
            {results ? "Cerrar" : "Cancelar"}
          </Button>

          {!results && (
            <Button
              onClick={runLote}
              disabled={running || rows.length === 0}
              className="bg-primary text-white hover:bg-primary/90"
            >
              Emitir {rows.length} comprobante{rows.length === 1 ? "" : "s"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
