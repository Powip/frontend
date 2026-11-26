"use client";

import { FileMinus, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MOTIVOS_NC } from "@/app/facturacion/lib/motivos-nota-credito";
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
import { IGV_RATE } from "@/features/sunat/shared/constants/sunat.constants";
import { SUNAT_TAX_AFFECTATION_TYPES } from "@/features/sunat/sunat-document/enums/sunat-document.enums";
import { useCreateSunatDocuments } from "@/features/sunat/sunat-document/hooks/use-create-sunat-documents";
import type { SunatDocument } from "@/features/sunat/sunat-document/models/sunat-document.model";
import type { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";
import {
  AMOUNT_CREDIT_REASON_CODES,
  buildCreditNoteRequest,
  FULL_CREDIT_REASON_CODES,
  getCreditableBalance,
  resolveCreditNoteSeries,
} from "@/features/sunat/sunat-document/utils/build-credit-note-request";
import { roundCurrency } from "@/features/sunat/sunat-document/utils/calculate-sunat-document-totals";
import { getEmissionErrorMessage } from "@/features/sunat/sunat-document/utils/get-emission-error-message";
import { useSunatDocumentSequences } from "@/features/sunat/sunat-document-sequence/hooks/use-sunat-document-sequences";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";
import { findIssuerByRuc } from "@/features/sunat/sunat-profile/utils/issuers";
import { isNuevoRus } from "@/features/sunat/sunat-profile/utils/tax-regime";

interface NotaCreditoModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Ventas con factura/boleta aceptada por SUNAT y saldo por acreditar. */
  aceptados: TaxDocumentRow[];
  /** Todos los documentos SUNAT (para el saldo ya acreditado por otras notas). */
  documents: readonly SunatDocument[];
  /** Perfiles SUNAT (RUC) activos, para usar las series del RUC del comprobante. */
  profiles: SunatProfile[];
  preselectId?: string;
  /** La nota se creó y quedó en cola de envío a SUNAT. */
  onEmitida?: (nota: SunatDocument) => void;
}

type OriginalItem = SunatDocument["taxDocumentPayload"]["items"][number];

const EMPTY_ITEMS: OriginalItem[] = [];

const isGravado = (taxType: string) => taxType === SUNAT_TAX_AFFECTATION_TYPES.GRAVADO;

function getFullNumber(document: SunatDocument): string {
  return `${document.series}-${document.correlative}`;
}

/** Importe con IGV de una línea del comprobante por `quantity` unidades. */
function lineGross(item: OriginalItem, quantity: number): number {
  const ratio = item.quantity > 0 ? quantity / item.quantity : 0;
  const net = quantity * Number(item.unitPrice) - Number(item.discountAmount) * ratio;
  return roundCurrency(isGravado(item.taxType) ? net * (1 + IGV_RATE) : net);
}

export default function NotaCreditoModal({
  isOpen,
  onClose,
  aceptados,
  documents,
  profiles,
  preselectId,
  onEmitida,
}: NotaCreditoModalProps) {
  const [originalId, setOriginalId] = useState(preselectId ?? aceptados[0]?.sale.id ?? "");
  const [motivoCode, setMotivoCode] = useState<string>(MOTIVOS_NC[0].code);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [montoManual, setMontoManual] = useState("");

  const createDocuments = useCreateSunatDocuments();

  const row = useMemo(
    () => aceptados.find((item) => item.sale.id === originalId),
    [aceptados, originalId],
  );
  const original = row?.taxDocument;
  const originalItems = original?.taxDocumentPayload.items ?? EMPTY_ITEMS;
  const motivo = MOTIVOS_NC.find((item) => item.code === motivoCode) ?? MOTIVOS_NC[0];
  const isFull = FULL_CREDIT_REASON_CODES.has(motivo.code);
  const isAmount = AMOUNT_CREDIT_REASON_CODES.has(motivo.code);

  const issuerProfile = findIssuerByRuc(profiles, original?.rucIssuer);
  const { data: sequences = [], isLoading: loadingSequences } = useSunatDocumentSequences(
    issuerProfile?.id,
    { enabled: Boolean(issuerProfile) },
  );
  const series = original
    ? resolveCreditNoteSeries(sequences, original.taxDocumentType)
    : undefined;
  const seriesPrefix = original?.taxDocumentType === "01" ? "F" : "B";
  // Nuevo RUS: the note amends a boleta without IGV, so no amount shows IGV.
  const nuevoRus = isNuevoRus(issuerProfile?.taxRegime);

  const balance = original ? getCreditableBalance(original, documents) : 0;
  const originalTotal = Number(original?.taxDocumentPayload.totals.grandTotal ?? 0);

  useEffect(() => {
    if (!isOpen) return;
    setOriginalId(preselectId ?? aceptados[0]?.sale.id ?? "");
    setMotivoCode(MOTIVOS_NC[0].code);
    setMontoManual("");
  }, [isOpen, preselectId, aceptados]);

  // Total reasons credit every line; partial reasons start with nothing selected.
  useEffect(() => {
    const next: Record<number, number> = {};
    originalItems.forEach((item, index) => {
      next[index] = isFull ? item.quantity : 0;
    });
    setQty(next);
  }, [originalItems, isFull]);

  const total = useMemo(() => {
    if (!original) return 0;
    if (isFull) return originalTotal;
    if (isAmount) return roundCurrency(Number.parseFloat(montoManual) || 0);
    return roundCurrency(
      originalItems.reduce((sum, item, index) => sum + lineGross(item, qty[index] ?? 0), 0),
    );
  }, [original, isFull, isAmount, originalTotal, montoManual, originalItems, qty]);

  const handleEmitir = async () => {
    if (!original || !row) {
      toast.error("Selecciona el comprobante original");
      return;
    }
    if (!series) {
      toast.error(
        `Este RUC no tiene una serie de nota de crédito que empiece con ${seriesPrefix} (p. ej. ${seriesPrefix}C01). Agrégala en Series y Correlativos.`,
      );
      return;
    }
    if (total <= 0) {
      toast.error(
        isAmount ? "Ingresa un monto válido" : "Selecciona al menos un ítem para la nota",
      );
      return;
    }
    if (isFull && balance + 0.01 < originalTotal) {
      toast.error(
        "Este comprobante ya tiene notas de crédito. Usa «Devolución por ítem» o «Descuento global» por el saldo.",
      );
      return;
    }
    if (total > balance + 0.01) {
      toast.error(
        `El monto supera el saldo por acreditar del comprobante (S/ ${balance.toFixed(2)}).`,
      );
      return;
    }

    const request = buildCreditNoteRequest({
      original,
      series,
      reason: { code: motivo.code, description: motivo.label },
      lines: originalItems.map((_, index) => ({ index, quantity: qty[index] ?? 0 })),
      amount: total,
    });

    try {
      const result = await createDocuments.mutateAsync({ documents: [request] });
      const [error] = result.errors;
      const [nota] = result.documents;

      if (error || !nota) {
        toast.error(
          error ? getEmissionErrorMessage(error) : "No se pudo crear la nota de crédito.",
        );
        return;
      }

      toast.success(
        `Nota de crédito ${getFullNumber(nota)} enviada a SUNAT. Podrás imprimirla cuando SUNAT la acepte.`,
      );
      onEmitida?.(nota);
      onClose();
    } catch (error) {
      console.error("Error al emitir la nota de crédito:", error);
      toast.error("No se pudo emitir la nota de crédito. Revisa tu conexión e intenta nuevamente.");
    }
  };

  const emitting = createDocuments.isPending;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !emitting) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileMinus className="h-5 w-5 text-primary" />
            Nueva Nota de Crédito
          </DialogTitle>

          <DialogDescription>
            Elige la factura o boleta aceptada por SUNAT. La nota se envía a SUNAT con el mismo RUC
            del comprobante y queda guardada.
          </DialogDescription>
        </DialogHeader>

        {aceptados.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aún no tienes comprobantes aceptados con saldo por acreditar.
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
                  {aceptados.map((item) =>
                    item.taxDocument ? (
                      <SelectItem key={item.sale.id} value={item.sale.id}>
                        {getFullNumber(item.taxDocument)} —{" "}
                        {item.taxDocument.taxDocumentPayload.customer?.name ??
                          item.sale.customer.fullName}{" "}
                        — S/{" "}
                        {Number(item.taxDocument.taxDocumentPayload.totals.grandTotal).toFixed(2)}
                      </SelectItem>
                    ) : null,
                  )}
                </SelectContent>
              </Select>

              {original && (
                <p className="text-xs text-muted-foreground">
                  RUC emisor {original.rucIssuer} · Saldo por acreditar S/ {balance.toFixed(2)} ·
                  Serie de la nota:{" "}
                  {loadingSequences ? (
                    "…"
                  ) : series ? (
                    <b>{series}</b>
                  ) : (
                    <span className="font-medium text-red-600">
                      falta una serie {seriesPrefix}C01 en Series y Correlativos
                    </span>
                  )}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Motivo (catálogo SUNAT 09)</Label>

              <Select value={motivoCode} onValueChange={setMotivoCode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {MOTIVOS_NC.map((item) => (
                    <SelectItem key={item.code} value={item.code}>
                      {item.code} · {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isAmount ? (
              <div className="grid gap-2">
                <Label>{nuevoRus ? "Monto de la nota" : "Monto de la nota (IGV incluido)"}</Label>

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
                    {originalItems.map((item, index) => {
                      const quantity = qty[index] ?? 0;
                      const selected = quantity > 0;

                      return (
                        // biome-ignore lint/suspicious/noArrayIndexKey: lines of an issued comprobante never reorder; the same SKU can repeat
                        <TableRow key={`${item.sku}-${index}`}>
                          <TableCell>
                            <Checkbox
                              checked={selected}
                              disabled={isFull}
                              aria-label={`Incluir ${item.productName}`}
                              onCheckedChange={(value) =>
                                setQty((previous) => ({
                                  ...previous,
                                  [index]: value ? item.quantity : 0,
                                }))
                              }
                            />
                          </TableCell>

                          <TableCell className="text-xs">{item.productName}</TableCell>

                          <TableCell className="text-xs">{item.quantity}</TableCell>

                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              max={item.quantity}
                              value={quantity}
                              disabled={isFull}
                              aria-label={`Cantidad a notar de ${item.productName}`}
                              onChange={(event) => {
                                const value = Number(event.target.value) || 0;
                                setQty((previous) => ({
                                  ...previous,
                                  [index]: Math.min(Math.max(value, 0), item.quantity),
                                }));
                              }}
                              className="h-8 text-xs"
                            />
                          </TableCell>

                          <TableCell className="text-right text-xs font-medium">
                            S/ {lineGross(item, quantity).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-between rounded-md border bg-muted/30 px-4 py-3 font-bold">
              <span>Monto de la nota</span>
              <span className="text-primary">S/ {total.toFixed(2)}</span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={emitting}>
            Cancelar
          </Button>

          {aceptados.length > 0 && (
            <Button
              onClick={handleEmitir}
              disabled={emitting || loadingSequences}
              className="gap-2 bg-primary text-white hover:bg-primary/90"
            >
              {emitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Emitir Nota de Crédito
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
