"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useMyWarehouses } from "@/hooks/useMyWarehouses";
import { formatDay } from "@/lib/purchaseOrders";
import {
  COUNT_SCOPE_LABEL,
  COUNT_STATUS_CLASS,
  COUNT_STATUS_LABEL,
  countProgress,
  opsErrorMessage,
  warehouseOpsAccess,
  whoDid,
} from "@/lib/warehouseOps";
import { listCounts, type StockCount } from "@/services/warehouseOpsService";
import { ErrorBox, RuleNote, SELECT_CLASS, StatusPill } from "../OpsBits";
import { useCompanyWarehouses } from "@/hooks/useCompanyWarehouses";
import CountFormDialog from "./CountFormDialog";
import CountSheet from "./CountSheet";
import InvestigationsPanel, { INVESTIGATIONS_KEY } from "./InvestigationsPanel";

// FEAT-24 H5-C (H5-D5/D6) — Inventario › Conteos (mockup vConteo): las tomas en
// curso y por validar, el detalle de una (contar, cerrar, decidir, recontar,
// aplicar, anular), los pendientes de investigación y las tomas anteriores.

export const COUNTS_KEY = "stock-counts";

const FLOW = [
  ["En curso", "Se cuenta a mano o escaneando"],
  ["Por validar", "El supervisor revisa"],
  ["Reconteo", "Lo que supera la tolerancia"],
  ["Aplicado", "Ajustes y decisiones"],
] as const;

export default function CountsTab({ companyId }: { companyId: string }) {
  const { auth } = useAuth();
  const access = warehouseOpsAccess(auth?.user);
  const scope = useMyWarehouses();
  const queryClient = useQueryClient();
  const { warehouses, nameOf } = useCompanyWarehouses();
  const [inventoryId, setInventoryId] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const query = useQuery({
    queryKey: [COUNTS_KEY, companyId, inventoryId],
    queryFn: ({ signal }) => listCounts(inventoryId ? { inventoryId } : {}, signal),
    enabled: !!companyId,
    retry: false,
  });
  const all = useMemo(() => query.data ?? [], [query.data]);
  const open = all.filter((count) => count.status === "en_curso" || count.status === "por_validar");
  const history = all.filter((count) => count.status === "aplicado" || count.status === "anulado");
  const selectedCount = all.find((count) => count.id === selected) ?? null;
  const typeOf = (id: string) => warehouses.find((warehouse) => warehouse.id === id)?.type;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: [COUNTS_KEY, companyId] });
    void queryClient.invalidateQueries({ queryKey: [INVESTIGATIONS_KEY, companyId] });
  };

  const row = (count: StockCount) => {
    const progress = countProgress(count);
    return (
      <tr key={count.id} className={`border-t ${count.id === selected ? "bg-muted/40" : ""}`} data-testid={`count-${count.number}`}>
        <td className="px-3 py-2 font-mono font-semibold">{count.number}</td>
        <td className="px-3 py-2">{nameOf(count.inventoryId)}</td>
        <td className="px-3 py-2">{COUNT_SCOPE_LABEL[count.scope] ?? count.scope}</td>
        <td className="px-3 py-2 tabular-nums">{formatDay(count.createdAt)}</td>
        <td className="px-3 py-2">{whoDid(count.userName, count.userEmail)}</td>
        <td className="px-3 py-2 text-right tabular-nums">
          {progress.counted} / {progress.total}
        </td>
        <td className="px-3 py-2">
          <StatusPill label={COUNT_STATUS_LABEL[count.status] ?? count.status} className={COUNT_STATUS_CLASS[count.status] ?? ""} />
          {count.blind ? <span className="ml-1 text-xs text-muted-foreground">ciego</span> : null}
        </td>
        <td className="px-3 py-2 text-right">
          <Button type="button" size="sm" variant={count.id === selected ? "default" : "outline"} onClick={() => setSelected(count.id === selected ? null : count.id)}>
            {count.id === selected ? "Ocultar" : "Abrir"}
          </Button>
        </td>
      </tr>
    );
  };

  const table = (rows: StockCount[], empty: string) => (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Nº</th>
            <th className="px-3 py-2 text-left font-medium">Almacén</th>
            <th className="px-3 py-2 text-left font-medium">Qué se cuenta</th>
            <th className="px-3 py-2 text-left font-medium">Fecha</th>
            <th className="px-3 py-2 text-left font-medium">Inició</th>
            <th className="px-3 py-2 text-right font-medium">Contados</th>
            <th className="px-3 py-2 text-left font-medium">Estado</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {query.isPending ? (
            <tr>
              <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                Cargando…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map(row)
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select aria-label="Almacén" className={`${SELECT_CLASS} w-56`} value={inventoryId} onChange={(event) => setInventoryId(event.target.value)}>
          <option value="">Todos mis almacenes</option>
          {scope.visible(warehouses).map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          {access.operate ? (
            <Button asChild variant="outline">
              <Link href="/almacen/contar">
                <Smartphone className="mr-2 h-4 w-4" aria-hidden="true" />
                Contar escaneando
              </Link>
            </Button>
          ) : null}
          {access.operate ? (
            <Button type="button" onClick={() => setCreating(true)}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Nueva toma de inventario
            </Button>
          ) : null}
        </div>
      </div>

      <RuleNote>
        <b>Diferencias de conteo:</b> 1) Lo que entra en la tolerancia se aplica solo. 2) Lo que la supera se puede volver a contar. 3) El supervisor decide
        por línea: corregir el origen, pérdida, sobrante, reclamo al courier o pendiente de investigar. El conteo no bloquea ventas: esperado = foto al
        iniciar + movimientos durante el conteo.
      </RuleNote>

      <ol className="grid gap-2 sm:grid-cols-4" aria-label="Pasos del conteo">
        {FLOW.map(([title, text]) => (
          <li key={title} className="rounded-md border px-3 py-2 text-sm">
            <b>{title}</b>
            <span className="block text-xs text-muted-foreground">{text}</span>
          </li>
        ))}
      </ol>

      {query.isError ? <ErrorBox>{opsErrorMessage(query.error, "No se pudieron cargar los conteos.")}</ErrorBox> : null}

      <section className="space-y-2" aria-label="Tomas abiertas">
        <h3 className="text-sm font-semibold">Tomas abiertas</h3>
        {table(open, "No hay tomas en curso ni por validar.")}
      </section>

      {selectedCount ? (
        <CountSheet
          key={selectedCount.id}
          companyId={companyId}
          countId={selectedCount.id}
          warehouseName={nameOf(selectedCount.inventoryId)}
          courierWarehouse={typeOf(selectedCount.inventoryId) === "COURIER"}
          onChanged={refresh}
          onClose={() => setSelected(null)}
        />
      ) : null}

      <InvestigationsPanel companyId={companyId} nameOf={nameOf} />

      <section className="space-y-2" aria-label="Tomas anteriores">
        <h3 className="text-sm font-semibold">Tomas anteriores</h3>
        {table(history, "Todavía no hay tomas aplicadas.")}
      </section>

      {creating ? (
        <CountFormDialog
          companyId={companyId}
          onClose={() => setCreating(false)}
          onSaved={(count) => {
            setCreating(false);
            setSelected(count.id);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}
