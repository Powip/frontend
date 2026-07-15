"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileMinus } from "lucide-react";
import { toast } from "sonner";
import { ComprobanteRow } from "@/hooks/useComprobantesSunat";
import { useFacturacionMock } from "@/hooks/useFacturacionMock";

const MOTIVOS_NC = [
  "Devolución total",
  "Devolución por ítem",
  "Anulación de la operación",
  "Anulación por error en el RUC",
  "Corrección por error en la descripción",
  "Descuento por ítem",
  "Bonificación",
  "Descuento global",
];

const MOTIVOS_TOTAL = new Set(["Devolución total", "Anulación de la operación", "Anulación por error en el RUC"]);

interface NotaCreditoModalProps {
  isOpen: boolean;
  onClose: () => void;
  aceptados: ComprobanteRow[];
  preselectId?: string;
  crearNota: ReturnType<typeof useFacturacionMock>["crearNota"];
}

export default function NotaCreditoModal({ isOpen, onClose, aceptados, preselectId, crearNota }: NotaCreditoModalProps) {
  const [originalId, setOriginalId] = useState(preselectId || aceptados[0]?.sale.id || "");
  const [motivo, setMotivo] = useState(MOTIVOS_NC[0]);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [qty, setQty] = useState<Record<number, number>>({});
  const [montoManual, setMontoManual] = useState("");

  const original = aceptados.find((r) => r.sale.id === originalId);

  useEffect(() => {
    if (!isOpen) return;
    const id = preselectId || aceptados[0]?.sale.id || "";
    setOriginalId(id);
    setMotivo(MOTIVOS_NC[0]);
    setMontoManual("");
  }, [isOpen, preselectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!original) return;
    const isTotal = MOTIVOS_TOTAL.has(motivo);
    const nextChecked: Record<number, boolean> = {};
    const nextQty: Record<number, number> = {};
    (original.sale.items || []).forEach((it, i) => {
      nextChecked[i] = isTotal;
      nextQty[i] = it.quantity;
    });
    setChecked(nextChecked);
    setQty(nextQty);
  }, [originalId, motivo]); // eslint-disable-line react-hooks/exhaustive-deps

  const isManual = motivo === "Descuento global" || !original?.sale.items?.length;

  const total = useMemo(() => {
    if (!original) return 0;
    return (original.sale.items || []).reduce((s, it, i) => (checked[i] ? s + (qty[i] ?? it.quantity) * Number(it.price) : s), 0);
  }, [original, checked, qty]);

  const handleCrear = () => {
    if (!original) {
      toast.error("Selecciona el comprobante original");
      return;
    }
    let monto = 0;
    if (isManual) {
      monto = parseFloat(montoManual) || 0;
    } else {
      const anySelected = Object.values(checked).some(Boolean);
      if (!anySelected) {
        toast.error("Selecciona al menos un ítem para la nota");
        return;
      }
      monto = total;
    }
    if (!monto) {
      toast.error("Ingresa o calcula un monto válido");
      return;
    }
    crearNota({
      original: original.fullNumber || original.sale.orderNumber,
      tipoOriginal: original.tipo === "01" ? "01" : "03",
      cliente: original.sale.customer.fullName,
      motivo,
      monto,
    });
    toast.success("Nota de crédito registrada (vista previa — aún no enviada a SUNAT).");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileMinus className="h-5 w-5 text-primary" />
            Nueva Nota de Crédito
          </DialogTitle>
          <DialogDescription>
            Elige a qué factura o boleta corresponde — toda nota queda ligada a un comprobante original ya aceptado por SUNAT.
          </DialogDescription>
        </DialogHeader>

        {aceptados.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Aún no tienes comprobantes aceptados para notar.
          </p>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Comprobante original</Label>
              <Select value={originalId} onValueChange={setOriginalId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {aceptados.map((r) => (
                    <SelectItem key={r.sale.id} value={r.sale.id}>
                      {r.fullNumber} — {r.sale.customer.fullName} — S/ {Number(r.sale.grandTotal).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Motivo (catálogo SUNAT 09)</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS_NC.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isManual ? (
              <div className="grid gap-2">
                <Label>Monto de la nota</Label>
                <Input type="number" step="0.01" value={montoManual} onChange={(e) => setMontoManual(e.target.value)} placeholder="Ej. 38.00" />
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Descripción</TableHead>
                      <TableHead className="w-20">Cant. orig.</TableHead>
                      <TableHead className="w-24">Cant. a notar</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(original?.sale.items || []).map((it, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Checkbox
                            checked={!!checked[i]}
                            onCheckedChange={(v) => setChecked((prev) => ({ ...prev, [i]: !!v }))}
                          />
                        </TableCell>
                        <TableCell className="text-xs">{it.productName}</TableCell>
                        <TableCell className="text-xs">{it.quantity}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            max={it.quantity}
                            value={qty[i] ?? it.quantity}
                            onChange={(e) => setQty((prev) => ({ ...prev, [i]: Number(e.target.value) || 0 }))}
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium">
                          S/ {((checked[i] ? qty[i] ?? it.quantity : 0) * Number(it.price)).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {!isManual && (
              <div className="rounded-md border bg-muted/30 px-4 py-3 flex justify-between font-bold">
                <span>Monto de la nota</span>
                <span className="text-primary">S/ {total.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          {aceptados.length > 0 && (
            <Button onClick={handleCrear} className="bg-primary hover:bg-primary/90 text-white">
              Emitir Nota de Crédito
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
