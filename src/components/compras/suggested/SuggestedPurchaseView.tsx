"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Info, Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { warehouseErrorMessage } from "@/components/forms/warehouseUi";
import { useAuth } from "@/contexts/AuthContext";
import { useMyWarehouses } from "@/hooks/useMyWarehouses";
import { newOperationId, purchaseAccess } from "@/lib/purchaseOrders";
import {
  COVERAGE_TONE_CLASS,
  coverageText,
  DEFAULT_COVERAGE_DAYS,
  coverageTone,
  DEFAULT_SALES_DAYS,
  formatVd,
  generateSelection,
  groupKeyOf,
  groupSelection,
  groupSupplierOf,
  itemLabel,
  lineAmount,
  lineProblem,
  lineState,
  lineUnits,
  parseDays,
  purchaseOrderHref,
  purchaseUnitLabel,
  type GroupSuppliers,
  type LineEdits,
} from "@/lib/suggestedPurchase";
import { listPurchaseSuppliers } from "@/services/purchasesService";
import {
  generateSuggestedPurchase,
  getSuggestedPurchase,
  type GenerateSuggestedResult,
  type SuggestedPurchaseFilters,
  type SuggestedPurchaseGroup,
} from "@/services/suggestedPurchaseService";
import { getInventoryRules, listWarehouses } from "@/services/warehousesService";
import { cn } from "@/lib/utils";
import { Money, PurchasesNav, SELECT_CLASS } from "../PurchaseBits";

// FEAT-24 H13-D3 — Compras › Pedido sugerido (mockup v6 `mSugerido`): lo que se
// va a acabar según la venta diaria, el mínimo, lo ya pedido y lo que llega por
// traslado, agrupado por el último proveedor. Las cantidades se editan en la
// unidad de compra y «Generar órdenes de compra» crea una OC en borrador por
// proveedor (solo Administrador u Operaciones). Sin rol de costos la API omite
// los costos y se muestra «••••».

/** Columnas de la tabla (casilla + 12 datos). */
const COLUMNS = 13;

/** Lo que se tipea en los filtros numéricos (se aplica al salir del campo o con Enter). */
interface DaysDraft {
  days: string;
  targetDays: string;
}

const daysText = (value: number | undefined) => (value ? String(value) : "");

export default function SuggestedPurchaseView({ initialFilters = {} }: { initialFilters?: SuggestedPurchaseFilters }) {
  const { auth } = useAuth();
  // Al cambiar de empresa o de usuario la pantalla empieza de cero (mismo criterio que el resto de Compras).
  return <SuggestedPurchaseScreen key={`${auth?.company?.id ?? ""}:${auth?.user?.id ?? ""}`} initialFilters={initialFilters} />;
}

function SuggestedPurchaseScreen({ initialFilters }: { initialFilters: SuggestedPurchaseFilters }) {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const userId = auth?.user?.id ?? "";
  const access = purchaseAccess(auth?.user);
  // El servidor deja generar a Administrador u Operaciones: los mismos que ven costos.
  const canGenerate = access.canSeeCosts;
  const queryClient = useQueryClient();
  const myWarehouses = useMyWarehouses();

  const [filters, setFilters] = useState<SuggestedPurchaseFilters>(() => ({ days: DEFAULT_SALES_DAYS, ...initialFilters }));
  const [draft, setDraft] = useState<DaysDraft>(() => ({
    days: daysText(initialFilters.days ?? DEFAULT_SALES_DAYS),
    targetDays: daysText(initialFilters.targetDays),
  }));
  const [edits, setEdits] = useState<LineEdits>({});
  const [groupSuppliers, setGroupSuppliers] = useState<GroupSuppliers>({});
  const [destination, setDestination] = useState<string | null>(null);
  // Clave de idempotencia: la misma en cada reintento hasta que una generación sale bien.
  const [operationKey, setOperationKey] = useState(newOperationId);
  const [result, setResult] = useState<GenerateSuggestedResult | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const suggestionQuery = useQuery({
    queryKey: ["suggested-purchase", companyId, userId, filters],
    queryFn: ({ signal }) => getSuggestedPurchase(filters, signal),
    enabled: !!companyId,
    retry: false,
  });
  const suppliersQuery = useQuery({
    queryKey: ["purchase-suppliers", companyId, "active"],
    queryFn: ({ signal }) => listPurchaseSuppliers(false, signal),
    enabled: !!companyId,
    retry: false,
  });
  const warehousesQuery = useQuery({
    queryKey: ["company-warehouses", companyId],
    queryFn: () => listWarehouses(),
    enabled: !!companyId,
    retry: false,
  });
  const rulesQuery = useQuery({
    queryKey: ["inventory-rules", companyId],
    queryFn: () => getInventoryRules(),
    enabled: !!companyId,
    retry: false,
  });

  const data = suggestionQuery.data;
  // Datos nuevos (otros filtros o después de generar): la edición vuelve a lo sugerido.
  useEffect(() => {
    setEdits({});
    setGroupSuppliers({});
  }, [data]);

  const allowCourier = rulesQuery.data?.allowPurchaseToCourier ?? false;
  const ruleTargetDays = rulesQuery.data?.defaultCoverageDays;
  const activeWarehouses = useMemo(
    () => myWarehouses.visible((warehousesQuery.data?.warehouses ?? []).filter((warehouse) => warehouse.status)),
    [warehousesQuery.data, myWarehouses],
  );
  // A dónde llegan las OC: un almacén activo que el usuario opera (courier solo si la regla lo permite).
  const destinations = useMemo(
    () => myWarehouses.operable(activeWarehouses.filter((warehouse) => warehouse.type !== "COURIER" || allowCourier)),
    [activeWarehouses, myWarehouses, allowCourier],
  );
  const defaultDestination = useMemo(() => {
    if (filters.inventoryId && destinations.some((warehouse) => warehouse.id === filters.inventoryId)) return filters.inventoryId;
    return (destinations.find((warehouse) => warehouse.is_main) ?? destinations[0])?.id ?? "";
  }, [destinations, filters.inventoryId]);
  const destinationId = destination !== null && destinations.some((warehouse) => warehouse.id === destination) ? destination : defaultDestination;

  const suppliers = suppliersQuery.data ?? [];
  const selection = useMemo(() => generateSelection(data, edits, groupSuppliers), [data, edits, groupSuppliers]);
  const targetDays = data?.targetDays ?? filters.targetDays ?? ruleTargetDays ?? DEFAULT_COVERAGE_DAYS;

  const applyDays = (key: keyof DaysDraft) => {
    const raw = draft[key].trim();
    if (key === "targetDays" && raw === "") {
      setFilters((current) => ({ ...current, targetDays: undefined }));
      return;
    }
    const value = parseDays(raw);
    if (value === null) return;
    setFilters((current) => (current[key] === value ? current : { ...current, [key]: value }));
  };
  const daysProblem = (key: keyof DaysDraft) => {
    const raw = draft[key].trim();
    if (key === "targetDays" && raw === "") return null;
    return parseDays(raw) === null ? "De 1 a 365 días." : null;
  };

  const setLine = (variantId: string, patch: { quantity?: string; selected?: boolean }) => {
    setGenerateError(null);
    setEdits((current) => ({ ...current, [variantId]: { ...current[variantId], ...patch } }));
  };

  const generate = useMutation({
    mutationFn: () =>
      generateSuggestedPurchase(
        { lines: selection.lines, ...(destinationId ? { inventoryId: destinationId } : {}) },
        operationKey,
      ),
    onSuccess: (generated) => {
      setResult(generated);
      setGenerateError(null);
      setOperationKey(newOperationId());
      const count = generated.purchaseOrders.length;
      if (generated.duplicate) toast.info("Esa generación ya estaba registrada: son las mismas órdenes.");
      else toast.success(count === 1 ? "Se creó 1 orden de compra en borrador" : `Se crearon ${count} órdenes de compra en borrador`);
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders", companyId] });
      void queryClient.invalidateQueries({ queryKey: ["suggested-purchase", companyId] });
    },
    onError: (error) => setGenerateError(warehouseErrorMessage(error, "No se pudieron generar las órdenes de compra. Inténtalo de nuevo.")),
  });

  const loading = suggestionQuery.isPending && !!companyId;
  const groups = data?.groups ?? [];

  return (
    <div className="w-full px-4 pb-6 md:px-6">
      <HeaderConfig title="Compras" description="Pedido sugerido según la venta, el mínimo y lo ya pedido" />
      <div className="mb-4">
        <PurchasesNav />
      </div>

      <div className="mb-4 flex gap-2 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          <strong className="text-foreground">Cantidad sugerida</strong> = venta diaria × días a cubrir + mínimo − disponible − ya pedido − en
          camino, redondeada a la unidad de compra. Lo que está en órdenes en borrador no resta: se muestra para que no lo pidas dos veces.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Pedido sugerido
          </CardTitle>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-1">
              <Label htmlFor="sg-warehouse">Almacén</Label>
              <select
                id="sg-warehouse"
                className={SELECT_CLASS}
                value={filters.inventoryId ?? ""}
                onChange={(e) => setFilters((current) => ({ ...current, inventoryId: e.target.value || undefined }))}
              >
                <option value="">Todos mis almacenes</option>
                {activeWarehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sg-days">Venta de los últimos</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="sg-days"
                  inputMode="numeric"
                  className="w-24"
                  value={draft.days}
                  aria-invalid={!!daysProblem("days") || undefined}
                  onChange={(e) => setDraft((current) => ({ ...current, days: e.target.value }))}
                  onBlur={() => applyDays("days")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyDays("days");
                  }}
                />
                <span className="text-sm">días</span>
              </div>
              {daysProblem("days") ? <p className="text-xs text-destructive">{daysProblem("days")}</p> : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="sg-target">Cubrir</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="sg-target"
                  inputMode="numeric"
                  className="w-24"
                  placeholder={String(ruleTargetDays ?? DEFAULT_COVERAGE_DAYS)}
                  value={draft.targetDays}
                  aria-invalid={!!daysProblem("targetDays") || undefined}
                  onChange={(e) => setDraft((current) => ({ ...current, targetDays: e.target.value }))}
                  onBlur={() => applyDays("targetDays")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyDays("targetDays");
                  }}
                />
                <span className="text-sm">días de venta</span>
              </div>
              <p className={cn("text-xs", daysProblem("targetDays") ? "text-destructive" : "text-muted-foreground")}>
                {daysProblem("targetDays") ?? "Vacío = la regla de la empresa."}
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sg-supplier">Proveedor</Label>
              <select
                id="sg-supplier"
                className={SELECT_CLASS}
                value={filters.supplierId ?? ""}
                onChange={(e) => setFilters((current) => ({ ...current, supplierId: e.target.value || undefined }))}
              >
                <option value="">Todos los proveedores</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 self-end pb-2">
              <Checkbox
                id="sg-without-sales"
                checked={filters.includeWithoutSales === true}
                onCheckedChange={(checked) => setFilters((current) => ({ ...current, includeWithoutSales: checked === true || undefined }))}
              />
              <Label htmlFor="sg-without-sales" className="font-normal">
                Incluir sin ventas bajo el mínimo
              </Label>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {suggestionQuery.error ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              {warehouseErrorMessage(suggestionQuery.error, "No se pudo calcular el pedido sugerido.")}
              <Button type="button" size="sm" variant="outline" onClick={() => void suggestionQuery.refetch()}>
                Reintentar
              </Button>
            </div>
          ) : null}

          {data ? (
            <p className="text-sm text-muted-foreground" data-testid="sg-summary">
              Venta de los últimos {data.days} días · cubrir {data.targetDays} días
              {data.totals.variants ? ` · ${data.totals.variants} ${data.totals.variants === 1 ? "producto" : "productos"} por pedir` : ""}
            </p>
          ) : null}
          {data && data.skipped.notInCatalog > 0 ? (
            <p className="flex gap-1 text-xs text-muted-foreground" data-testid="sg-skipped">
              <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {data.skipped.notInCatalog === 1
                ? "1 producto no se muestra porque ya no está activo en tu catálogo (inactivo, unificado o con IMEI/serie)."
                : `${data.skipped.notInCatalog} productos no se muestran porque ya no están activos en tu catálogo (inactivos, unificados o con IMEI/serie).`}
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="p-2" />
                  <th className="p-2 text-left">Producto</th>
                  <th className="p-2 text-right" title="Unidades vendidas por día en la ventana">Venta diaria</th>
                  <th className="p-2 text-right">Cobertura</th>
                  <th className="p-2 text-right">Disponible</th>
                  <th className="p-2 text-right">Mínimo</th>
                  <th className="p-2 text-right" title="Órdenes emitidas sin recibir">Ya pedido</th>
                  <th className="p-2 text-right" title="Llegando por traslado">En camino</th>
                  <th className="p-2 text-right" title="En órdenes en borrador: no resta">En borradores</th>
                  <th className="p-2 text-left">Pedir</th>
                  <th className="p-2 text-right">Unidades</th>
                  <th className="p-2 text-right" title="Último costo sin IGV por unidad">Costo últ.</th>
                  <th className="p-2 text-right">Monto est.</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(4)].map((_, index) => (
                    <tr key={index} className="border-t">
                      <td colSpan={COLUMNS} className="p-2">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : groups.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS} className="p-8 text-center text-muted-foreground">
                      {data
                        ? "No hay nada que pedir con estos filtros. Prueba con más días a cubrir o incluye los productos sin ventas bajo el mínimo."
                        : "—"}
                    </td>
                  </tr>
                ) : (
                  groups.map((group) => (
                    <GroupRows
                      key={groupKeyOf(group)}
                      group={group}
                      edits={edits}
                      supplierId={groupSupplierOf(group, groupSuppliers)}
                      suppliers={suppliers}
                      targetDays={targetDays}
                      onSupplier={(supplierId) => {
                        setGenerateError(null);
                        setGroupSuppliers((current) => ({ ...current, [groupKeyOf(group)]: supplierId }));
                      }}
                      onLine={setLine}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {groups.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3 md:flex-row md:items-end md:justify-between">
              <div className="space-y-1 text-sm">
                <p className="font-medium" data-testid="sg-selection">
                  {selection.orders} {selection.orders === 1 ? "orden" : "órdenes"} · {selection.products}{" "}
                  {selection.products === 1 ? "producto" : "productos"} · {selection.units.toLocaleString("es-PE")} und
                </p>
                <p className="text-muted-foreground">
                  Monto estimado sin IGV: <Money value={selection.amount} />
                </p>
              </div>
              {canGenerate ? (
                <div className="flex flex-col gap-2 md:flex-row md:items-end">
                  <div className="space-y-1">
                    <Label htmlFor="sg-destination">Las órdenes llegan a</Label>
                    <select
                      id="sg-destination"
                      className={`${SELECT_CLASS} md:w-60`}
                      value={destinationId}
                      disabled={generate.isPending}
                      onChange={(e) => setDestination(e.target.value)}
                    >
                      {destinations.length === 0 ? <option value="">El almacén principal</option> : null}
                      {destinations.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="button"
                    disabled={!!selection.problem || generate.isPending}
                    onClick={() => {
                      setGenerateError(null);
                      generate.mutate();
                    }}
                  >
                    {generate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Generar órdenes de compra
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Solo el Administrador u Operaciones pueden generar órdenes de compra.</p>
              )}
            </div>
          ) : null}

          {canGenerate && groups.length > 0 && selection.problem ? (
            <p className="text-sm text-muted-foreground" data-testid="sg-problem">
              {selection.problem}
            </p>
          ) : null}
          {generateError ? (
            <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              {generateError}
            </div>
          ) : null}
          {result ? <GenerateResult result={result} onClose={() => setResult(null)} /> : null}
        </CardContent>
      </Card>
    </div>
  );
}

interface GroupRowsProps {
  group: SuggestedPurchaseGroup;
  edits: LineEdits;
  supplierId: string;
  suppliers: Array<{ id: string; name: string }>;
  targetDays: number;
  onSupplier: (supplierId: string) => void;
  onLine: (variantId: string, patch: { quantity?: string; selected?: boolean }) => void;
}

function GroupRows({ group, edits, supplierId, suppliers, targetDays, onSupplier, onLine }: GroupRowsProps) {
  const totals = groupSelection(group, edits);
  const title = group.supplierId ? group.supplierName || "Proveedor" : "Sin proveedor";
  const inactive = group.supplierId !== null && group.supplierActive === false;
  return (
    <Fragment>
      <tr className="border-t bg-muted/30" data-testid={`sg-group-${groupKeyOf(group)}`}>
        <td colSpan={COLUMNS} className="p-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide">{title}</span>
            {inactive ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Inactivo</span>
            ) : null}
            {!group.supplierId ? <span className="text-xs text-muted-foreground">Nunca se compraron</span> : null}
            <span className="text-xs text-muted-foreground">
              {totals.products} {totals.products === 1 ? "producto" : "productos"} · <Money value={totals.amount} />
            </span>
            <span className="ml-auto flex items-center gap-2">
              <Label htmlFor={`sg-buy-${groupKeyOf(group)}`} className="text-xs font-normal">
                Comprar a
              </Label>
              <select
                id={`sg-buy-${groupKeyOf(group)}`}
                aria-label={`Comprar a (${title})`}
                className={`${SELECT_CLASS} h-8 w-52`}
                value={supplierId}
                onChange={(e) => onSupplier(e.target.value)}
              >
                <option value="">Elige el proveedor</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </span>
          </div>
        </td>
      </tr>
      {group.items.map((item) => {
        const state = lineState(item, edits);
        const units = lineUnits(item, state.quantity);
        const problem = lineProblem(item, state.quantity);
        const label = itemLabel(item);
        const tone = coverageTone(item.coverageDays, targetDays);
        return (
          <tr key={item.variantId} className={cn("border-t align-top", !state.selected && "text-muted-foreground")}>
            <td className="p-2">
              <Checkbox
                aria-label={`Incluir ${label}`}
                checked={state.selected}
                onCheckedChange={(checked) => onLine(item.variantId, { selected: checked === true })}
              />
            </td>
            <td className="p-2">
              <div className="font-medium">{label}</div>
              {item.sku ? <div className="font-mono text-xs text-muted-foreground">{item.sku}</div> : null}
            </td>
            <td className="p-2 text-right tabular-nums">{formatVd(item.vd)}</td>
            <td className={cn("p-2 text-right tabular-nums whitespace-nowrap", COVERAGE_TONE_CLASS[tone])} data-testid={`sg-coverage-${item.variantId}`}>
              {coverageText(item.coverageDays)}
            </td>
            <td className={cn("p-2 text-right tabular-nums", item.available <= 0 && "text-destructive")}>{item.available}</td>
            <td className="p-2 text-right tabular-nums">{item.minStock}</td>
            <td className="p-2 text-right tabular-nums">{item.pendingPurchase || "—"}</td>
            <td className="p-2 text-right tabular-nums">{item.incomingTransfer || "—"}</td>
            <td className="p-2 text-right tabular-nums" data-testid={`sg-drafts-${item.variantId}`}>
              {item.draftQuantity ? <span className="text-amber-700 dark:text-amber-400">{item.draftQuantity}</span> : "—"}
            </td>
            <td className="p-2">
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Pedir: ${label}`}
                  className="h-8 w-20 text-right"
                  inputMode="numeric"
                  value={state.quantity}
                  aria-invalid={!!problem || undefined}
                  onChange={(e) => onLine(item.variantId, { quantity: e.target.value })}
                />
                <span className="whitespace-nowrap text-xs text-muted-foreground">{purchaseUnitLabel(item)}</span>
              </div>
              {problem ? <p className="text-xs text-destructive">{problem}</p> : null}
            </td>
            <td className="p-2 text-right tabular-nums" data-testid={`sg-units-${item.variantId}`}>
              {units ?? "—"}
            </td>
            <td className="p-2 text-right">
              <Money value={item.lastUnitCost} decimals={4} />
            </td>
            <td className="p-2 text-right" data-testid={`sg-amount-${item.variantId}`}>
              <Money value={lineAmount(item, units)} />
            </td>
          </tr>
        );
      })}
    </Fragment>
  );
}

function GenerateResult({ result, onClose }: { result: GenerateSuggestedResult; onClose: () => void }) {
  const count = result.purchaseOrders.length;
  return (
    <div
      role="status"
      className={cn(
        "space-y-2 rounded-md border p-3 text-sm",
        result.duplicate
          ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
      )}
    >
      <p className="flex items-center gap-2 font-medium">
        {result.duplicate ? <AlertTriangle className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
        {result.duplicate
          ? "Esta generación ya estaba registrada: no se crearon órdenes nuevas. Son las mismas de antes."
          : count === 1
            ? "Se creó 1 orden de compra en borrador. Revísala y emítela."
            : `Se crearon ${count} órdenes de compra en borrador. Revísalas y emítelas.`}
      </p>
      <ul className="space-y-1">
        {result.purchaseOrders.map((order) => (
          <li key={order.id} className="flex flex-wrap items-center gap-2">
            <Link href={purchaseOrderHref(order.id)} className="font-mono font-semibold underline underline-offset-2">
              {order.number}
            </Link>
            <span>{order.supplierName ?? "Proveedor"}</span>
            <span className="text-xs opacity-80">
              · {order.lines?.length ?? 0} {(order.lines?.length ?? 0) === 1 ? "producto" : "productos"}
            </span>
          </li>
        ))}
      </ul>
      <Button type="button" size="sm" variant="ghost" onClick={onClose}>
        Cerrar
      </Button>
    </div>
  );
}
