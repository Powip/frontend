"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useMyWarehouses } from "@/hooks/useMyWarehouses";
import { useOperationKeys } from "@/hooks/useOperationKeys";
import { formatDay } from "@/lib/purchaseOrders";
import {
  ADJUSTMENT_REASON_LABEL,
  ADJUSTMENT_STATUS_CLASS,
  ADJUSTMENT_STATUS_LABEL,
  adjustmentTypeLabel,
  adjustmentUnits,
  formatDateTime,
  lineLabel,
  opsErrorMessage,
  warehouseOpsAccess,
  whoDid,
} from "@/lib/warehouseOps";
import {
  approveAdjustment,
  cancelAdjustment,
  listAdjustments,
  rejectAdjustment,
  type AdjustmentKind,
  type AdjustmentStatus,
  type StockAdjustmentDoc,
} from "@/services/warehouseOpsService";
import { ErrorBox, Money, ReasonDialog, RuleNote, SELECT_CLASS, StatusPill } from "../OpsBits";
import { useCompanyWarehouses } from "@/hooks/useCompanyWarehouses";
import { invalidateInventoryAlerts } from "@/hooks/useInventoryAlerts";
import AdjustmentFormDialog from "./AdjustmentFormDialog";

// FEAT-24 H5-C (H5-D4) — Inventario › Ajustes y mermas (mockup vAjustes): pedir
// un ajuste o una merma, la bandeja de pendientes de aprobación (aprobar y
// rechazar: solo el Administrador) y anular (un pendiente: Administrador u
// Operaciones; uno aplicado: solo el Administrador, con movimientos inversos).

export const ADJUSTMENTS_KEY = "stock-adjustments";

const STATUSES: AdjustmentStatus[] = ["pendiente_aprobacion", "aplicado", "rechazado", "anulado"];

type DialogState =
  | { kind: "form" }
  | { kind: "detail"; adjustment: StockAdjustmentDoc }
  | { kind: "reject"; adjustment: StockAdjustmentDoc }
  | { kind: "cancel"; adjustment: StockAdjustmentDoc }
  | null;

/** Valor del documento: «••••» si el rol no ve costos (la API omite `totalValue`). */
const docValue = (doc: StockAdjustmentDoc) => ("totalValue" in doc ? (doc.totalValue ?? null) : undefined);

export default function AdjustmentsTab({ companyId }: { companyId: string }) {
  const { auth } = useAuth();
  const access = warehouseOpsAccess(auth?.user);
  const scope = useMyWarehouses();
  const keys = useOperationKeys();
  const queryClient = useQueryClient();
  const { warehouses, nameOf } = useCompanyWarehouses();
  const [status, setStatus] = useState<AdjustmentStatus | "">("");
  const [kind, setKind] = useState<AdjustmentKind | "">("");
  const [inventoryId, setInventoryId] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const filters = { ...(status ? { status } : {}), ...(kind ? { kind } : {}), ...(inventoryId ? { inventoryId } : {}) };
  const query = useQuery({
    queryKey: [ADJUSTMENTS_KEY, companyId, filters],
    queryFn: ({ signal }) => listAdjustments(filters, signal),
    enabled: !!companyId,
    retry: false,
  });
  const pendingQuery = useQuery({
    queryKey: [ADJUSTMENTS_KEY, companyId, "pending"],
    queryFn: ({ signal }) => listAdjustments({ status: "pendiente_aprobacion" }, signal),
    enabled: !!companyId,
    retry: false,
  });
  const pending = pendingQuery.data ?? [];

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: [ADJUSTMENTS_KEY, companyId] });
    void queryClient.invalidateQueries({ queryKey: ["business-inventory-items"] });
    void invalidateInventoryAlerts(queryClient);
  };

  const approve = useMutation({
    mutationFn: (doc: StockAdjustmentDoc) => approveAdjustment(doc.id, { operationId: keys.get(`approve:${doc.id}`) }),
    onSuccess: (result, doc) => {
      keys.release(`approve:${doc.id}`);
      setRowError(null);
      toast.success(result.duplicate ? `${doc.number} ya estaba aprobado.` : `${doc.number} aprobado y aplicado`);
      refresh();
    },
    onError: (error, doc) => setRowError({ id: doc.id, message: opsErrorMessage(error, "No se pudo aprobar. Inténtalo de nuevo.") }),
  });

  const canCancel = (doc: StockAdjustmentDoc) =>
    (doc.status === "pendiente_aprobacion" && access.manage) || (doc.status === "aplicado" && access.admin);

  const approvalButtons = (doc: StockAdjustmentDoc) =>
    doc.status === "pendiente_aprobacion" && access.admin ? (
      <>
        <Button type="button" size="sm" disabled={approve.isPending} onClick={() => approve.mutate(doc)}>
          Aprobar
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={approve.isPending} onClick={() => setDialog({ kind: "reject", adjustment: doc })}>
          Rechazar
        </Button>
      </>
    ) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <select aria-label="Estado" className={`${SELECT_CLASS} w-52`} value={status} onChange={(event) => setStatus(event.target.value as AdjustmentStatus | "")}>
            <option value="">Todos los estados</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {ADJUSTMENT_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
          <select aria-label="Tipo" className={`${SELECT_CLASS} w-40`} value={kind} onChange={(event) => setKind(event.target.value as AdjustmentKind | "")}>
            <option value="">Ajustes y mermas</option>
            <option value="ajuste">Solo ajustes</option>
            <option value="merma">Solo mermas</option>
          </select>
          <select aria-label="Almacén" className={`${SELECT_CLASS} w-48`} value={inventoryId} onChange={(event) => setInventoryId(event.target.value)}>
            <option value="">Todos mis almacenes</option>
            {scope.visible(warehouses).map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </div>
        {access.operate ? (
          <Button type="button" onClick={() => setDialog({ kind: "form" })}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Nuevo ajuste o merma
          </Button>
        ) : null}
      </div>

      <RuleNote>
        <b>Regla:</b> todo ajuste lleva motivo, usuario y fecha. Los que superan el umbral de tu empresa quedan pendientes hasta que el Administrador los
        apruebe; mientras tanto el stock no se mueve. Uno aplicado no se edita: se anula con movimientos inversos.
      </RuleNote>

      {pending.length > 0 ? (
        <section aria-label="Pendientes de aprobación" className="rounded-md border border-amber-300 dark:border-amber-800">
          <header className="flex items-center gap-2 border-b bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            Pendientes de aprobación
            <span className="rounded-full bg-amber-200 px-2 text-xs dark:bg-amber-900">{pending.length}</span>
            {!access.admin ? <span className="ml-auto text-xs font-normal">Los aprueba o rechaza el Administrador.</span> : null}
          </header>
          <ul className="divide-y">
            {pending.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm" data-testid={`pending-${doc.number}`}>
                <span className="font-mono font-semibold">{doc.number}</span>
                <span>{adjustmentTypeLabel(doc)}</span>
                <span className="text-muted-foreground">
                  {nameOf(doc.inventoryId)} · {doc.lines.length} producto(s) · {adjustmentUnits(doc)} und · {ADJUSTMENT_REASON_LABEL[doc.reason] ?? doc.reason}
                </span>
                <Money value={docValue(doc)} />
                <span className="text-muted-foreground">pidió {whoDid(doc.userName, doc.userEmail)}</span>
                <span className="ml-auto flex gap-1">{approvalButtons(doc)}</span>
                {rowError?.id === doc.id ? (
                  <p role="alert" className="w-full text-xs text-destructive">
                    {rowError.message}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {query.isError ? <ErrorBox>{opsErrorMessage(query.error, "No se pudieron cargar los ajustes.")}</ErrorBox> : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Nº</th>
              <th className="px-3 py-2 text-left font-medium">Fecha</th>
              <th className="px-3 py-2 text-left font-medium">Tipo</th>
              <th className="px-3 py-2 text-left font-medium">Producto</th>
              <th className="px-3 py-2 text-left font-medium">Almacén</th>
              <th className="px-3 py-2 text-right font-medium">Cant.</th>
              <th className="px-3 py-2 text-right font-medium">Valor</th>
              <th className="px-3 py-2 text-left font-medium">Motivo</th>
              <th className="px-3 py-2 text-left font-medium">Usuario</th>
              <th className="px-3 py-2 text-left font-medium">Estado</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {query.isPending ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                  Cargando ajustes…
                </td>
              </tr>
            ) : (query.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                  No hay ajustes ni mermas con estos filtros.
                </td>
              </tr>
            ) : (
              (query.data ?? []).map((doc) => {
                const units = adjustmentUnits(doc);
                const first = doc.lines[0];
                return (
                  <tr key={doc.id} className="border-t" data-testid={`adjustment-${doc.number}`}>
                    <td className="px-3 py-2 font-mono font-semibold">{doc.number}</td>
                    <td className="px-3 py-2 tabular-nums">{formatDay(doc.createdAt)}</td>
                    <td className="px-3 py-2">{adjustmentTypeLabel(doc)}</td>
                    <td className="px-3 py-2">
                      {first ? lineLabel(first) : "—"}
                      {doc.lines.length > 1 ? <span className="text-muted-foreground"> y {doc.lines.length - 1} más</span> : null}
                    </td>
                    <td className="px-3 py-2">{nameOf(doc.inventoryId)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${units < 0 ? "text-destructive" : "text-teal-700 dark:text-teal-300"}`}>
                      {units > 0 ? `+${units}` : units}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Money value={docValue(doc)} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {ADJUSTMENT_REASON_LABEL[doc.reason] ?? doc.reason}
                      {doc.note ? ` · ${doc.note}` : ""}
                    </td>
                    <td className="px-3 py-2">{whoDid(doc.userName, doc.userEmail)}</td>
                    <td className="px-3 py-2">
                      <StatusPill label={ADJUSTMENT_STATUS_LABEL[doc.status] ?? doc.status} className={ADJUSTMENT_STATUS_CLASS[doc.status] ?? ""} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                        {approvalButtons(doc)}
                        {canCancel(doc) ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => setDialog({ kind: "cancel", adjustment: doc })}>
                            Anular
                          </Button>
                        ) : null}
                        <Button type="button" size="icon" variant="ghost" aria-label={`Ver ${doc.number}`} onClick={() => setDialog({ kind: "detail", adjustment: doc })}>
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                      {rowError?.id === doc.id ? (
                        <p role="alert" className="mt-1 text-right text-xs text-destructive">
                          {rowError.message}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {dialog?.kind === "form" ? (
        <AdjustmentFormDialog
          companyId={companyId}
          canSeeCosts={access.seeCosts}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            refresh();
          }}
        />
      ) : null}

      {dialog?.kind === "detail" ? <AdjustmentDetailDialog doc={dialog.adjustment} warehouseName={nameOf(dialog.adjustment.inventoryId)} onClose={() => setDialog(null)} /> : null}

      {dialog?.kind === "reject" ? (
        <ReasonDialog
          title={`Rechazar ${dialog.adjustment.number}`}
          description="El stock no se mueve y el pedido queda rechazado."
          confirmLabel="Rechazar"
          destructive
          errorFallback="No se pudo rechazar."
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            const doc = dialog.adjustment;
            await rejectAdjustment(doc.id, { ...(reason ? { reason } : {}), operationId: keys.get(`reject:${doc.id}`) });
            keys.release(`reject:${doc.id}`);
            toast.success(`${doc.number} rechazado`);
            setDialog(null);
            refresh();
          }}
        />
      ) : null}

      {dialog?.kind === "cancel" ? (
        <ReasonDialog
          title={`Anular ${dialog.adjustment.number}`}
          description={
            dialog.adjustment.status === "aplicado"
              ? "Se registran los movimientos inversos: el stock vuelve a como estaba antes del ajuste."
              : "Todavía no movió stock: solo queda anulado."
          }
          confirmLabel="Anular"
          destructive
          errorFallback="No se pudo anular."
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            const doc = dialog.adjustment;
            await cancelAdjustment(doc.id, { ...(reason ? { reason } : {}), operationId: keys.get(`cancel:${doc.id}`) });
            keys.release(`cancel:${doc.id}`);
            toast.success(`${doc.number} anulado`);
            setDialog(null);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function AdjustmentDetailDialog({ doc, warehouseName, onClose }: { doc: StockAdjustmentDoc; warehouseName: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {doc.number} · {adjustmentTypeLabel(doc)}
            <StatusPill label={ADJUSTMENT_STATUS_LABEL[doc.status] ?? doc.status} className={ADJUSTMENT_STATUS_CLASS[doc.status] ?? ""} />
          </DialogTitle>
          <DialogDescription>
            {warehouseName} · {ADJUSTMENT_REASON_LABEL[doc.reason] ?? doc.reason}
            {doc.note ? ` · ${doc.note}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Producto</th>
                <th className="px-3 py-2 text-right font-medium">Cant.</th>
                <th className="px-3 py-2 text-right font-medium">Costo unit.</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((line) => (
                <tr key={line.id} className="border-t">
                  <td className="px-3 py-2">
                    <p>{lineLabel(line)}</p>
                    <p className="font-mono text-xs text-muted-foreground">{line.sku}</p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{line.quantityDelta > 0 ? `+${line.quantityDelta}` : line.quantityDelta}</td>
                  <td className="px-3 py-2 text-right">
                    <Money value={"unitCost" in line ? line.unitCost : undefined} decimals={4} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={"lineValue" in line ? line.lineValue : undefined} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>
            Pedido · {formatDateTime(doc.createdAt)} · {whoDid(doc.userName, doc.userEmail)}
          </li>
          {doc.approvedAt ? (
            <li>
              Aprobado · {formatDateTime(doc.approvedAt)} · {whoDid(doc.approvedByName, doc.approvedByEmail)}
            </li>
          ) : null}
          {doc.rejectedAt ? (
            <li>
              Rechazado · {formatDateTime(doc.rejectedAt)} · {whoDid(doc.rejectedByName, doc.rejectedByEmail)}
              {doc.rejectReason ? ` · ${doc.rejectReason}` : ""}
            </li>
          ) : null}
          {doc.cancelledAt ? (
            <li>
              Anulado · {formatDateTime(doc.cancelledAt)} · {whoDid(doc.cancelledByName, doc.cancelledByEmail)}
              {doc.cancelReason ? ` · ${doc.cancelReason}` : ""}
            </li>
          ) : null}
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
