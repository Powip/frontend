"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { CheckCircle2, Eye, MessageCircle, Receipt, RefreshCw, Search as SearchIcon } from "lucide-react";
import {
  SalesTableFilters,
  SalesFilters,
  emptySalesFilters,
  applyFilters,
} from "@/components/ventas/SalesTableFilters";
import { BulkStatusSelect } from "@/components/ventas/BulkStatusSelect";
import { OPS_PERMISSIONS } from "@/config/operationsPermissions";
import { GUIDE_AGE_THRESHOLDS, DELIVERY_ZONES } from "@/constants/operationsDomain";
import {
  ITEMS_PER_PAGE,
  PedidosActions,
  Sale,
  computeBulkAvailableStatuses,
  daysSince,
  money,
} from "./types";
import { DiasBadge } from "./shared";

type ViewMode = "pedido" | "guia";

const ZONE_MAP = new Map(DELIVERY_ZONES.map((z) => [z.value, z]));

/** "Estado" por fila — mismo criterio que ShipmentBadge de Centro de Envíos. */
function shipmentState(sale: Sale): { label: string; className: string } {
  if (!sale.guideNumber) {
    return { label: "Sin guía", className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" };
  }
  if (sale.shalomStatus === "DEVUELTO") {
    return { label: "Devuelto", className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" };
  }
  if (sale.shalomStatus === "ENTREGADO") {
    return { label: "Por confirmar", className: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300" };
  }
  if (sale.shalomStatus === "EN_DESTINO") {
    return { label: "En agencia", className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" };
  }
  return { label: "En tránsito", className: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" };
}

/**
 * Pestaña "En Camino" — pedidos EN_ENVIO sin fallo de courier reportado.
 * Soporta vista por pedido (tabla plana, con selección múltiple) o por guía
 * (agrupado por `guideNumber`, con sus propias columnas de zona/salida/estado).
 */
export function EnCaminoTab({
  sales,
  actions,
  initialSearch,
  initialQf,
}: {
  sales: Sale[];
  actions: PedidosActions;
  initialSearch?: string;
  initialQf?: string;
}) {
  const [filters, setFilters] = useState<SalesFilters>({
    ...emptySalesFilters,
    search: initialSearch ?? "",
  });
  const [qf, setQf] = useState(
    initialQf === "agencia-por-vencer" || initialQf === "por-confirmar" ? initialQf : "",
  );
  const [courierChip, setCourierChip] = useState<string>("");
  const [antiguedad, setAntiguedad] = useState<"" | "7" | "15">("");
  const [view, setView] = useState<ViewMode>("pedido");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [syncing, setSyncing] = useState(false);

  const courierOptions = useMemo(() => {
    const set = new Set<string>(actions.apiCouriers);
    for (const s of sales) if (s.courier) set.add(s.courier);
    return Array.from(set).sort();
  }, [sales, actions.apiCouriers]);

  const mas15Dias = useMemo(() => sales.filter((s) => daysSince(s.createdAt) > 15), [sales]);

  const byQf = useMemo(() => {
    if (qf === "agencia-por-vencer") {
      return sales.filter(
        (s) => s.shalomStatus === "EN_DESTINO" && daysSince(s.updatedAt) >= GUIDE_AGE_THRESHOLDS.proximoDias,
      );
    }
    if (qf === "por-confirmar") {
      return sales.filter((s) => s.shalomStatus === "ENTREGADO" && s.status !== "ENTREGADO");
    }
    if (qf === "mas-15-dias") return mas15Dias;
    return sales;
  }, [sales, qf, mas15Dias]);

  const byCourier = useMemo(
    () => (courierChip ? byQf.filter((s) => s.courier === courierChip) : byQf),
    [byQf, courierChip],
  );

  const byAntiguedad = useMemo(() => {
    if (!antiguedad) return byCourier;
    const min = Number(antiguedad);
    return byCourier.filter((s) => daysSince(s.createdAt) >= min);
  }, [byCourier, antiguedad]);

  const filtered = useMemo(() => applyFilters(byAntiguedad, filters), [byAntiguedad, filters]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const canChangeStatus = actions.can(OPS_PERMISSIONS.CHANGE_STATUS_MANUAL);
  const selectedSales = filtered.filter((s) => selectedIds.has(s.id));
  const bulkStatuses = useMemo(() => computeBulkAvailableStatuses(selectedSales), [selectedSales]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllPage = () => {
    setSelectedIds((prev) => {
      const allSelected = paged.every((s) => prev.has(s.id));
      const next = new Set(prev);
      paged.forEach((s) => (allSelected ? next.delete(s.id) : next.add(s.id)));
      return next;
    });
  };

  const byGuide = useMemo(() => {
    const map = new Map<string, Sale[]>();
    for (const s of filtered) {
      const key = s.guideNumber || "Sin guía";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await Promise.resolve(actions.onSyncCourier());
    } finally {
      setTimeout(() => setSyncing(false), 600);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setCourierChip("")}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${courierChip === "" ? "border-violet-500 bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"}`}
          >
            Todos ({byQf.length})
          </button>
          {courierOptions.map((c) => (
            <button
              key={c}
              onClick={() => setCourierChip(courierChip === c ? "" : c)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${courierChip === c ? "border-violet-500 bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"}`}
            >
              {c} ({byQf.filter((s) => s.courier === c).length})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-0.5">
          <button
            onClick={() => setView("pedido")}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${view === "pedido" ? "bg-violet-600 text-white" : "text-muted-foreground"}`}
          >
            Por pedido
          </button>
          <button
            onClick={() => setView("guia")}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${view === "guia" ? "bg-violet-600 text-white" : "text-muted-foreground"}`}
          >
            Por guía
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={antiguedad}
          onChange={(e) => setAntiguedad(e.target.value as "" | "7" | "15")}
          className="h-9 rounded-md border bg-background px-2.5 text-xs"
        >
          <option value="">Cualquier antigüedad</option>
          <option value="7">Más de 7 días</option>
          <option value="15">Más de 15 días</option>
        </select>
        <Button size="sm" variant="outline" className="ml-auto h-9 gap-1.5 text-xs" disabled={syncing} onClick={handleSync}>
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          Sincronizar con courier
        </Button>
      </div>

      <SalesTableFilters
        filters={filters}
        onFiltersChange={(f) => {
          setFilters(f);
          setPage(1);
        }}
        showZoneFilter
        availableCouriers={actions.apiCouriers}
      />

      {mas15Dias.length > 0 && qf !== "mas-15-dias" && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <span>⏱️</span>
          <div className="flex-1">
            <b>{mas15Dias.length} pedidos llevan más de 15 días en tránsito.</b> Cualquier cosa arriba de 15 días
            probablemente ya está trabada aunque el courier no lo haya reportado.
          </div>
          <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={() => setQf("mas-15-dias")}>
            Ver solo esos {mas15Dias.length}
          </Button>
        </div>
      )}

      {view === "pedido" ? (
        <>
          {selectedSales.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
              <span className="text-xs font-semibold text-muted-foreground">{selectedSales.length} seleccionados</span>
              {canChangeStatus && (
                <BulkStatusSelect
                  selectedCount={selectedSales.length}
                  availableStatuses={bulkStatuses}
                  onStatusChange={(status) => actions.onBulkStatusChange(Array.from(selectedIds), status)}
                  isLoading={actions.isBulkLoading}
                />
              )}
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => actions.onBulkWhatsApp(selectedSales)}>
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp masivo
              </Button>
              {actions.can(OPS_PERMISSIONS.EXPORT) && (
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => actions.onExportExcel(selectedSales, "en_camino")}>
                  Exportar Excel
                </Button>
              )}
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
            <Table>
              <TableHeader className="bg-muted/60">
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox checked={paged.length > 0 && paged.every((s) => selectedIds.has(s.id))} onCheckedChange={toggleAllPage} />
                  </TableHead>
                  <TableHead>N° Orden</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Distrito</TableHead>
                  <TableHead>Guía</TableHead>
                  <TableHead>Courier</TableHead>
                  <TableHead>Días</TableHead>
                  <TableHead>Total / Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                      Sin pedidos en camino
                    </TableCell>
                  </TableRow>
                )}
                {paged.map((sale) => {
                  const state = shipmentState(sale);
                  return (
                    <TableRow key={sale.id}>
                      <TableCell>
                        <Checkbox checked={selectedIds.has(sale.id)} onCheckedChange={() => toggle(sale.id)} />
                      </TableCell>
                      <TableCell className="font-medium">{sale.orderNumber}</TableCell>
                      <TableCell>
                        <div className="font-medium">{sale.clientName}</div>
                        <div className="text-xs text-muted-foreground">{sale.phoneNumber}</div>
                      </TableCell>
                      <TableCell className="text-sm">{sale.district || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {sale.guideNumber ? (
                          <button className="font-semibold text-violet-600 underline hover:text-violet-700" onClick={() => actions.onOpenGuide(sale)}>
                            {sale.guideNumber}
                          </button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{sale.courier || "—"}</TableCell>
                      <TableCell>
                        <DiasBadge days={daysSince(sale.createdAt)} />
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {money(sale.total)}
                        {sale.pendingPayment > 0 && (
                          <div className="text-xs font-semibold text-red-600">Saldo {money(sale.pendingPayment)}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${state.className}`}>
                          {state.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {canChangeStatus && (
                            <Button
                              size="sm"
                              className="h-7 gap-1 bg-green-600 text-xs font-semibold text-white hover:bg-green-700"
                              onClick={() => actions.onChangeStatus(sale.id, "ENTREGADO")}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Entregado
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Ver pedido" onClick={() => actions.onView(sale)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Rastrear" onClick={() => actions.onView(sale)}>
                            <SearchIcon className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Comprobante" onClick={() => actions.onOpenReceipt(sale)}>
                            <Receipt className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="WhatsApp" onClick={() => actions.onWhatsApp(sale)}>
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={filtered.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setPage}
            itemName="pedidos"
          />
        </>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <Table>
            <TableHeader className="bg-muted/60">
              <TableRow>
                <TableHead>N° Guía</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Pedidos</TableHead>
                <TableHead>Zonas</TableHead>
                <TableHead>Por cobrar</TableHead>
                <TableHead>Salió</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byGuide.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    Sin guías en camino
                  </TableCell>
                </TableRow>
              )}
              {byGuide.map(([guideNumber, group]) => {
                const zones = Array.from(new Set(group.map((s) => s.zone).filter(Boolean))) as string[];
                const porCobrar = group.reduce((sum, s) => sum + s.pendingPayment, 0);
                const salio = group.reduce<string | null>((min, s) => (!min || s.updatedAt < min ? s.updatedAt : min), null);
                const conIncidencias = group.some((s) => s.shalomStatus === "DEVUELTO");
                const porConfirmar = !conIncidencias && group.every((s) => s.shalomStatus === "ENTREGADO");
                const estadoGrupo = conIncidencias ? "Con incidencias" : porConfirmar ? "Por confirmar" : "En tránsito";
                const estadoClass = conIncidencias
                  ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                  : porConfirmar
                  ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300";
                return (
                  <TableRow key={guideNumber}>
                    <TableCell className="font-medium">
                      {guideNumber !== "Sin guía" ? (
                        <button className="font-semibold text-violet-600 underline hover:text-violet-700" onClick={() => actions.onOpenGuide(group[0])}>
                          {guideNumber}
                        </button>
                      ) : (
                        "Sin guía"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{group[0].courier || "—"}</TableCell>
                    <TableCell className="text-sm">
                      <b>{group.length} pedido(s)</b>
                      <div className="text-xs text-muted-foreground">
                        {group.slice(0, 2).map((s) => s.orderNumber).join(", ")}
                        {group.length > 2 ? `, +${group.length - 2}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {zones.length === 0
                        ? "—"
                        : zones.slice(0, 2).map((z) => (
                            <span key={z} className="mr-1 inline-block rounded-full bg-muted px-1.5 py-0.5">
                              {ZONE_MAP.get(z)?.emoji} {ZONE_MAP.get(z)?.label ?? z}
                            </span>
                          ))}
                      {zones.length > 2 && <span className="text-muted-foreground">+{zones.length - 2}</span>}
                    </TableCell>
                    <TableCell className="text-sm font-semibold tabular-nums text-red-600">{money(porCobrar)}</TableCell>
                    <TableCell className="text-sm">{salio ? new Date(salio).toLocaleDateString("es-PE") : "—"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${estadoClass}`}>
                        {estadoGrupo}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {canChangeStatus && (
                          <Button
                            size="sm"
                            className="h-7 gap-1 bg-green-600 text-xs font-semibold text-white hover:bg-green-700"
                            onClick={() => actions.onBulkStatusChange(group.map((s) => s.id), "ENTREGADO")}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Marcar entregada
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Ver guía" onClick={() => actions.onOpenGuide(group[0])}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="WhatsApp masivo" onClick={() => actions.onBulkWhatsApp(group)}>
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
