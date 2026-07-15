"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Zap } from "lucide-react";
import { IManualInvoicePayload } from "@/api/Facturacion";
import { ComprobanteRow } from "@/hooks/useComprobantesSunat";

interface LoteEmisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  rows: ComprobanteRow[];
  emitInvoice: (payload: IManualInvoicePayload) => Promise<any>;
  onDone: () => void;
}

interface LoteResult {
  orderNumber: string;
  ok: boolean;
  message: string;
}

export default function LoteEmisionModal({ isOpen, onClose, rows, emitInvoice, onDone }: LoteEmisionModalProps) {
  const [tipo, setTipo] = useState<"01" | "03">("03");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<LoteResult[] | null>(null);

  const buildPayload = (row: ComprobanteRow): IManualInvoicePayload | null => {
    const { sale } = row;
    const docNumber = (sale.customer.documentNumber || "").trim();
    if (tipo === "01" && !/^(10|20)\d{9}$/.test(docNumber)) return null;
    if (tipo === "03" && docNumber.length !== 8 && docNumber.length !== 11) return null;

    const total = Number(sale.grandTotal) || 0;
    return {
      externalId: String(sale.id),
      documentType: tipo,
      customerName: sale.customer.fullName,
      customerDocType: tipo === "01" ? "6" : docNumber.length === 11 ? "6" : "1",
      customerDocNumber: docNumber,
      customerAddress: sale.customer.address || undefined,
      totalTax: Number(((total * 0.18) / 1.18).toFixed(2)),
      totalValue: Number((total / 1.18).toFixed(2)),
      totalPrice: Number(total.toFixed(2)),
      items: (sale.items || []).map((it) => ({
        internalCode: String(it.sku || "PROD001"),
        description: it.productName,
        quantity: it.quantity,
        unitPrice: Number(it.price),
        unitCode: "NIU",
        taxType: "10",
      })),
    };
  };

  const runLote = async () => {
    setRunning(true);
    const acc: LoteResult[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const payload = buildPayload(row);
      if (!payload) {
        acc.push({
          orderNumber: row.sale.orderNumber,
          ok: false,
          message: "Documento del cliente no coincide con el tipo de comprobante elegido",
        });
      } else {
        try {
          const res = await emitInvoice(payload);
          acc.push({
            orderNumber: row.sale.orderNumber,
            ok: !!res.success,
            message: res.success
              ? `Comprobante ${res.data?.series}-${res.data?.correlative} generado`
              : res.message || "Error al emitir",
          });
        } catch (error: any) {
          acc.push({
            orderNumber: row.sale.orderNumber,
            ok: false,
            message: error.response?.data?.message || "Error de conexión",
          });
        }
      }
      setProgress(Math.round(((i + 1) / rows.length) * 100));
      setResults([...acc]);
    }
    setRunning(false);
    onDone();
  };

  const handleClose = () => {
    setResults(null);
    setProgress(0);
    setRunning(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Zap className="h-5 w-5 text-primary" />
            Emitir en Lote
          </DialogTitle>
          <DialogDescription>
            {rows.length} comprobante(s) seleccionados — se emitirán con el mismo tipo de documento.
          </DialogDescription>
        </DialogHeader>

        {!results && (
          <div className="grid gap-2">
            <Label>Tipo de comprobante para todos</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as "01" | "03")} disabled={running}>
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
            <div className="text-center text-sm text-muted-foreground mt-2">{progress}%</div>
          </div>
        )}

        {results && (
          <div className="max-h-64 overflow-y-auto divide-y rounded-md border text-sm">
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 gap-2">
                <span className="font-medium">{r.orderNumber}</span>
                <span className={r.ok ? "text-green-600" : "text-red-600"}>{r.message}</span>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={running}>
            {results ? "Cerrar" : "Cancelar"}
          </Button>
          {!results && (
            <Button onClick={runLote} disabled={running} className="bg-primary hover:bg-primary/90 text-white">
              Emitir {rows.length} comprobantes
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
