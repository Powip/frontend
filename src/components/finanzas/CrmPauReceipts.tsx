"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getReceiptFile, listFinanceQueue, reviewReceipt } from "@/services/crmOrderPanelService";
import {
  PAU_CHECK_LABEL,
  RECEIPT_REJECT_REASONS,
  type PauReceiptCheck,
  type PaymentReceipt,
  type ReceiptRejectReason,
} from "@/types/crmOrderPanel";
import { formatSalesMoney } from "@/utils/salesMoney";

export const CRM_PAU_QUEUE_KEY = ["crm", "finance-queue", "pau"] as const;

const CHECKS: PauReceiptCheck[] = ["isReceipt", "amountMatch", "dateRecent", "destinationOk", "operationUnique"];

/** Ventas del CRM que Pau cerró y cuyo comprobante pasó su 1er filtro. */
export function useCrmPauReceipts(enabled: boolean) {
  return useQuery({
    queryKey: CRM_PAU_QUEUE_KEY,
    queryFn: () => listFinanceQueue("porval", "pau"),
    enabled,
    retry: false,
    staleTime: 15_000,
  });
}

async function openFile(id: string) {
  try {
    const blob = await getReceiptFile(id);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    toast.error("No se pudo abrir el comprobante.");
  }
}

/** Detalle del 1er filtro de Pau, dentro de la celda del monto (como el detalle Yape de Live). */
export function CrmPauDetail({ receipt }: { receipt: PaymentReceipt }) {
  const checks = receipt.pauChecks;
  const failed = checks ? CHECKS.filter((key) => !checks[key]) : [];
  return (
    <div className="mt-1 space-y-1 text-xs font-normal text-foreground" data-testid="crm-pau-detail">
      <Badge variant="secondary" className="gap-1">
        <Sparkles className="h-3 w-3" aria-hidden /> Validado por Pau
      </Badge>
      <p>
        {formatSalesMoney(receipt.amount, "PEN")} · {receipt.methodLabel}
        {receipt.operationNumber ? ` · Op. ${receipt.operationNumber}` : ""}
        {checks?.read.date ? ` · ${checks.read.date}` : ""}
      </p>
      {checks && (
        <p className="text-muted-foreground" title={CHECKS.map((key) => `${checks[key] ? "✓" : "✗"} ${PAU_CHECK_LABEL[key]}`).join("\n")}>
          {CHECKS.length - failed.length} de {CHECKS.length} controles de Pau
        </p>
      )}
      {failed.map((key) => (
        <p key={key} className="rounded-full bg-red-50 px-2 py-0.5 text-red-800">
          Falla: {PAU_CHECK_LABEL[key]}
        </p>
      ))}
      {!receipt.orderId && receipt.destination !== "simulated" && (
        <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-900">
          Sin pedido en Powip. {receipt.coreError ?? "Todavía no se creó el pedido de esta venta."}
        </p>
      )}
    </div>
  );
}

/** 2do filtro: el jefe abre el comprobante y acepta, o rechaza con un motivo que Pau avisa. */
export function CrmPauActions({ receipt, onReviewed }: { receipt: PaymentReceipt; onReviewed: () => void }) {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<ReceiptRejectReason>("no_llego");
  const [note, setNote] = useState("");
  const review = useMutation({
    mutationFn: (approve: boolean) =>
      reviewReceipt(receipt.id, approve, approve ? undefined : note.trim() || undefined, approve ? undefined : reason),
    onSuccess: (_, approve) => {
      toast.success(approve ? "Pago aceptado. Pau avisa al cliente." : "Comprobante rechazado. Pau avisa al cliente el motivo.");
      setRejecting(false);
      void queryClient.invalidateQueries({ queryKey: CRM_PAU_QUEUE_KEY });
      onReviewed();
    },
    // El CRM explica por qué no se puede (por ejemplo, el chat no tiene tienda).
    onError: (error) =>
      toast.error((error as { response?: { data?: { message?: string } } }).response?.data?.message ?? "No se pudo guardar la revisión."),
  });

  return (
    <>
      {receipt.hasFile && (
        <Button size="icon" variant="outline" title="Ver comprobante" aria-label="Ver comprobante" onClick={() => void openFile(receipt.id)}>
          <FileText className="h-4 w-4" aria-hidden />
        </Button>
      )}
      <Button size="sm" onClick={() => review.mutate(true)} disabled={review.isPending}>
        Aceptar pago
      </Button>
      <Button size="sm" variant="outline" onClick={() => setRejecting(true)} disabled={review.isPending}>
        Rechazar
      </Button>
      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar comprobante</DialogTitle>
            <DialogDescription>
              {receipt.pauSale?.customerName ?? "Cliente del chat"} · {formatSalesMoney(receipt.amount, "PEN")}. Pau avisa el motivo al cliente.
            </DialogDescription>
          </DialogHeader>
          <div role="radiogroup" aria-label="Motivo del rechazo" className="flex flex-wrap gap-2">
            {RECEIPT_REJECT_REASONS.map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                role="radio"
                aria-checked={reason === value}
                variant={reason === value ? "default" : "outline"}
                onClick={() => setReason(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`nota-${receipt.id}`}>Nota para el cliente (opcional)</Label>
            <Textarea id={`nota-${receipt.id}`} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setRejecting(false)} disabled={review.isPending}>
              Cancelar
            </Button>
            <Button size="sm" variant="destructive" onClick={() => review.mutate(false)} disabled={review.isPending}>
              Rechazar y avisar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
