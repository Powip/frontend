"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { warehouseErrorMessage } from "@/components/forms/warehouseUi";
import { formatPeruDateTime } from "@/components/inventory/movementLabels";
import { receptionsInScope, receptionVariantIds, summarizeReceived } from "@/lib/returnReception";
import { fetchVariantsByIds } from "@/services/variantCodesService";
import {
  listReturnReceptions,
  listWarehouses,
  type ReturnReception,
  type ReturnReceptionStatus,
} from "@/services/warehousesService";
import ReceiveReturnDialog from "./ReceiveReturnDialog";
import { makeVariantLabeler, orderLabel } from "./receptionLabels";

// FEAT-24 H2-F — Inventario › Recepciones: devoluciones que el courier trajo de
// vuelta. Quedan «por recibir» hasta que alguien decide, por producto, qué
// vuelve a stock y qué es merma. Recibir es de quienes editan inventario.

interface Props {
  companyId: string;
  canEdit: boolean;
  /** Almacenes de la tienda seleccionada; `null` = todo el negocio. */
  scopeInventoryIds: readonly string[] | null;
}

export default function ReceptionsTab({ companyId, canEdit, scopeInventoryIds }: Props) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ReturnReceptionStatus>("por_recibir");
  const [receiving, setReceiving] = useState<ReturnReception | null>(null);

  const pendingQuery = useQuery({
    queryKey: ["return-receptions", companyId, "por_recibir"],
    queryFn: () => listReturnReceptions("por_recibir"),
    enabled: Boolean(companyId),
    retry: false,
    staleTime: 0,
  });
  const receivedQuery = useQuery({
    queryKey: ["return-receptions", companyId, "recibida"],
    queryFn: () => listReturnReceptions("recibida"),
    enabled: Boolean(companyId) && status === "recibida",
    retry: false,
    staleTime: 0,
  });
  const warehousesQuery = useQuery({
    queryKey: ["company-warehouses", companyId],
    queryFn: () => listWarehouses(),
    enabled: Boolean(companyId),
    retry: false,
    staleTime: 60_000,
  });

  const pending = useMemo(() => receptionsInScope(pendingQuery.data ?? [], scopeInventoryIds), [pendingQuery.data, scopeInventoryIds]);
  const received = useMemo(() => receptionsInScope(receivedQuery.data ?? [], scopeInventoryIds), [receivedQuery.data, scopeInventoryIds]);
  const variantIds = useMemo(() => receptionVariantIds([...pending, ...received]), [pending, received]);
  // Nombres y SKU de los productos: es un adorno, si falla se muestra el id.
  const variantsQuery = useQuery({
    queryKey: ["reception-variants", companyId, variantIds],
    queryFn: () => fetchVariantsByIds(variantIds, companyId),
    enabled: Boolean(companyId) && variantIds.length > 0,
    retry: false,
    staleTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  });
  const label = useMemo(
    () => makeVariantLabeler(new Map((variantsQuery.data ?? []).map((variant) => [variant.id.toLowerCase(), variant]))),
    [variantsQuery.data],
  );
  const warehouses = useMemo(() => warehousesQuery.data?.warehouses ?? [], [warehousesQuery.data]);
  const warehouseName = (id: string | null) => (id ? warehouses.find((w) => w.id === id)?.name ?? "Almacén desconocido" : "—");

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["return-receptions", companyId] });
    void queryClient.invalidateQueries({ queryKey: ["business-inventory-items"] });
    void queryClient.invalidateQueries({ queryKey: ["inventory-kardex", companyId] });
  };

  const errorBox = (error: unknown, retry: () => void) => (
    <div role="alert" className="rounded-md border border-destructive p-4 text-sm">
      No se pudieron cargar las devoluciones. {warehouseErrorMessage(error, "Inténtalo de nuevo.")}
      <Button variant="outline" size="sm" className="ml-3" onClick={retry}>
        Reintentar
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Las devoluciones que trae el courier quedan <strong>por recibir</strong> y vuelven al stock recién cuando alguien las
        recibe aquí: por cada producto, cuánto vuelve a stock y cuánto es merma (con su motivo). Puedes escanear los productos
        con el lector.
      </p>

      <Tabs value={status} onValueChange={(value) => setStatus(value as ReturnReceptionStatus)}>
        <TabsList>
          <TabsTrigger value="por_recibir" className="gap-2">
            Por recibir
            {pendingQuery.isSuccess ? <Badge variant="secondary">{pending.length}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="recibida">Recibidas</TabsTrigger>
        </TabsList>

        <TabsContent value="por_recibir" className="mt-4">
          {pendingQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Cargando devoluciones…</p>
          ) : pendingQuery.isError ? (
            errorBox(pendingQuery.error, () => void pendingQuery.refetch())
          ) : pending.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-md border border-dashed py-10 text-sm text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-40" aria-hidden="true" />
              Sin devoluciones pendientes.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-2">Pedido</th>
                    <th className="px-4 py-2">Productos</th>
                    <th className="px-4 py-2">Vuelve a</th>
                    <th className="px-4 py-2">Devuelto</th>
                    <th className="px-4 py-2" aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {pending.map((reception) => (
                    <tr key={reception.id} className="border-t align-top" data-testid={`reception-${reception.id}`}>
                      <td className="px-4 py-3 font-mono font-semibold">{orderLabel(reception)}</td>
                      <td className="px-4 py-3">
                        <ul className="space-y-1">
                          {reception.lines.map((line) => {
                            const text = label(line.variantId);
                            return (
                              <li key={line.variantId}>
                                <span>{text.name}</span> <span className="font-medium">× {line.quantity}</span>
                                {text.detail ? <span className="block text-xs text-muted-foreground">{text.detail}</span> : null}
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                      <td className="px-4 py-3">{warehouseName(reception.inventoryId)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatPeruDateTime(reception.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        {canEdit ? (
                          <Button size="sm" aria-label={`Recibir ${orderLabel(reception)}`} onClick={() => setReceiving(reception)}>
                            Recibir
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!canEdit && pending.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">Recibir devoluciones es de Administración y Operaciones.</p>
          ) : null}
        </TabsContent>

        <TabsContent value="recibida" className="mt-4">
          {receivedQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Cargando devoluciones…</p>
          ) : receivedQuery.isError ? (
            errorBox(receivedQuery.error, () => void receivedQuery.refetch())
          ) : received.length === 0 ? (
            <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
              Todavía no hay devoluciones recibidas.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-2">Pedido</th>
                    <th className="px-4 py-2">Cómo se recibió</th>
                    <th className="px-4 py-2">Reingresó a</th>
                    <th className="px-4 py-2">Recibida</th>
                  </tr>
                </thead>
                <tbody>
                  {received.map((reception) => (
                    <tr key={reception.id} className="border-t align-top" data-testid={`received-${reception.id}`}>
                      <td className="px-4 py-3 font-mono font-semibold">{orderLabel(reception)}</td>
                      <td className="px-4 py-3">
                        <ul className="space-y-1">
                          {summarizeReceived(reception.receivedLines).map((row) => (
                            <li key={row.variantId}>
                              <span>{label(row.variantId).name}</span>
                              {row.reingreso > 0 ? <span className="ml-2 text-teal-700 dark:text-teal-300">{row.reingreso} a stock</span> : null}
                              {row.merma > 0 ? (
                                <span className="ml-2 text-destructive">
                                  {row.merma} merma{row.reasons.length ? ` (${row.reasons.join("; ")})` : ""}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-4 py-3">{warehouseName(reception.receivedInventoryId ?? reception.inventoryId)}</td>
                      <td className="px-4 py-3">
                        <span className="whitespace-nowrap">{reception.receivedAt ? formatPeruDateTime(reception.receivedAt) : "—"}</span>
                        {reception.receivedByName || reception.receivedBy ? (
                          <span className="block text-xs text-muted-foreground">por {reception.receivedByName || reception.receivedBy}</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {receiving ? (
        <ReceiveReturnDialog
          key={receiving.id}
          reception={receiving}
          companyId={companyId}
          warehouses={warehouses}
          label={label}
          onClose={() => setReceiving(null)}
          onReceived={() => {
            setReceiving(null);
            refreshAll();
          }}
          onConflict={() => void queryClient.invalidateQueries({ queryKey: ["return-receptions", companyId] })}
        />
      ) : null}
    </div>
  );
}
