"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import GreIssueDialog from "@/components/gre/GreIssueDialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { isGreEligibleTransferStatus } from "@/features/sunat/despatch-advice/utils/gre-form";
import { useMyWarehouses } from "@/hooks/useMyWarehouses";
import { useOperationKeys } from "@/hooks/useOperationKeys";
import { formatDay, formatMoney } from "@/lib/purchaseOrders";
import {
  canCancelTransfer,
  opsErrorMessage,
  TRANSFER_STATUS_CLASS,
  TRANSFER_STATUS_LABEL,
  transferReceivedUnits,
  transferUnits,
  warehouseOpsAccess,
  whoDid,
} from "@/lib/warehouseOps";
import { cancelTransfer, dispatchTransfer, listTransfers, type Transfer, type TransferStatus } from "@/services/warehouseOpsService";
import { ErrorBox, ReasonDialog, RuleNote, SELECT_CLASS, StatusPill } from "../OpsBits";
import { useCompanyWarehouses } from "@/hooks/useCompanyWarehouses";
import ReceiveTransferDialog from "./ReceiveTransferDialog";
import TransferDetailDialog from "./TransferDetailDialog";
import TransferFormDialog from "./TransferFormDialog";

// FEAT-24 H5-C — Inventario › Traslados (mockup vTras): la lista con filtros de
// estado, origen y destino; armar y editar el borrador; despachar (el stock sale
// del origen y queda «en camino»); recibir (por línea, con diferencias) y anular.
// Los botones dependen del rol y de los almacenes que el usuario opera; el
// backend igual valida.

export const TRANSFERS_KEY = "stock-transfers";

const STATUSES: TransferStatus[] = ["borrador", "en_camino", "recibido", "recibido_con_diferencia", "anulado"];

type DialogState =
  | { kind: "form"; transfer: Transfer | null }
  | { kind: "detail"; transfer: Transfer }
  | { kind: "receive"; transfer: Transfer }
  | { kind: "dispatch"; transfer: Transfer }
  | { kind: "cancel"; transfer: Transfer }
  | { kind: "gre"; transfer: Transfer }
  | null;

export default function TransfersTab({ companyId }: { companyId: string }) {
  const { auth } = useAuth();
  const access = warehouseOpsAccess(auth?.user);
  const scope = useMyWarehouses();
  const keys = useOperationKeys();
  const queryClient = useQueryClient();
  const { warehouses, nameOf } = useCompanyWarehouses();
  const [status, setStatus] = useState<TransferStatus | "">("");
  const [originId, setOriginId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: [TRANSFERS_KEY, companyId, status],
    queryFn: ({ signal }) => listTransfers(status ? { status } : {}, signal),
    enabled: !!companyId,
    retry: false,
  });
  const visibleWarehouses = useMemo(() => scope.visible(warehouses), [scope, warehouses]);
  const rows = useMemo(
    () =>
      (query.data ?? []).filter(
        (transfer) => (!originId || transfer.originInventoryId === originId) && (!destinationId || transfer.destinationInventoryId === destinationId),
      ),
    [query.data, originId, destinationId],
  );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: [TRANSFERS_KEY, companyId] });
    void queryClient.invalidateQueries({ queryKey: ["business-inventory-items"] });
  };

  const dispatch = useMutation({
    mutationFn: (transfer: Transfer) => dispatchTransfer(transfer.id, { operationId: keys.get(`dispatch:${transfer.id}`) }),
    onSuccess: (result, transfer) => {
      keys.release(`dispatch:${transfer.id}`);
      setDialog(null);
      toast[result.duplicate ? "info" : "success"](
        result.duplicate ? `${transfer.number} ya estaba despachado.` : `${transfer.number} en camino`,
        result.duplicate ? undefined : { description: "El stock salió del origen y queda «en camino» hasta que el destino lo reciba." },
      );
      refresh();
    },
    onError: (error) => setDispatchError(opsErrorMessage(error, "No se pudo despachar el traslado. Inténtalo de nuevo.")),
  });

  const canDispatch = (transfer: Transfer) => access.operate && transfer.status === "borrador" && scope.canOperate(transfer.originInventoryId);
  const canReceive = (transfer: Transfer) => access.operate && transfer.status === "en_camino" && scope.canOperate(transfer.destinationInventoryId);
  const canEdit = (transfer: Transfer) => access.operate && transfer.status === "borrador" && scope.canOperate(transfer.originInventoryId);
  const canCancel = (transfer: Transfer) => access.manage && canCancelTransfer(transfer);
  // FEAT-24 H12: la guía de remisión (motivo 04) la emite quien despacha, mientras la mercadería no llegó.
  const canIssueGre = (transfer: Transfer) => access.operate && isGreEligibleTransferStatus(transfer.status) && scope.canOperate(transfer.originInventoryId);

  const actionButtons = (transfer: Transfer, inDetail = false) => (
    <>
      {canEdit(transfer) ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setDialog({ kind: "form", transfer })}>
          Editar
        </Button>
      ) : null}
      {canCancel(transfer) ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setDialog({ kind: "cancel", transfer })}>
          Anular
        </Button>
      ) : null}
      {canDispatch(transfer) ? (
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setDispatchError(null);
            setDialog({ kind: "dispatch", transfer });
          }}
        >
          Despachar
        </Button>
      ) : null}
      {canReceive(transfer) ? (
        <Button type="button" size="sm" onClick={() => setDialog({ kind: "receive", transfer })}>
          Recibir
        </Button>
      ) : null}
      {inDetail && canIssueGre(transfer) ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setDialog({ kind: "gre", transfer })}>
          <FileText className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Emitir guía de remisión
        </Button>
      ) : null}
      {inDetail ? null : (
        <Button type="button" size="icon" variant="ghost" aria-label={`Ver ${transfer.number}`} onClick={() => setDialog({ kind: "detail", transfer })}>
          <Eye className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <select aria-label="Estado" className={`${SELECT_CLASS} w-48`} value={status} onChange={(event) => setStatus(event.target.value as TransferStatus | "")}>
            <option value="">Todos los estados</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {TRANSFER_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
          <select aria-label="Origen" className={`${SELECT_CLASS} w-48`} value={originId} onChange={(event) => setOriginId(event.target.value)}>
            <option value="">Cualquier origen</option>
            {visibleWarehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
          <select aria-label="Destino" className={`${SELECT_CLASS} w-48`} value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>
            <option value="">Cualquier destino</option>
            {visibleWarehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </div>
        {access.operate ? (
          <Button type="button" onClick={() => setDialog({ kind: "form", transfer: null })}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Nuevo traslado
          </Button>
        ) : null}
      </div>

      <RuleNote>
        <b>Regla:</b> al despachar, el stock sale del origen y queda «en camino». No se vende en el destino hasta que se recibe. Si llega menos, la diferencia
        queda registrada para investigar o reclamar. El flete es gasto logístico y no suma al costo.
      </RuleNote>

      {query.isError ? <ErrorBox>{opsErrorMessage(query.error, "No se pudieron cargar los traslados.")}</ErrorBox> : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Nº</th>
              <th className="px-3 py-2 text-left font-medium">Fecha</th>
              <th className="px-3 py-2 text-left font-medium">Origen → destino</th>
              <th className="px-3 py-2 text-right font-medium">Unidades</th>
              <th className="px-3 py-2 text-left font-medium">Guía de remisión</th>
              <th className="px-3 py-2 text-right font-medium">Flete</th>
              <th className="px-3 py-2 text-left font-medium">Usuario</th>
              <th className="px-3 py-2 text-left font-medium">Estado</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {query.isPending ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  Cargando traslados…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  No hay traslados con estos filtros.
                </td>
              </tr>
            ) : (
              rows.map((transfer) => {
                const units = transferUnits(transfer);
                const received = transferReceivedUnits(transfer);
                return (
                  <tr key={transfer.id} className="border-t" data-testid={`transfer-${transfer.number}`}>
                    <td className="px-3 py-2 font-mono font-semibold">{transfer.number}</td>
                    <td className="px-3 py-2 tabular-nums">{formatDay(transfer.dispatchedAt ?? transfer.createdAt)}</td>
                    <td className="px-3 py-2">
                      {nameOf(transfer.originInventoryId)} → <b>{nameOf(transfer.destinationInventoryId)}</b>
                      {transfer.notes ? <p className="text-xs text-muted-foreground">{transfer.notes}</p> : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {units}
                      {transfer.status === "recibido" || transfer.status === "recibido_con_diferencia" || (transfer.status === "en_camino" && received > 0) ? (
                        <span className="text-muted-foreground"> · llegaron {received}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 font-mono">{transfer.remissionGuide || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{transfer.freight ? formatMoney(Number(transfer.freight)) : "—"}</td>
                    <td className="px-3 py-2">{whoDid(transfer.userName, transfer.userEmail)}</td>
                    <td className="px-3 py-2">
                      <StatusPill label={TRANSFER_STATUS_LABEL[transfer.status] ?? transfer.status} className={TRANSFER_STATUS_CLASS[transfer.status] ?? ""} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1 whitespace-nowrap">{actionButtons(transfer)}</div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {dialog?.kind === "form" ? (
        <TransferFormDialog
          companyId={companyId}
          transfer={dialog.transfer}
          defaultOriginId={originId || undefined}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            refresh();
          }}
        />
      ) : null}

      {dialog?.kind === "detail" ? (
        <TransferDetailDialog
          transfer={dialog.transfer}
          originName={nameOf(dialog.transfer.originInventoryId)}
          destinationName={nameOf(dialog.transfer.destinationInventoryId)}
          actions={actionButtons(dialog.transfer, true)}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog?.kind === "receive" ? (
        <ReceiveTransferDialog
          transfer={dialog.transfer}
          companyId={companyId}
          originName={nameOf(dialog.transfer.originInventoryId)}
          destinationName={nameOf(dialog.transfer.destinationInventoryId)}
          onClose={() => setDialog(null)}
          onReceived={() => {
            setDialog(null);
            refresh();
          }}
          onConflict={refresh}
        />
      ) : null}

      {dialog?.kind === "gre" ? (
        <GreIssueDialog
          source={{
            kind: "transfer",
            transfer: dialog.transfer,
            originName: nameOf(dialog.transfer.originInventoryId),
            destinationName: nameOf(dialog.transfer.destinationInventoryId),
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog?.kind === "dispatch" ? (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open && !dispatch.isPending) setDialog(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Despachar {dialog.transfer.number}</AlertDialogTitle>
              <AlertDialogDescription>
                Saldrán {transferUnits(dialog.transfer)} unidades de {nameOf(dialog.transfer.originInventoryId)} y quedarán en camino hasta que{" "}
                {nameOf(dialog.transfer.destinationInventoryId)} las reciba.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ErrorBox>{dispatchError}</ErrorBox>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={dispatch.isPending}>Volver</AlertDialogCancel>
              <Button type="button" disabled={dispatch.isPending} onClick={() => dispatch.mutate(dialog.transfer)}>
                {dispatch.isPending ? "Despachando…" : dispatchError ? "Reintentar" : "Despachar"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      {dialog?.kind === "cancel" ? (
        <ReasonDialog
          title={`Anular ${dialog.transfer.number}`}
          description={
            dialog.transfer.status === "en_camino"
              ? `El stock vuelve a ${nameOf(dialog.transfer.originInventoryId)} y se quita lo «en camino» de ${nameOf(dialog.transfer.destinationInventoryId)}.`
              : "El borrador no movió stock: solo queda anulado."
          }
          confirmLabel="Anular traslado"
          destructive
          errorFallback="No se pudo anular el traslado."
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            const transfer = dialog.transfer;
            const scopeKey = `cancel:${transfer.id}`;
            await cancelTransfer(transfer.id, { ...(reason ? { reason } : {}), operationId: keys.get(scopeKey) });
            keys.release(scopeKey);
            toast.success(`${transfer.number} anulado`);
            setDialog(null);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}
