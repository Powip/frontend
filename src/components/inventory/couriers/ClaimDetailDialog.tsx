"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatPeruDateTime } from "@/components/inventory/movementLabels";
import { usePdfDownload } from "@/hooks/usePdfDownload";
import {
  CLAIM_ACTION_LABEL,
  CLAIM_STATUS_CLASS,
  CLAIM_STATUS_LABEL,
  claimOriginText,
  courierClaimPdfSpec,
  NEXT_CLAIM_STATUSES,
  providerText,
} from "@/lib/courier";
import { formatDay } from "@/lib/purchaseOrders";
import { opsErrorMessage, whoDid } from "@/lib/warehouseOps";
import { changeCourierClaimStatus, getCourierClaim, type CourierClaim, type CourierClaimStatus } from "@/services/sharedCourierService";
import { ErrorBox, Money, StatusPill } from "../../warehouse-ops/OpsBits";

// FEAT-24 H8-D4 — detalle de un reclamo al courier: sus líneas, el historial de
// estados, el cambio de estado (abierto → aceptado o rechazado; aceptado →
// cobrado o rechazado) y el PDF con el encabezado común. Rechazar no devuelve
// stock: las unidades igual faltan.

export const CLAIM_KEY = "courier-claim";

type NextStatus = Exclude<CourierClaimStatus, "abierto">;

const AMOUNT = /^\d+(\.\d{1,2})?$/;

interface Props {
  claimId: string;
  warehouseName: (inventoryId: string) => string;
  onClose: () => void;
  onChanged: (claim: CourierClaim) => void;
}

export default function ClaimDetailDialog({ claimId, warehouseName, onClose, onChanged }: Props) {
  const queryClient = useQueryClient();
  const downloadPdf = usePdfDownload();
  const key = [CLAIM_KEY, claimId];
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => getCourierClaim(claimId, signal), retry: false });
  const claim = query.data;
  const [next, setNext] = useState<NextStatus | null>(null);
  const [note, setNote] = useState("");
  const [collected, setCollected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const choose = (status: NextStatus) => {
    setNext(status);
    setNote("");
    setError(null);
    setCollected(status === "cobrado" && typeof claim?.totalAmount === "number" ? claim.totalAmount.toFixed(2) : "");
  };

  const collectedProblem = next === "cobrado" && collected.trim() !== "" && !AMOUNT.test(collected.trim()) ? "El monto cobrado lleva hasta 2 decimales (por ejemplo, 64.80)." : null;

  const confirm = async () => {
    if (!claim || !next || busy || collectedProblem) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await changeCourierClaimStatus(claim.id, {
        status: next,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(next === "cobrado" && collected.trim() ? { collectedAmount: Number(collected.trim()) } : {}),
      });
      queryClient.setQueryData(key, saved);
      setNext(null);
      onChanged(saved);
      toast.success(`${claim.number}: ${CLAIM_STATUS_LABEL[saved.status] ?? saved.status}`);
    } catch (failure) {
      setError(opsErrorMessage(failure, "No se pudo cambiar el estado del reclamo."));
    } finally {
      setBusy(false);
    }
  };

  const print = async () => {
    if (!claim) return;
    setPrinting(true);
    try {
      await downloadPdf(courierClaimPdfSpec(claim, { warehouseName: warehouseName(claim.inventoryId) }));
    } catch {
      toast.error("No se pudo generar el PDF del reclamo.");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Reclamo {claim?.number ?? ""}
            {claim ? <StatusPill label={CLAIM_STATUS_LABEL[claim.status] ?? claim.status} className={CLAIM_STATUS_CLASS[claim.status] ?? ""} /> : null}
          </DialogTitle>
          <DialogDescription>Cuenta por cobrar al courier. Se cobra en su liquidación.</DialogDescription>
        </DialogHeader>

        {query.isPending ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
        {query.isError ? <ErrorBox>{opsErrorMessage(query.error, "No se pudo cargar el reclamo.")}</ErrorBox> : null}

        {claim ? (
          <>
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {(
                [
                  ["Courier", providerText(claim.courierProvider)],
                  ["Almacén", warehouseName(claim.inventoryId)],
                  ["Origen", claimOriginText(claim)],
                  ["Fecha", formatDay(claim.createdAt)],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-md border px-3 py-2">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm" aria-label="Líneas del reclamo">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">SKU</th>
                    <th className="px-3 py-2 text-left font-medium">Producto</th>
                    <th className="px-3 py-2 text-right font-medium">Faltan</th>
                    <th className="px-3 py-2 text-right font-medium">Costo unit.</th>
                    <th className="px-3 py-2 text-right font-medium">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {(claim.lines ?? []).map((line) => (
                    <tr key={line.id} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">{line.sku ?? "—"}</td>
                      <td className="px-3 py-2">{line.productName ?? "Producto"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{line.quantity}</td>
                      <td className="px-3 py-2 text-right">
                        <Money value={"unitCost" in line ? (line.unitCost ?? null) : undefined} decimals={4} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Money value={"amount" in line ? (line.amount ?? null) : undefined} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-semibold">
                    <td className="px-3 py-2" colSpan={2}>
                      Total
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{claim.totalUnits}</td>
                    <td />
                    <td className="px-3 py-2 text-right">
                      <Money value={"totalAmount" in claim ? (claim.totalAmount ?? null) : undefined} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {claim.linesWithoutCost > 0 ? <p className="text-xs text-muted-foreground">{claim.linesWithoutCost} línea(s) sin costo: no suman al monto.</p> : null}
            {claim.status === "cobrado" ? (
              <p className="text-sm">
                Cobrado: <Money value={"collectedAmount" in claim ? (claim.collectedAmount ?? null) : undefined} />
              </p>
            ) : null}
            {claim.notes ? <p className="text-sm text-muted-foreground">Notas: {claim.notes}</p> : null}

            <section className="space-y-2" aria-label="Historial del reclamo">
              <h4 className="text-sm font-semibold">Historial</h4>
              <ol className="space-y-1 text-sm">
                <li className="text-muted-foreground">
                  {formatPeruDateTime(claim.createdAt)} · Creado por {whoDid(claim.userName, claim.userEmail)}
                </li>
                {(claim.history ?? []).map((change) => (
                  <li key={change.id}>
                    <span className="text-muted-foreground">{formatPeruDateTime(change.createdAt)} · </span>
                    {change.fromStatus ? `${CLAIM_STATUS_LABEL[change.fromStatus] ?? change.fromStatus} → ` : ""}
                    <b>{CLAIM_STATUS_LABEL[change.toStatus] ?? change.toStatus}</b> por {whoDid(change.userName, change.userEmail)}
                    {change.note ? `: ${change.note}` : ""}
                  </li>
                ))}
              </ol>
            </section>

            {NEXT_CLAIM_STATUSES[claim.status].length > 0 ? (
              <section className="space-y-2 rounded-md border p-3" aria-label="Cambiar estado">
                <div className="flex flex-wrap gap-2">
                  {NEXT_CLAIM_STATUSES[claim.status].map((status) => (
                    <Button key={status} type="button" size="sm" variant={next === status ? "default" : status === "rechazado" ? "outline" : "secondary"} disabled={busy} onClick={() => choose(status)}>
                      {CLAIM_ACTION_LABEL[status]}
                    </Button>
                  ))}
                </div>
                {next ? (
                  <div className="space-y-2">
                    {next === "rechazado" ? <p className="text-xs text-muted-foreground">Rechazar no devuelve el stock: las unidades siguen faltando y se registran como pérdida.</p> : null}
                    {next === "cobrado" ? (
                      <div className="space-y-1">
                        <Label htmlFor="claim-collected">Monto cobrado (S/)</Label>
                        <Input id="claim-collected" inputMode="decimal" className="w-40" value={collected} disabled={busy} onChange={(event) => setCollected(event.target.value)} />
                        <ErrorBox>{collectedProblem}</ErrorBox>
                      </div>
                    ) : null}
                    <div className="space-y-1">
                      <Label htmlFor="claim-note">Nota (opcional)</Label>
                      <Textarea id="claim-note" value={note} maxLength={500} disabled={busy} onChange={(event) => setNote(event.target.value)} />
                    </div>
                    <ErrorBox>{error}</ErrorBox>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" disabled={busy} onClick={() => setNext(null)}>
                        Volver
                      </Button>
                      <Button type="button" variant={next === "rechazado" ? "destructive" : "default"} disabled={busy || !!collectedProblem} onClick={() => void confirm()}>
                        {busy ? "Guardando…" : `Confirmar: ${CLAIM_STATUS_LABEL[next]}`}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}
          </>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={!claim || printing} onClick={() => void print()}>
            <FileDown className="mr-2 h-4 w-4" aria-hidden="true" />
            {printing ? "Generando…" : "Descargar PDF"}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
