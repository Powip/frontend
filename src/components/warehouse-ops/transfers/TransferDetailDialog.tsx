"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/purchaseOrders";
import {
  formatDateTime,
  lineLabel,
  TRANSFER_DECISION_LABEL,
  TRANSFER_STATUS_CLASS,
  TRANSFER_STATUS_LABEL,
  whoDid,
} from "@/lib/warehouseOps";
import type { Transfer } from "@/services/warehouseOpsService";
import { Money, StatusPill } from "../OpsBits";

// FEAT-24 H5-C — detalle de un traslado (mockup mVerTras): enviado, recibido y
// diferencia por línea, con el valor (oculto sin el rol de costos) y quién hizo
// cada paso.

interface Props {
  transfer: Transfer;
  originName: string;
  destinationName: string;
  actions?: ReactNode;
  onClose: () => void;
}

export default function TransferDetailDialog({ transfer, originName, destinationName, actions, onClose }: Props) {
  const steps = [
    { label: "Armado", at: transfer.createdAt, by: whoDid(transfer.userName, transfer.userEmail) },
    transfer.dispatchedAt ? { label: "Despachado", at: transfer.dispatchedAt, by: whoDid(transfer.dispatchedByName, transfer.dispatchedByEmail) } : null,
    transfer.receivedAt ? { label: "Recibido", at: transfer.receivedAt, by: whoDid(transfer.receivedByName, transfer.receivedByEmail) } : null,
    transfer.cancelledAt ? { label: "Anulado", at: transfer.cancelledAt, by: whoDid(transfer.cancelledByName, transfer.cancelledByEmail) } : null,
  ].filter((step): step is { label: string; at: string; by: string } => step !== null);

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {transfer.number}
            <StatusPill label={TRANSFER_STATUS_LABEL[transfer.status] ?? transfer.status} className={TRANSFER_STATUS_CLASS[transfer.status] ?? ""} />
          </DialogTitle>
          <DialogDescription>
            {originName} → {destinationName}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Producto</th>
                <th className="px-3 py-2 text-right font-medium">Enviado</th>
                <th className="px-3 py-2 text-right font-medium">Recibido</th>
                <th className="px-3 py-2 text-right font-medium">Diferencia</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
                <th className="px-3 py-2 text-left font-medium">Decisión</th>
              </tr>
            </thead>
            <tbody>
              {transfer.lines.map((line) => (
                <tr key={line.id} className="border-t">
                  <td className="px-3 py-2">
                    <p>{lineLabel(line)}</p>
                    <p className="font-mono text-xs text-muted-foreground">{line.sku}</p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{line.quantitySent}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{line.quantityReceived ?? "—"}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${line.difference && line.difference < 0 ? "text-destructive" : ""}`}>
                    {line.difference === null || line.difference === undefined ? "—" : line.difference > 0 ? `+${line.difference}` : line.difference}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={"value" in line ? line.value : undefined} />
                  </td>
                  <td className="px-3 py-2 text-xs">{line.differenceDecision ? (TRANSFER_DECISION_LABEL[line.differenceDecision] ?? line.differenceDecision) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Guía de remisión:</dt>
            <dd className="font-mono">{transfer.remissionGuide || "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Flete:</dt>
            <dd>{transfer.freight ? formatMoney(Number(transfer.freight)) : "—"}</dd>
          </div>
          {transfer.notes ? (
            <div className="flex gap-2 sm:col-span-2">
              <dt className="text-muted-foreground">Nota:</dt>
              <dd>{transfer.notes}</dd>
            </div>
          ) : null}
          {transfer.cancelReason ? (
            <div className="flex gap-2 sm:col-span-2">
              <dt className="text-muted-foreground">Motivo de la anulación:</dt>
              <dd>{transfer.cancelReason}</dd>
            </div>
          ) : null}
        </dl>

        <ol className="space-y-1 text-xs text-muted-foreground">
          {steps.map((step) => (
            <li key={step.label}>
              <span className="font-medium text-foreground">{step.label}</span> · {formatDateTime(step.at)} · {step.by}
            </li>
          ))}
        </ol>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {actions}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
