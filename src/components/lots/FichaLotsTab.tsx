"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { Info, Lock, LockOpen, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { canEditInventory } from "@/config/permissions.config";
import { useExpiryAlertDays } from "@/hooks/useExpiryAlertDays";
import { LOT_TONE_CLASS, lotDate, lotStatusView, lotWriteErrorMessage } from "@/lib/lots";
import { warehouseOpsAccess } from "@/lib/warehouseOps";
import { cn } from "@/lib/utils";
import { listLots, updateLot, type LotRow, type UnlottedRow } from "@/services/lotsService";
import AssignLotDialog, { type AssignLotDefaults } from "./AssignLotDialog";
import LotEditDialog from "./LotEditDialog";

// FEAT-24 H5-L — ficha del producto › Lotes (mockup `lotesTabHTML`): por
// variante, cada lote con su número, vencimiento, saldo por almacén, comentario
// y estado (vigente, por vencer, vencido o bloqueado), más lo «sin lote» de cada
// almacén. Editar y bloquear: Administrador u Operaciones. «Registrar lote»
// (pasa stock sin lote a un lote): Administrador, Operaciones o Almacén.

export const LOTS_QUERY_KEY = "lots";

export interface FichaLotVariant {
  id: string;
  label: string;
}

type Row =
  | { key: string; kind: "lot"; variantId: string; lot: LotRow }
  | { key: string; kind: "unlotted"; variantId: string; unlotted: UnlottedRow };

export default function FichaLotsTab({ variants, showVariant }: { variants: FichaLotVariant[]; showVariant: boolean }) {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = canEditInventory(auth?.user);
  const canAssign = warehouseOpsAccess(auth?.user).operate;
  const alertDays = useExpiryAlertDays();
  const [editing, setEditing] = useState<LotRow | null>(null);
  const [assigning, setAssigning] = useState<AssignLotDefaults | null>(null);

  const queries = useQueries({
    queries: variants.map((variant) => ({
      queryKey: [LOTS_QUERY_KEY, "variant", variant.id],
      queryFn: ({ signal }: { signal: AbortSignal }) => listLots({ variantId: variant.id, includeEmpty: true }, signal),
      retry: false,
    })),
  });
  const loading = queries.some((query) => query.isPending);
  const failed = queries.find((query) => query.isError);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    variants.forEach((variant, index) => {
      const list = queries[index]?.data;
      if (!list) return;
      for (const lot of list.items.filter((item) => item.variantId === variant.id)) {
        out.push({ key: `${lot.lotId}|${lot.inventoryId ?? "-"}`, kind: "lot", variantId: variant.id, lot });
      }
      for (const unlotted of list.unlotted.filter((item) => item.variantId === variant.id && item.quantity !== 0)) {
        out.push({ key: `sin-lote|${variant.id}|${unlotted.inventoryId}`, kind: "unlotted", variantId: variant.id, unlotted });
      }
    });
    return out;
  }, [variants, queries]);
  const lotsOf = (variantId: string) => {
    const index = variants.findIndex((variant) => variant.id === variantId);
    return queries[index]?.data;
  };
  const labelOf = (variantId: string) => variants.find((variant) => variant.id === variantId)?.label ?? "Variante";

  const refresh = () => void queryClient.invalidateQueries({ queryKey: [LOTS_QUERY_KEY] });

  const toggleBlock = useMutation({
    mutationFn: (lot: LotRow) => updateLot(lot.lotId, { status: lot.storedStatus === "bloqueado" ? "vigente" : "bloqueado" }),
    onSuccess: (_detail, lot) => {
      toast.success(lot.storedStatus === "bloqueado" ? `Lote ${lot.number} desbloqueado.` : `Lote ${lot.number} bloqueado: no se despacha hasta desbloquearlo.`);
      refresh();
    },
    onError: (error) => toast.error(lotWriteErrorMessage(error, "No se pudo cambiar el estado del lote. Inténtalo de nuevo.")),
  });

  const columns = [...(showVariant ? ["Variante"] : []), "Lote", "Vence", "Almacén", "Unidades", "Comentario", "Estado", ...(canEdit || canAssign ? [""] : [])];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          <b>Cada lote tiene número, fecha de vencimiento y comentario.</b> Se registran al recibir la compra (o aquí, para el stock que ya tienes). Al
          despachar sale primero el que vence antes y no se despachan los vencidos ni los bloqueados.
        </p>
      </div>

      {canAssign ? (
        <Button type="button" onClick={() => setAssigning({ variantId: variants[0]?.id ?? "" })} disabled={variants.length === 0}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Registrar lote
        </Button>
      ) : null}

      {failed ? (
        <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          No se pudieron leer los lotes. {lotWriteErrorMessage(failed.error, "")}{" "}
          <Button variant="outline" size="sm" onClick={refresh}>
            Reintentar
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              {columns.map((column, index) => (
                <th key={`${column}-${index}`} className={cn("px-3 py-2 font-medium", column === "Unidades" ? "text-right" : "text-left")}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-muted-foreground" role="status">
                  Cargando lotes…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-muted-foreground">
                  Aún no hay lotes registrados.
                </td>
              </tr>
            ) : (
              rows.map((row) =>
                row.kind === "lot" ? (
                  <LotTableRow
                    key={row.key}
                    lot={row.lot}
                    variantLabel={showVariant ? labelOf(row.variantId) : null}
                    alertDays={alertDays}
                    canEdit={canEdit}
                    actions={canEdit || canAssign}
                    busy={toggleBlock.isPending && toggleBlock.variables?.lotId === row.lot.lotId}
                    onEdit={() => setEditing(row.lot)}
                    onToggleBlock={() => toggleBlock.mutate(row.lot)}
                  />
                ) : (
                  <tr key={row.key} className="border-t bg-muted/20" data-testid={`sin-lote-${row.variantId}-${row.unlotted.inventoryId}`}>
                    {showVariant ? <td className="px-3 py-2">{labelOf(row.variantId)}</td> : null}
                    <td className="px-3 py-2 italic text-muted-foreground">Sin lote</td>
                    <td className="px-3 py-2 text-muted-foreground">—</td>
                    <td className="px-3 py-2">{row.unlotted.inventoryName || "Almacén"}</td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", row.unlotted.quantity < 0 && "text-destructive")}>{row.unlotted.quantity}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">Stock de antes de los lotes o que entró sin lote.</td>
                    <td className="px-3 py-2" />
                    {canEdit || canAssign ? (
                      <td className="px-3 py-2 text-right">
                        {canAssign && row.unlotted.quantity > 0 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAssigning({ variantId: row.variantId, inventoryId: row.unlotted.inventoryId })}
                          >
                            Registrar lote
                          </Button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </div>

      {editing ? (
        <LotEditDialog
          lot={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      ) : null}
      {assigning ? (
        <AssignLotDialog
          variants={variants}
          defaults={assigning}
          lotsOf={lotsOf}
          onClose={() => setAssigning(null)}
          onSaved={() => {
            setAssigning(null);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function LotTableRow({
  lot,
  variantLabel,
  alertDays,
  canEdit,
  actions,
  busy,
  onEdit,
  onToggleBlock,
}: {
  lot: LotRow;
  variantLabel: string | null;
  alertDays: number;
  canEdit: boolean;
  actions: boolean;
  busy: boolean;
  onEdit: () => void;
  onToggleBlock: () => void;
}) {
  const view = lotStatusView(lot, alertDays);
  const blocked = lot.storedStatus === "bloqueado";
  return (
    <tr className="border-t" data-testid={`lote-${lot.lotId}-${lot.inventoryId ?? "sin-stock"}`}>
      {variantLabel !== null ? <td className="px-3 py-2">{variantLabel}</td> : null}
      <td className="px-3 py-2 font-mono">
        {lot.number}
        {lot.kind === "devolucion" ? <span className="ml-1 font-sans text-xs text-muted-foreground">(devoluciones)</span> : null}
      </td>
      <td className="px-3 py-2">{lotDate(lot.expiresAt)}</td>
      <td className="px-3 py-2">{lot.inventoryId ? lot.inventoryName || "Almacén" : <span className="text-muted-foreground">Sin stock</span>}</td>
      <td className="px-3 py-2 text-right tabular-nums">{lot.quantity}</td>
      <td className="max-w-[260px] px-3 py-2 text-xs text-muted-foreground">{lot.comment || "—"}</td>
      <td className="px-3 py-2">
        <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", LOT_TONE_CLASS[view.tone])}>{view.label}</span>
      </td>
      {actions ? (
        <td className="whitespace-nowrap px-3 py-2 text-right">
          {canEdit ? (
            <>
              <Button type="button" variant="ghost" size="sm" aria-label={`Editar lote ${lot.number}`} onClick={onEdit}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onToggleBlock}>
                {blocked ? <LockOpen className="mr-1 h-4 w-4" aria-hidden="true" /> : <Lock className="mr-1 h-4 w-4" aria-hidden="true" />}
                {blocked ? "Desbloquear" : "Bloquear"}
              </Button>
            </>
          ) : null}
        </td>
      ) : null}
    </tr>
  );
}
