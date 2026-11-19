"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyWarehouses } from "@/hooks/useCompanyWarehouses";
import { invalidateInventoryAlerts } from "@/hooks/useInventoryAlerts";
import { courierAccess, courierStockSummary, lastReadingText, RECONCILIATION_STATUS_CLASS, RECONCILIATION_STATUS_LABEL, syncText } from "@/lib/courier";
import { formatDay } from "@/lib/purchaseOrders";
import { opsErrorMessage } from "@/lib/warehouseOps";
import { getCourierStock, listCourierWarehouses, listReconciliations, type CourierWarehouse } from "@/services/sharedCourierService";
import { ErrorBox, Money, RuleNote, StatusPill } from "../../warehouse-ops/OpsBits";
import ClaimsPanel, { CLAIMS_KEY } from "./ClaimsPanel";
import CourierStockTable from "./CourierStockTable";
import NewReconciliationDialog from "./NewReconciliationDialog";
import ReconciliationPanel, { RECONCILIATION_KEY } from "./ReconciliationPanel";

// FEAT-24 H8 — Inventario › Couriers (mockup vCourier): los almacenes
// compartidos con un courier, su stock POWIP contra courier, la conciliación de
// unidades y los reclamos. Administrador y Operaciones concilian y reclaman;
// Almacén solo mira (sin montos). El courier usa su portal en /almacen.

export const COURIER_WAREHOUSES_KEY = "courier-warehouses";
export const COURIER_STOCK_KEY = "courier-stock";
export const RECONCILIATIONS_KEY = "courier-reconciliations";

interface Props {
  /** Almacén a abrir al entrar (`?almacen=`, desde una alerta). */
  initialInventoryId?: string;
  /** Reclamo a abrir al entrar (`?reclamo=`, desde una alerta). */
  initialClaimId?: string;
}

function Kpi({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "ok" | "warn" | "bad" }) {
  const toneClass = tone === "ok" ? "border-emerald-300" : tone === "warn" ? "border-amber-300" : tone === "bad" ? "border-destructive/60" : "";
  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-base font-semibold">{value}</div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default function CouriersTab({ initialInventoryId, initialClaimId }: Props) {
  const { auth } = useAuth();
  const access = courierAccess(auth?.user);
  const queryClient = useQueryClient();
  const { nameOf } = useCompanyWarehouses();
  const [selectedId, setSelectedId] = useState(initialInventoryId ?? "");
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [claimId, setClaimId] = useState<string | null>(access.manage ? (initialClaimId ?? null) : null);

  const warehousesQuery = useQuery({ queryKey: [COURIER_WAREHOUSES_KEY], queryFn: ({ signal }) => listCourierWarehouses(signal), retry: false });
  const warehouses = warehousesQuery.data ?? [];
  const current: CourierWarehouse | null = warehouses.find((warehouse) => warehouse.id === selectedId) ?? warehouses[0] ?? null;
  const currentId = current?.id ?? "";

  const stockQuery = useQuery({
    queryKey: [COURIER_STOCK_KEY, currentId],
    queryFn: ({ signal }) => getCourierStock(currentId, signal),
    enabled: !!currentId,
    retry: false,
  });
  const historyQuery = useQuery({
    queryKey: [RECONCILIATIONS_KEY, currentId],
    queryFn: ({ signal }) => listReconciliations({ inventoryId: currentId }, signal),
    enabled: !!currentId,
    retry: false,
  });
  const stock = stockQuery.data;
  const openRecId = current?.openReconciliation?.id ?? stock?.openReconciliation?.id ?? null;
  const past = (historyQuery.data ?? []).filter((rec) => rec.id !== openRecId);
  const mode = access.manage ? "manage" : "view";
  // Nombre del almacén: el de la lista courier y, si no, el de la empresa.
  const warehouseName = (inventoryId: string) => warehouses.find((warehouse) => warehouse.id === inventoryId)?.name ?? nameOf(inventoryId);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: [COURIER_WAREHOUSES_KEY] });
    void queryClient.invalidateQueries({ queryKey: [COURIER_STOCK_KEY] });
    void queryClient.invalidateQueries({ queryKey: [RECONCILIATIONS_KEY] });
    void invalidateInventoryAlerts(queryClient);
  };

  if (!access.view)
    return <ErrorBox>Tu rol no ve los almacenes de courier. Lo hacen Administrador, Operaciones y Almacén.</ErrorBox>;

  const summary = stock ? courierStockSummary(stock) : null;

  return (
    <div className="space-y-4">
      <RuleNote>
        <b>Almacén compartido con el courier.</b> El stock del courier llega por API (Aliclik) o porque su personal cuenta en el portal de POWIP. POWIP
        compara su registro con lo que reporta el courier y explica la diferencia por partes. Lo que queda sin explicar pasa a reclamo (cuenta por cobrar al
        courier). El almacenaje del courier es un gasto logístico.
      </RuleNote>

      {warehousesQuery.isError ? <ErrorBox>{opsErrorMessage(warehousesQuery.error, "No se pudieron cargar los almacenes de courier.")}</ErrorBox> : null}
      {warehousesQuery.isPending ? <p className="text-sm text-muted-foreground">Cargando almacenes de courier…</p> : null}
      {warehousesQuery.isSuccess && warehouses.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No tienes almacenes de courier. Crea uno de tipo Courier en{" "}
          <Link href="/configuracion/tiendas" className="underline">
            Configuración › Tiendas y almacenes
          </Link>
          .
        </p>
      ) : null}

      {current ? (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Almacenes de courier">
            {warehouses.map((warehouse) => (
              <Button
                key={warehouse.id}
                type="button"
                size="sm"
                variant={warehouse.id === current.id ? "default" : "outline"}
                aria-pressed={warehouse.id === current.id}
                onClick={() => {
                  setSelectedId(warehouse.id);
                  setViewing(null);
                }}
              >
                {warehouse.name}
                {warehouse.openReconciliation?.unexplainedLines ? (
                  <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold leading-5 text-white" aria-label={`${warehouse.openReconciliation.unexplainedLines} sin explicar`}>
                    {warehouse.openReconciliation.unexplainedLines}
                  </span>
                ) : null}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            <Kpi label="Sincronización" value={syncText(current)} hint={stock ? `Último dato: ${lastReadingText(stock)}` : undefined} />
            <Kpi
              label="Estado"
              value={!summary || !summary.courierKnown ? "Sin dato del courier" : summary.withDifference === 0 ? "Cuadra" : "Con diferencias"}
              hint={summary ? `${summary.withDifference} SKU con diferencia` : undefined}
              tone={!summary || !summary.courierKnown ? undefined : summary.withDifference === 0 ? "ok" : "warn"}
            />
            <Kpi
              label="Conciliación abierta"
              value={current.openReconciliation ? current.openReconciliation.number : "Ninguna"}
              hint={current.openReconciliation ? `${current.openReconciliation.unexplainedLines} SKU sin explicar` : undefined}
              tone={current.openReconciliation?.unexplainedLines ? "warn" : undefined}
            />
            {access.manage ? (
              <Kpi
                label="Reclamos sin cobrar"
                value={`${current.openClaims?.count ?? 0} · ${current.openClaims?.units ?? 0} und`}
                hint={<Money value={current.openClaims && "amount" in current.openClaims ? (current.openClaims.amount ?? null) : current.openClaims ? undefined : 0} />}
                tone={current.openClaims?.count ? "bad" : undefined}
              />
            ) : null}
            <Kpi
              label="Almacenaje"
              value={
                <>
                  <Money value={"storageCostMonth" in current ? (current.storageCostMonth ?? null) : undefined} />
                  {"storageCostMonth" in current && current.storageCostMonth !== null && current.storageCostMonth !== undefined ? " /mes" : ""}
                </>
              }
              hint="Gasto logístico"
            />
          </div>

          <section className="space-y-2" aria-label="Stock POWIP contra courier">
            <h3 className="text-sm font-semibold">Stock: POWIP contra courier</h3>
            {stockQuery.isError ? <ErrorBox>{opsErrorMessage(stockQuery.error, "No se pudo cargar el stock del courier.")}</ErrorBox> : null}
            {stockQuery.isPending ? <p className="text-sm text-muted-foreground">Cargando stock…</p> : null}
            {stock ? <CourierStockTable stock={stock} /> : null}
          </section>

          <section className="space-y-2" aria-label="Conciliación">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Conciliación</h3>
              {access.manage && !openRecId ? (
                <Button type="button" size="sm" onClick={() => setCreating(true)}>
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  Nueva conciliación
                </Button>
              ) : null}
            </div>
            {openRecId ? (
              <ReconciliationPanel
                key={openRecId}
                reconciliationId={openRecId}
                mode={mode}
                warehouseName={current.name}
                onChanged={refresh}
                onClaimed={() => void queryClient.invalidateQueries({ queryKey: [CLAIMS_KEY] })}
                onOpenClaim={access.manage ? setClaimId : undefined}
              />
            ) : (
              <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                No hay una conciliación abierta de {current.name}.{access.manage ? " Crea una para explicar las diferencias." : ""}
              </p>
            )}

            {past.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Conciliaciones anteriores</p>
                <ul className="divide-y rounded-md border">
                  {past.map((rec) => (
                    <li key={rec.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                      <span className="font-mono font-semibold">{rec.number}</span>
                      <StatusPill label={RECONCILIATION_STATUS_LABEL[rec.status] ?? rec.status} className={RECONCILIATION_STATUS_CLASS[rec.status] ?? ""} />
                      <span className="text-muted-foreground">{formatDay(rec.createdAt)}</span>
                      <span className="min-w-0 flex-1 text-muted-foreground">
                        {rec.summary.withDifference} con diferencia · {rec.summary.claimedUnits} und reclamadas
                      </span>
                      <Button type="button" size="sm" variant="outline" onClick={() => setViewing(viewing === rec.id ? null : rec.id)}>
                        {viewing === rec.id ? "Ocultar" : "Ver"}
                      </Button>
                    </li>
                  ))}
                </ul>
                {viewing ? (
                  <ReconciliationPanel key={viewing} reconciliationId={viewing} mode="view" warehouseName={current.name} onOpenClaim={access.manage ? setClaimId : undefined} />
                ) : null}
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {access.manage && (current || claimId) ? (
        <ClaimsPanel
          warehouseName={warehouseName}
          selected={claimId}
          onSelect={setClaimId}
          onChanged={() => {
            void queryClient.invalidateQueries({ queryKey: [COURIER_WAREHOUSES_KEY] });
            void queryClient.invalidateQueries({ queryKey: [RECONCILIATION_KEY] });
            void invalidateInventoryAlerts(queryClient);
          }}
        />
      ) : null}

      {creating && current ? (
        <NewReconciliationDialog
          warehouse={current}
          lastCountId={stock?.lastCount?.id ?? null}
          onClose={() => setCreating(false)}
          onCreated={(created) => {
            setCreating(false);
            queryClient.setQueryData([RECONCILIATION_KEY, created.id], created);
            // Se muestra ya, sin esperar a que vuelva la lista de almacenes.
            queryClient.setQueryData<CourierWarehouse[]>([COURIER_WAREHOUSES_KEY], (list) =>
              list?.map((warehouse) =>
                warehouse.id === created.inventoryId
                  ? { ...warehouse, openReconciliation: { id: created.id, number: created.number, createdAt: created.createdAt, unexplainedLines: created.summary.unexplainedLines } }
                  : warehouse,
              ),
            );
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}
