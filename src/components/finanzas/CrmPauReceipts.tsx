"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileText, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function ReceiptCard({ receipt }: { receipt: PaymentReceipt }) {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<ReceiptRejectReason>("no_llego");
  const [note, setNote] = useState("");
  const checks = receipt.pauChecks;
  const review = useMutation({
    mutationFn: (approve: boolean) =>
      reviewReceipt(receipt.id, approve, approve ? undefined : note.trim() || undefined, approve ? undefined : reason),
    onSuccess: (_, approve) => {
      toast.success(approve ? "Pago aceptado. Pau avisa al cliente." : "Comprobante rechazado. Pau avisa al cliente el motivo.");
      void queryClient.invalidateQueries({ queryKey: CRM_PAU_QUEUE_KEY });
    },
    // El CRM explica por qué no se puede (por ejemplo, el chat no tiene tienda).
    onError: (error) =>
      toast.error((error as { response?: { data?: { message?: string } } }).response?.data?.message ?? "No se pudo guardar la revisión."),
  });

  return (
    <li className="rounded-xl border bg-card p-4" data-testid="crm-pau-receipt">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <b>{receipt.pauSale?.customerName ?? "Cliente del chat"}</b>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" aria-hidden /> Validado por Pau
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {receipt.pauSale?.items ?? "Venta del CRM"}
            {receipt.pauSale?.district ? ` · ${receipt.pauSale.district}` : ""}
          </p>
          <p className="text-sm">
            <b>{formatSalesMoney(receipt.amount, "PEN")}</b> · {receipt.methodLabel}
            {receipt.operationNumber ? ` · Op. ${receipt.operationNumber}` : ""}
            {checks?.read.date ? ` · ${checks.read.date}` : ""}
          </p>
        </div>
        {receipt.hasFile && (
          <Button size="sm" variant="outline" onClick={() => void openFile(receipt.id)}>
            <FileText className="mr-1 h-4 w-4" aria-hidden /> Ver comprobante
          </Button>
        )}
      </div>

      {checks && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="1er filtro de Pau">
          {CHECKS.map((key) => (
            <li
              key={key}
              className={
                checks[key]
                  ? "inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-800"
                  : "inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-800"
              }
            >
              {checks[key] ? <Check className="h-3 w-3" aria-hidden /> : <X className="h-3 w-3" aria-hidden />}
              {PAU_CHECK_LABEL[key]}
            </li>
          ))}
        </ul>
      )}

      {!receipt.orderId && receipt.destination !== "simulated" && (
        <p role="alert" className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
          Sin pedido en Powip. {receipt.coreError ?? "Todavía no se creó el pedido de esta venta."}
        </p>
      )}

      {rejecting ? (
        <div className="mt-3 space-y-3 rounded-lg border p-3">
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
        </div>
      ) : (
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setRejecting(true)} disabled={review.isPending}>
            Rechazar
          </Button>
          <Button size="sm" onClick={() => review.mutate(true)} disabled={review.isPending}>
            Aceptar pago
          </Button>
        </div>
      )}
    </li>
  );
}

/**
 * Filtro «CRM · Pau» en Pagos por validar: 2do filtro de las ventas que Pau cerró en el chat.
 * El jefe ve lo que Pau revisó, abre el comprobante y acepta o rechaza con un motivo.
 */
export function CrmPauReceiptsSection({ receipts, loading, error }: { receipts: PaymentReceipt[]; loading: boolean; error: boolean }) {
  if (!loading && !error && receipts.length === 0) return null;
  return (
    <Card className="mb-4" data-testid="crm-pau-receipts">
      <CardHeader>
        <CardTitle className="text-base">CRM · Pau ({receipts.length})</CardTitle>
        <p className="text-sm text-muted-foreground">
          Ventas que Pau cerró en el chat. Pau ya revisó el comprobante; tú das el visto final.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando comprobantes del CRM…</p>
        ) : error ? (
          <p role="alert" className="text-sm text-muted-foreground">
            No se pudieron cargar los comprobantes del CRM.
          </p>
        ) : (
          <ul className="space-y-3">
            {receipts.map((r) => (
              <ReceiptCard key={r.id} receipt={r} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
