"use client";

import { useMemo, useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useBusinessOrders } from "@/hooks/useBusinessOrders";
import { fetchCouriers } from "@/services/courierService";
import {
  collectionStatusLabels,
  getCourierSettlements,
  settlementMoney,
  settlementStatusLabels,
  type CourierCollection,
} from "@/services/courierSettlementsService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmCollectionDialog, CreateSettlementDialog } from "./SettlementCreateDialogs";
import { SettlementDetailDialog } from "./SettlementDetailDialog";
import { RegisterLiquidationDialog } from "./RegisterLiquidationDialog";
import { PorLiquidarPanel, canLiquidate } from "./PorLiquidarPanel";
import { buildPendingCollections, collectionDate, fromCents, type PendingCollection } from "./pendingCollections";

type Tab = "pending" | "collections" | "history";
const EMPTY_COLLECTIONS: CourierCollection[] = [];
const isForbidden = (error: unknown) => axios.isAxiosError(error) && error.response?.status === 403;

export function CourierSettlementWorkspace({
  companyId,
  actorId,
}: {
  companyId: string;
  actorId: string;
}) {
  const query = useQuery({
    queryKey: ["courier-settlements", companyId, actorId],
    queryFn: ({ signal }) => getCourierSettlements(companyId, signal),
    retry: false,
  });
  const {
    orders,
    loading: ordersLoading,
    error: ordersError,
    retry: retryOrders,
  } = useBusinessOrders(undefined, undefined, { statuses: ["ENTREGADO"] });
  const couriers = useQuery({
    queryKey: ["settlement-couriers", companyId, actorId],
    queryFn: ({ signal }) => fetchCouriers(companyId, { signal }),
    retry: false,
  });
  const [tab, setTab] = useState<Tab>("pending");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<{ initial?: { orderId: string; amount: number; collectedAt?: string } } | null>(null);
  const [liquidation, setLiquidation] = useState<PendingCollection[] | null>(null);
  const [depositCollections, setDepositCollections] = useState<CourierCollection[] | null>(null);
  const [detail, setDetail] = useState<{ kind: "collections" | "settlements"; id: string } | null>(
    null,
  );
  const data = query.data;
  const forbidden = isForbidden(query.error);
  const savedCollections = data?.collections ?? EMPTY_COLLECTIONS;
  const pendingRows = useMemo(
    () => buildPendingCollections(orders, savedCollections, couriers.data ?? []),
    [orders, savedCollections, couriers.data],
  );
  const pendingByOrder = useMemo(
    () => new Map(pendingRows.filter(canLiquidate).map((row) => [row.orderId, fromCents(row.pendingCents)])),
    [pendingRows],
  );
  const fullyConfirmedOrderIds = useMemo(() => {
    const confirmed = new Map<string, number>();
    for (const item of savedCollections)
      confirmed.set(item.orderId, (confirmed.get(item.orderId) ?? 0) + Math.round(item.amount * 100));
    return new Set(
      orders
        .filter((order) => (confirmed.get(order.id) ?? 0) >= Math.round(Number(order.grandTotal) * 100))
        .map((order) => order.id),
    );
  }, [orders, savedCollections]);
  const selected =
    data?.collections.filter((item) => selectedIds.has(item.id) && item.availableAmount > 0) ?? [];
  const first = selected[0];
  const filter = search.trim().toLocaleLowerCase();
  const collections =
    data?.collections.filter((item) =>
      `${item.orderNumber} ${item.customerName} ${item.courierName}`
        .toLocaleLowerCase()
        .includes(filter),
    ) ?? [];
  const history =
    data?.history.filter((item) =>
      `${item.courierName} ${item.operationNumber ?? ""} ${settlementStatusLabels[item.status]}`
        .toLocaleLowerCase()
        .includes(filter),
    ) ?? [];
  const refresh = () => query.refetch();
  const pendingLoading = ordersLoading || couriers.isPending || (query.isPending && !forbidden);
  const pendingError = ordersError || couriers.isError;
  function toggle(item: CourierCollection) {
    if (
      item.availableAmount <= 0 ||
      (!selectedIds.has(item.id) &&
        first &&
        (first.courierId !== item.courierId || first.currency !== item.currency))
    )
      return;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }
  const tabButton = (value: Tab, label: string) => (
    <Button
      type="button"
      variant={tab === value ? "default" : "outline"}
      aria-pressed={tab === value}
      onClick={() => setTab(value)}
    >
      {label}
    </Button>
  );
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Liquidaciones de courier</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Lo que cada courier cobró en la entrega y todavía te debe, sus depósitos y el historial. La
            entrega no confirma el cobro; los pagos del cliente se verifican por separado en Finanzas.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={query.isFetching}
          onClick={() => {
            void refresh();
            void retryOrders();
            void couriers.refetch();
          }}
        >
          Actualizar
        </Button>
      </header>
      {query.isError && !forbidden ? (
        <div role="alert" className="rounded border p-5">
          No se pudieron cargar las liquidaciones guardadas.{" "}
          <Button type="button" variant="link" onClick={() => void refresh()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          {forbidden && (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Tu usuario no tiene el permiso de Finanzas (Ver finanzas) que exige registrar cobros y
              depósitos. «Por liquidar» se muestra solo para consultar y exportar, y no descuenta los
              cobros que Finanzas ya confirmó.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Vistas de liquidaciones">
              {tabButton("pending", "Por liquidar")}
              {tabButton("collections", data ? `Cobros confirmados (${data.collections.length})` : "Cobros confirmados")}
              {tabButton("history", data ? `Depósitos e historial (${data.history.length})` : "Depósitos e historial")}
            </div>
            {data?.capabilities.canConfirm && (
              <Button
                type="button"
                variant="outline"
                disabled={ordersLoading || ordersError || couriers.isPending || couriers.isError}
                onClick={() => setConfirming({})}
              >
                Confirmar cobro de otro pedido
              </Button>
            )}
          </div>
          {pendingError && (
            <p role="alert" className="text-sm text-amber-700">
              No se pudieron cargar los pedidos entregados o los couriers.{" "}
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  void retryOrders();
                  void couriers.refetch();
                }}
              >
                Reintentar datos
              </Button>
            </p>
          )}
          {tab === "pending" ? (
            pendingLoading ? (
              <p role="status">Cargando pedidos entregados…</p>
            ) : pendingError ? null : (
              <PorLiquidarPanel
                rows={pendingRows}
                readOnly={!data?.capabilities.canConfirm || !data.capabilities.canRegister}
                onConfirm={(row) =>
                  setConfirming({
                    initial: {
                      orderId: row.orderId,
                      amount: fromCents(row.pendingCents),
                      collectedAt: collectionDate(row.updatedAt, new Date().toISOString().slice(0, 10)),
                    },
                  })
                }
                onRegister={(rows) => setLiquidation(rows)}
              />
            )
          ) : forbidden ? (
            <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
              Necesitas el permiso de Finanzas para ver los cobros confirmados y los depósitos.
            </p>
          ) : query.isPending || !data ? (
            <p role="status">Cargando liquidaciones…</p>
          ) : (
            <>
              <Input
                aria-label="Buscar en liquidaciones"
                placeholder={
                  tab === "collections"
                    ? "Buscar pedido, cliente o courier"
                    : "Buscar courier, operación o estado"
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {tab === "collections" ? (
                <>
                  <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                    <p>
                      Cobros ya confirmados. Selecciona cobros del mismo courier y moneda para registrar
                      un depósito; puedes asignar un importe parcial por cobro.
                    </p>
                    {selected.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <span>
                          {selected.length} seleccionados ·{" "}
                          {settlementMoney(
                            selected.reduce((sum, item) => sum + item.availableAmount, 0),
                            first.currency,
                          )}
                        </span>
                        <Button
                          type="button"
                          disabled={!data.capabilities.canRegister || selected.length > 100}
                          onClick={() => setDepositCollections(selected)}
                        >
                          Registrar depósito
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                          Limpiar selección
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="p-3">Seleccionar</th>
                          <th className="p-3">Pedido / cliente</th>
                          <th className="p-3">Courier</th>
                          <th className="p-3">Cobrado</th>
                          <th className="p-3">Liquidado</th>
                          <th className="p-3">En revisión</th>
                          <th className="p-3">Disponible</th>
                          <th className="p-3">Estado</th>
                          <th className="p-3">Detalle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {collections.map((item) => (
                          <tr key={item.id} className="border-t">
                            <td className="p-3">
                              <input
                                type="checkbox"
                                aria-label={`Seleccionar cobro ${item.orderNumber} ${item.id}`}
                                checked={selectedIds.has(item.id) && item.availableAmount > 0}
                                disabled={
                                  !data.capabilities.canRegister ||
                                  item.availableAmount <= 0 ||
                                  (!!first &&
                                    !selectedIds.has(item.id) &&
                                    (first.courierId !== item.courierId ||
                                      first.currency !== item.currency))
                                }
                                onChange={() => toggle(item)}
                              />
                            </td>
                            <td className="p-3">
                              <p className="font-medium">{item.orderNumber}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.customerName} · {item.collectedAt.slice(0, 10)}
                              </p>
                            </td>
                            <td className="p-3">{item.courierName}</td>
                            <td className="p-3">{settlementMoney(item.amount, item.currency)}</td>
                            <td className="p-3">
                              {settlementMoney(item.settledAmount, item.currency)}
                            </td>
                            <td className="p-3">
                              {settlementMoney(item.reservedAmount, item.currency)}
                            </td>
                            <td className="p-3 font-medium">
                              {settlementMoney(item.availableAmount, item.currency)}
                            </td>
                            <td className="p-3">{collectionStatusLabels[item.status]}</td>
                            <td className="p-3">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setDetail({ kind: "collections", id: item.id })}
                              >
                                Ver cobro
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {collections.length === 0 && (
                      <p className="p-8 text-center text-sm text-muted-foreground">
                        No hay cobros confirmados para esta búsqueda. Confírmalos desde «Por liquidar».
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="p-3">Fecha / courier</th>
                        <th className="p-3">Depositado</th>
                        <th className="p-3">Asignado</th>
                        <th className="p-3">Sin asignar</th>
                        <th className="p-3">Diferencia</th>
                        <th className="p-3">Estado</th>
                        <th className="p-3">Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="p-3">
                            <p>
                              {item.date.slice(0, 10)} · {item.courierName}
                            </p>
                            <p className="text-xs text-muted-foreground">{item.operationNumber}</p>
                          </td>
                          <td className="p-3">
                            {settlementMoney(item.amountDeposited, item.currency)}
                          </td>
                          <td className="p-3">
                            {settlementMoney(item.amountAllocated, item.currency)}
                          </td>
                          <td className="p-3">
                            {settlementMoney(item.unallocatedAmount, item.currency)}
                          </td>
                          <td className="p-3">{settlementMoney(item.difference, item.currency)}</td>
                          <td className="p-3">{settlementStatusLabels[item.status]}</td>
                          <td className="p-3">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setDetail({ kind: "settlements", id: item.id })}
                            >
                              Ver depósito
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {history.length === 0 && (
                    <p className="p-8 text-center text-sm text-muted-foreground">
                      No hay depósitos guardados para esta búsqueda.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
          {confirming && data && (
            <ConfirmCollectionDialog
              companyId={companyId}
              orders={orders}
              couriers={couriers.data ?? []}
              pendingByOrder={pendingByOrder}
              excludedOrderIds={fullyConfirmedOrderIds}
              initial={confirming.initial}
              linkedEvidenceIds={data.collections.flatMap((item) =>
                item.providerEvidenceId ? [item.providerEvidenceId] : [],
              )}
              onClose={() => setConfirming(null)}
              onPersisted={refresh}
              onComplete={(item) => {
                setConfirming(null);
                void refresh();
                setDetail({ kind: "collections", id: item.id });
              }}
            />
          )}
          {liquidation && data && (
            <RegisterLiquidationDialog
              companyId={companyId}
              rows={liquidation}
              onClose={() => setLiquidation(null)}
              onPersisted={refresh}
              onComplete={(settlement) => {
                setLiquidation(null);
                setTab("history");
                void refresh();
                setDetail({ kind: "settlements", id: settlement.id });
              }}
            />
          )}
          {depositCollections && data && (
            <CreateSettlementDialog
              companyId={companyId}
              collections={depositCollections}
              onClose={() => setDepositCollections(null)}
              onPersisted={refresh}
              onComplete={(item) => {
                setDepositCollections(null);
                setSelectedIds(new Set());
                setTab("history");
                void refresh();
                setDetail({ kind: "settlements", id: item.id });
              }}
            />
          )}
          {detail && data && (
            <SettlementDetailDialog
              key={`${detail.kind}:${detail.id}`}
              companyId={companyId}
              actorId={actorId}
              kind={detail.kind}
              id={detail.id}
              canReview={data.capabilities.canReconcile}
              canUpload={
                detail.kind === "collections"
                  ? data.capabilities.canConfirm
                  : data.capabilities.canRegister
              }
              onClose={() => setDetail(null)}
              onChanged={refresh}
            />
          )}
        </>
      )}
    </div>
  );
}
