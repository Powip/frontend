"use client";

import { OperationsDataError } from "@/app/operaciones/_shared/OperationsDataError";
import { useBusinessOrders } from "@/hooks/useBusinessOrders";
import { useBusinessGuides } from "@/hooks/useBusinessGuides";

import { useEffect, useMemo, useState } from "react";
import axios from "@/lib/axiosAuth";
import { toast } from "sonner";
import { AlertTriangle, Eye, Loader2, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useOperationsRole, OPS_PERMISSIONS } from "@/contexts/OperationsRoleContext";
import {
  GUIDE_STATUS_LABEL,
  GUIDE_STATUS_BADGE_CLASS,
  GuideStatus,
} from "@/constants/operationsDomain";
import GuideDetailsModal, { ShippingGuide } from "@/components/modals/GuideDetailsModal";
import { guideShippingCost } from "./guideShippingCost";

/* -----------------------------------------------------------------------
   Guías Activas — tabla de guías de la tienda con filtros por estado
   (los 8 estados reales, no solo 4) y por courier, más alerta de guías
   estancadas en CREADA hace más de 24h. El detalle/gestión de cada guía
   se abre en GuideDetailsModal, reutilizado tal cual.
------------------------------------------------------------------------ */
const ALL_STATUSES = Object.keys(GUIDE_STATUS_LABEL) as GuideStatus[];

// No existe en `GUIDE_AGE_THRESHOLDS` (ese umbral es para envejecimiento de
// agencia, un concepto distinto) — este es específico de esta pantalla.
const STALE_CREADA_HOURS = 24;
const ITEMS_PER_PAGE = 15;

function money(n?: number | null): string {
  if (n === undefined || n === null) return "-";
  return `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function hoursSince(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
}

export default function GuiasActivasTab() {
  const { can } = useOperationsRole();
  const canManageGuides = can(OPS_PERMISSIONS.MANAGE_GUIDES);

  const guideQuery = useBusinessGuides<ShippingGuide>();
  const orderQuery = useBusinessOrders();
  const guides = useMemo(() => [...guideQuery.guides].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [guideQuery.guides]);
  const loading = guideQuery.loading || orderQuery.loading;
  const error = guideQuery.error || orderQuery.error;
  const load = () => Promise.all([guideQuery.refetch(), orderQuery.refetch()]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [courierFilter, setCourierFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  // La fecha de venta se resuelve desde los pedidos del mismo alcance.
  // Respaldo del costo de la guía: suma de carrierShippingCost de sus pedidos (FEAT-26).
  const ordersById = useMemo(
    () => new Map(orderQuery.orders.map((order) => [order.id, order])),
    [orderQuery.orders],
  );
  const saleDates = useMemo(() => {
    const dates = new Map(orderQuery.orders.map((order) => [order.id, order.created_at]));
    return Object.fromEntries(guides.map((guide) => [guide.id, dates.get(guide.orderIds?.[0]) ?? null]));
  }, [guides, orderQuery.orders]);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsGuideId, setDetailsGuideId] = useState<string | null>(null);

  const courierOptions = useMemo(() => {
    const names = new Set<string>();
    guides.forEach((g) => {
      if (g.courierName) names.add(g.courierName);
    });
    return Array.from(names).sort();
  }, [guides]);

  const staleGuides = useMemo(
    () => guides.filter((g) => g.status === "CREADA" && hoursSince(g.created_at) > STALE_CREADA_HOURS),
    [guides],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guides.filter((g) => {
      if (statusFilter !== "ALL" && g.status !== statusFilter) return false;
      if (courierFilter !== "ALL" && (g.courierName || "Sin asignar") !== courierFilter) return false;
      if (!q) return true;
      return (
        g.guideNumber?.toLowerCase().includes(q) ||
        (g.courierName || "").toLowerCase().includes(q)
      );
    });
  }, [guides, search, statusFilter, courierFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, courierFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const pagedGuides = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  const openDetails = (guideId: string) => {
    setDetailsGuideId(guideId);
    setDetailsOpen(true);
  };

  if (error) return <OperationsDataError retry={load} message="No se pudieron cargar las guías." />;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando guías…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {staleGuides.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <p className="text-amber-800 dark:text-amber-200">
            <b>{staleGuides.length}</b> guía(s) llevan más de {STALE_CREADA_HOURS}h en estado{" "}
            <b>{GUIDE_STATUS_LABEL.CREADA}</b> sin aprobarse ni asignar courier.{" "}
            <button
              className="font-semibold underline underline-offset-2"
              onClick={() => setStatusFilter("CREADA")}
            >
              Ver solo esas
            </button>
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por N° guía o courier…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {GUIDE_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={courierFilter} onValueChange={setCourierFilter}>
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="Courier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los couriers</SelectItem>
            {courierOptions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="gap-2" onClick={load}>
          <RefreshCw className="h-4 w-4" /> Actualizar
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">N° Guía</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Courier</th>
                <th className="px-3 py-2 text-center">Pedidos</th>
                <th className="px-3 py-2">Zonas</th>
                <th className="px-3 py-2 text-right">Por cobrar</th>
                <th className="px-3 py-2 text-right">Costo envío</th>
                <th className="px-3 py-2">Fecha de Venta</th>
                <th className="px-3 py-2">Fecha de Envío</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-muted-foreground">
                    No hay guías para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                pagedGuides.map((g) => {
                  const isStale = g.status === "CREADA" && hoursSince(g.created_at) > STALE_CREADA_HOURS;
                  return (
                    <tr key={g.id} className={`border-t hover:bg-muted/30 ${isStale ? "bg-amber-50/60 dark:bg-amber-500/5" : ""}`}>
                      <td className="px-3 py-2 font-semibold">
                        {g.guideNumber}
                        {isStale && (
                          <AlertTriangle className="ml-1.5 inline h-3.5 w-3.5 text-amber-600" />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge className={`border ${GUIDE_STATUS_BADGE_CLASS[g.status]}`}>
                          {GUIDE_STATUS_LABEL[g.status]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{g.courierName || "Sin asignar"}</td>
                      <td className="px-3 py-2 text-center tabular-nums">{g.orderIds?.length ?? 0}</td>
                      <td className="px-3 py-2">
                        {(() => {
                          const zones = g.deliveryZones ?? [];
                          const hasProvincia = zones.includes("PROVINCIAS");
                          const hasLima = zones.some((z) => z !== "PROVINCIAS");
                          if (!hasProvincia && !hasLima) {
                            return <span className="text-xs text-muted-foreground">-</span>;
                          }
                          return (
                            <div className="flex flex-wrap gap-1">
                              {hasLima && (
                                <Badge variant="outline" className="text-[11px]">
                                  Lima
                                </Badge>
                              )}
                              {hasProvincia && (
                                <Badge variant="outline" className="text-[11px]">
                                  Provincia
                                </Badge>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-600">
                        {money(g.amountToCollect)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {money(guideShippingCost(g, ordersById))}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                        {saleDates[g.id]
                          ? new Date(saleDates[g.id]!).toLocaleDateString("es-PE")
                          : "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(g.created_at).toLocaleDateString("es-PE")}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5"
                          onClick={() => openDetails(g.id)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {canManageGuides ? "Gestionar" : "Ver"}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={filtered.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setPage}
          itemName="guías"
        />
      </div>

      <GuideDetailsModal
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        guideId={detailsGuideId || undefined}
        onGuideUpdated={load}
      />
    </div>
  );
}
