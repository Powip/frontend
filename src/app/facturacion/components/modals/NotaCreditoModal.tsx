"use client";

import { FileMinus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { ComprobanteRow } from "@/hooks/useComprobantesSunat";
import type { useFacturacionMock } from "@/hooks/useFacturacionMock";

const MOTIVOS_NC = [
  "Devolución total",
  "Devolución por ítem",
  "Anulación de la operación",
  "Anulación por error en el RUC",
  "Corrección por error en la descripción",
  "Descuento por ítem",
  "Bonificación",
  "Descuento global",
] as const;

const MOTIVOS_TOTAL = new Set<string>([
  "Devolución total",
  "Anulación de la operación",
  "Anulación por error en el RUC",
]);

interface NotaCreditoModalProps {
  isOpen: boolean;
  onClose: () => void;
  aceptados: ComprobanteRow[];
  preselectId?: string;
  crearNota: ReturnType<typeof useFacturacionMock>["crearNota"];
}

export default function NotaCreditoModal({
  isOpen,
  onClose,
  aceptados,
  preselectId,
  crearNota,
}: NotaCreditoModalProps) {
  const defaultOriginalId = preselectId ?? aceptados[0]?.sale.id ?? "";

  const [originalId, setOriginalId] = useState(defaultOriginalId);
  const [motivo, setMotivo] = useState<string>(MOTIVOS_NC[0]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [qty, setQty] = useState<Record<string, number>>({});
  const [montoManual, setMontoManual] = useState("");

  const original = useMemo(
    () => aceptados.find((row) => row.sale.id === originalId),
    [aceptados, originalId],
  );

  const originalItems = original?.sale.items ?? [];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const id = preselectId ?? aceptados[0]?.sale.id ?? "";

    setOriginalId(id);
    setMotivo(MOTIVOS_NC[0]);
    setMontoManual("");
  }, [isOpen, preselectId, aceptados]);

  useEffect(() => {
    if (!original) {
      setChecked({});
      setQty({});
      return;
    }

    const isTotal = MOTIVOS_TOTAL.has(motivo);
    const nextChecked: Record<string, boolean> = {};
    const nextQty: Record<string, number> = {};

    for (const item of originalItems) {
      const itemId = String(item.id);

      nextChecked[itemId] = isTotal;
      nextQty[itemId] = item.quantity;
    }

    setChecked(nextChecked);
    setQty(nextQty);
  }, [original, originalItems, motivo]);

  const isManual = motivo === "Descuento global" || originalItems.length === 0;

  const total = useMemo(() => {
    if (!original) {
      return 0;
    }

    return originalItems.reduce((sum, item) => {
      const itemId = String(item.id);

      if (!checked[itemId]) {
        return sum;
      }

      const quantity = qty[itemId] ?? item.quantity;

      return sum + quantity * Number(item.unitPrice);
    }, 0);
  }, [original, originalItems, checked, qty]);

  const handleCrear = () => {
    if (!original) {
      toast.error("Selecciona el comprobante original");
      return;
    }

    let monto = 0;

    if (isManual) {
      monto = Number.parseFloat(montoManual) || 0;
    } else {
      const anySelected = Object.values(checked).some(Boolean);

      if (!anySelected) {
        toast.error("Selecciona al menos un ítem para la nota");
        return;
      }

      monto = total;
    }

    if (monto <= 0) {
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
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileMinus className="h-5 w-5 text-primary" />
            Nueva Nota de Crédito
          </DialogTitle>

          <DialogDescription>
            Elige a qué factura o boleta corresponde — toda nota queda ligada a un comprobante
            original ya aceptado por SUNAT.
          </DialogDescription>
        </DialogHeader>

        {aceptados.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aún no tienes comprobantes aceptados para notar.
          </p>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Comprobante original</Label>

              <Select value={originalId} onValueChange={setOriginalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un comprobante" />
                </SelectTrigger>

                <SelectContent>
                  {aceptados.map((row) => (
                    <SelectItem key={row.sale.id} value={row.sale.id}>
                      {row.fullNumber} — {row.sale.customer.fullName} — S/{" "}
                      {Number(row.sale.grandTotal).toFixed(2)}
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
                  {MOTIVOS_NC.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isManual ? (
              <div className="grid gap-2">
                <Label>Monto de la nota</Label>

                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={montoManual}
                  onChange={(event) => setMontoManual(event.target.value)}
                  placeholder="Ej. 38.00"
                />
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border">
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
                    {originalItems.map((item) => {
                      const itemId = String(item.id);
                      const selected = !!checked[itemId];
                      const quantity = qty[itemId] ?? item.quantity;

                      return (
                        <TableRow key={itemId}>
                          <TableCell>
                            <Checkbox
                              checked={selected}
                              onCheckedChange={(value) =>
                                setChecked((previous) => ({
                                  ...previous,
                                  [itemId]: !!value,
                                }))
                              }
                            />
                          </TableCell>

                          <TableCell className="text-xs">{item.productName}</TableCell>

                          <TableCell className="text-xs">{item.quantity}</TableCell>

                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              max={item.quantity}
                              value={quantity}
                              disabled={!selected}
                              onChange={(event) => {
                                const nextValue = Number(event.target.value) || 0;

                                setQty((previous) => ({
                                  ...previous,
                                  [itemId]: Math.min(Math.max(nextValue, 0), item.quantity),
                                }));
                              }}
                              className="h-8 text-xs"
                            />
                          </TableCell>

                          <TableCell className="text-right text-xs font-medium">
                            S/ {((selected ? quantity : 0) * Number(item.unitPrice)).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {!isManual && (
              <div className="flex justify-between rounded-md border bg-muted/30 px-4 py-3 font-bold">
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
            <Button onClick={handleCrear} className="bg-primary text-white hover:bg-primary/90">
              Emitir Nota de Crédito
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
