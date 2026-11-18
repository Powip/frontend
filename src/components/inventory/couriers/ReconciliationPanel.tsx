"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatPeruDateTime } from "@/components/inventory/movementLabels";
import { useOperationKeys } from "@/hooks/useOperationKeys";
import {
  canCancelReconciliation,
  claimableUnits,
  CLAIM_STATUS_CLASS,
  CLAIM_STATUS_LABEL,
  closeNeedsNote,
  explanationText,
  RECONCILIATION_STATUS_CLASS,
  RECONCILIATION_STATUS_LABEL,
  reconciliationSourceText,
  signed,
  squareActions,
} from "@/lib/courier";
import { formatMoney } from "@/lib/purchaseOrders";
import { lineLabel, opsErrorMessage, whoDid } from "@/lib/warehouseOps";
import {
  cancelReconciliation,
  closeReconciliation,
  getReconciliation,
  recalculateReconciliation,
  type ClaimReconciliationResult,
  type CourierReconciliation,
  type ReconciliationLine,
} from "@/services/sharedCourierService";
import { ErrorBox, Money, ReasonDialog, StatusPill } from "../../warehouse-ops/OpsBits";
import ClaimFromReconciliationDialog from "./ClaimFromReconciliationDialog";
import ExplanationsDialog from "./ExplanationsDialog";

// FEAT-24 H8-D3 — una conciliación de unidades con el courier (mockup vCourier):
// POWIP contra lo que reporta el courier, cada diferencia explicada por partes
// (traslados en camino, devoluciones por recibir, mermas por aprobar, y lo que
// el operador explica a mano), los enlaces a las pantallas que la cuadran y el
// reclamo de lo que queda sin explicar. Se cierra con nota o se anula.
//
// Modos: `manage` (Administrador y Operaciones), `view` (Almacén: solo mira, sin
// montos) y `portal` (el courier en /almacen: solo mira, sin montos ni reclamos).

export type ReconciliationMode = "manage" | "view" | "portal";

export const RECONCILIATION_KEY = "courier-reconciliation";

interface Props {
  reconciliationId: string;
  mode: ReconciliationMode;
  warehouseName: string;
  /** Cambió la conciliación (recalcular, explicar, reclamar, cerrar, anular). */
  onChanged?: () => void;
  /** Se creó un reclamo (para refrescar la lista de reclamos). */
  onClaimed?: (result: ClaimReconciliationResult) => void;
  onOpenClaim?: (claimId: string) => void;
}

export default function ReconciliationPanel({ reconciliationId, mode, warehouseName, onChanged, onClaimed, onOpenClaim }: Props) {
  const queryClient = useQueryClient();
  const keys = useOperationKeys();
  const key = [RECONCILIATION_KEY, reconciliationId];
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => getReconciliation(reconciliationId, signal), retry: false });
  const rec = query.data;
  const [busy, setBusy] = useState<"recalc" | "refresh" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [explaining, setExplaining] = useState<ReconciliationLine | null>(null);
  const [claiming, setClaiming] = useState<{ line: ReconciliationLine | null } | null>(null);
  const [closing, setClosing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const manage = mode === "manage";
  const portal = mode === "portal";

  const apply = (saved: CourierReconciliation) => {
    queryClient.setQueryData(key, saved);
    onChanged?.();
  };

  const recalc = async (refreshCourier: boolean) => {
    if (!rec || busy) return;
    setBusy(refreshCourier ? "refresh" : "recalc");
    setActionError(null);
    try {
      apply(await recalculateReconciliation(rec.id, refreshCourier ? { refreshCourier: true } : {}));
      toast.success(refreshCourier ? "Volvimos a leer Aliclik" : "Conciliación recalculada");
    } catch (failure) {
      setActionError(opsErrorMessage(failure, "No se pudo recalcular la conciliación."));
    } finally {
      setBusy(null);
    }
  };

  if (query.isPending) return <p className="text-sm text-muted-foreground">Cargando conciliación…</p>;
  if (query.isError || !rec) return <ErrorBox>{opsErrorMessage(query.error, "No se pudo cargar la conciliación.")}</ErrorBox>;

  const open = rec.status === "abierta";
  const lines = rec.lines ?? [];
  const summary = rec.summary;

  return (
    <section className="space-y-3 rounded-md border p-4" aria-label={`Conciliación ${rec.number}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold">
            <span className="font-mono">{rec.number}</span>
            <StatusPill label={RECONCILIATION_STATUS_LABEL[rec.status] ?? rec.status} className={RECONCILIATION_STATUS_CLASS[rec.status] ?? ""} />
            {summary.balanced ? <StatusPill label="Cuadra" className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" /> : null}
          </h3>
          <p className="text-xs text-muted-foreground">
            {reconciliationSourceText(rec)} · creada el {formatPeruDateTime(rec.createdAt)}
            {rec.userName || rec.userEmail ? ` por ${whoDid(rec.userName, rec.userEmail)}` : ""}
            {rec.courierReportedAt ? ` · el courier reportó el ${formatPeruDateTime(rec.courierReportedAt)}` : ""}
            {rec.recalculatedAt ? ` · recalculada el ${formatPeruDateTime(rec.recalculatedAt)}` : ""}
          </p>
          {rec.status === "cerrada" ? (
            <p className="text-sm">
              Cerrada el {rec.closedAt ? formatPeruDateTime(rec.closedAt) : "—"} por {whoDid(rec.closedByName, rec.closedByEmail)}
              {rec.closeNote ? `: ${rec.closeNote}` : "."}
            </p>
          ) : null}
          {rec.status === "anulada" ? <p className="text-sm">Anulada{rec.cancelReason ? `: ${rec.cancelReason}` : "."}</p> : null}
        </div>
        {manage && open ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={() => void recalc(false)}>
              <RefreshCw className={`mr-2 h-4 w-4 ${busy === "recalc" ? "animate-spin" : ""}`} aria-hidden="true" />
              Recalcular
            </Button>
            {rec.source === "api" ? (
              <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={() => void recalc(true)}>
                <RefreshCw className={`mr-2 h-4 w-4 ${busy === "refresh" ? "animate-spin" : ""}`} aria-hidden="true" />
                Releer Aliclik
              </Button>
            ) : null}
            {summary.shortageUnits > 0 ? (
              <Button type="button" size="sm" variant="destructive" disabled={!!busy} onClick={() => setClaiming({ line: null })}>
                Reclamar todo lo sin explicar
              </Button>
            ) : null}
            <Button type="button" size="sm" disabled={!!busy} onClick={() => setClosing(true)}>
              Cerrar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!!busy || !canCancelReconciliation(rec)}
              title={canCancelReconciliation(rec) ? undefined : "Tiene reclamos: ya no se puede anular."}
              onClick={() => setCancelling(true)}
            >
              Anular
            </Button>
          </div>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Resumen de la conciliación">
        {(
          [
            ["Con diferencia", `${summary.withDifference} de ${summary.lines}`],
            ["Sin explicar", `${summary.unexplainedLines} SKU`],
            ["Faltan", `${summary.shortageUnits} und`],
            ["Sobran", `${summary.surplusUnits} und`],
            // El courier no ve los reclamos que se le hacen (H8-D5).
            ...(portal ? [] : [["Reclamado", `${summary.claimedUnits} und`]]),
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-md border px-3 py-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {portal ? null : (
        <p className="text-sm">
          Faltante sin explicar valorizado: <Money value={"shortageValue" in summary ? (summary.shortageValue ?? null) : undefined} />
          {summary.shortageWithoutCost > 0 ? <span className="text-xs text-muted-foreground"> ({summary.shortageWithoutCost} und sin costo)</span> : null}
        </p>
      )}

      <ErrorBox>{actionError}</ErrorBox>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm" aria-label="Líneas de la conciliación">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Producto</th>
              <th className="px-3 py-2 text-right font-medium">POWIP</th>
              <th className="px-3 py-2 text-right font-medium">Courier</th>
              <th className="px-3 py-2 text-right font-medium">Diferencia</th>
              <th className="px-3 py-2 text-left font-medium">A qué se debe</th>
              {portal ? null : <th className="px-3 py-2 text-right font-medium">Sin explicar</th>}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={portal ? 6 : 7} className="px-3 py-6 text-center text-muted-foreground">
                  Ni POWIP ni el courier tienen stock en este almacén.
                </td>
              </tr>
            ) : (
              lines.map((line) => {
                const claimable = claimableUnits(line);
                const actions = squareActions(line, { portal });
                return (
                  <tr key={line.id} className="border-t align-top" data-testid={`line-${line.sku ?? line.variantId}`}>
                    <td className="px-3 py-2">
                      {lineLabel(line)}
                      {line.sku ? <span className="block font-mono text-xs text-muted-foreground">{line.sku}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{line.powip}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{line.courier}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {line.difference === 0 ? <span className="text-emerald-700 dark:text-emerald-300">0</span> : <b className={line.difference > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"}>{signed(line.difference)}</b>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {line.explanations.map((explanation) => (
                          <StatusPill
                            key={explanation.id}
                            label={explanationText(explanation)}
                            className={explanation.source === "auto" ? "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"}
                          />
                        ))}
                        {line.unexplained !== 0 ? <StatusPill label={`${signed(line.unexplained)} sin explicar`} className="bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200" /> : null}
                        {!portal && line.claimedQuantity > 0 ? <StatusPill label={`${line.claimedQuantity} reclamado`} className="bg-muted text-muted-foreground" /> : null}
                        {line.difference === 0 ? (
                          <StatusPill label="Cuadra" className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" />
                        ) : null}
                      </div>
                    </td>
                    {portal ? null : (
                      <td className="px-3 py-2 text-right">
                        {line.unexplained < 0 ? <Money value={"unexplainedValue" in line ? (line.unexplainedValue ?? null) : undefined} className="font-semibold text-destructive" /> : "—"}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {open && (manage || portal)
                          ? actions.map((action) => (
                              <Button key={action.key} asChild size="sm" variant="outline">
                                <Link href={action.href}>{action.label}</Link>
                              </Button>
                            ))
                          : null}
                        {manage && open && line.difference < 0 ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => setExplaining(line)}>
                            Explicar
                          </Button>
                        ) : null}
                        {manage && open && claimable > 0 ? (
                          <Button type="button" size="sm" variant="destructive" onClick={() => setClaiming({ line })}>
                            Reclamar
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!portal && (rec.claims ?? []).length > 0 ? (
        <div className="space-y-1">
          <p className="text-sm font-medium">Reclamos de esta conciliación</p>
          <ul className="flex flex-wrap gap-2">
            {(rec.claims ?? []).map((claim) => (
              <li key={claim.id}>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm hover:bg-muted/50 disabled:cursor-default"
                  disabled={!onOpenClaim}
                  onClick={() => onOpenClaim?.(claim.id)}
                >
                  <span className="font-mono">{claim.number}</span>
                  <StatusPill label={CLAIM_STATUS_LABEL[claim.status] ?? claim.status} className={CLAIM_STATUS_CLASS[claim.status] ?? ""} />
                  <span className="tabular-nums">{claim.totalUnits} und</span>
                  <span className="tabular-nums">{formatMoney("totalAmount" in claim ? (claim.totalAmount ?? null) : undefined)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {explaining ? (
        <ExplanationsDialog
          reconciliation={rec}
          line={explaining}
          onClose={() => setExplaining(null)}
          onSaved={(saved) => {
            setExplaining(null);
            apply(saved);
            toast.success("Explicaciones guardadas");
          }}
        />
      ) : null}

      {claiming ? (
        <ClaimFromReconciliationDialog
          reconciliation={rec}
          line={claiming.line}
          warehouseName={warehouseName}
          keys={keys}
          onClose={() => setClaiming(null)}
          onClaimed={(result) => {
            setClaiming(null);
            apply(result.reconciliation);
            onClaimed?.(result);
            if (result.duplicate) toast.info(`Ese reclamo ya estaba registrado: ${result.claim.number}`);
            else toast.success(`${result.claim.number} creado · se cobra en la liquidación del courier`);
          }}
        />
      ) : null}

      {closing ? (
        <ReasonDialog
          title={`Cerrar ${rec.number}`}
          description={
            closeNeedsNote(rec)
              ? `Quedan ${summary.unexplainedLines} SKU sin explicar: escribe por qué se cierra así (por ejemplo, «se reclama en la próxima liquidación»).`
              : "Todas las diferencias están explicadas o reclamadas."
          }
          confirmLabel="Cerrar conciliación"
          reasonLabel="Nota de cierre"
          requireReason={closeNeedsNote(rec)}
          errorFallback="No se pudo cerrar la conciliación."
          onClose={() => setClosing(false)}
          onConfirm={async (note) => {
            const saved = await closeReconciliation(rec.id, note ? { note } : {});
            setClosing(false);
            apply(saved);
            toast.success(`${rec.number} cerrada`);
          }}
        />
      ) : null}

      {cancelling ? (
        <ReasonDialog
          title={`Anular ${rec.number}`}
          description="La conciliación queda anulada y no mueve stock. Solo se anula si no tiene reclamos."
          confirmLabel="Anular conciliación"
          destructive
          errorFallback="No se pudo anular la conciliación."
          onClose={() => setCancelling(false)}
          onConfirm={async (reason) => {
            const saved = await cancelReconciliation(rec.id, reason ? { reason } : {});
            setCancelling(false);
            apply(saved);
            toast.success(`${rec.number} anulada`);
          }}
        />
      ) : null}
    </section>
  );
}
