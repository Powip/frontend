"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Search,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import { OrderHeader } from "@/interfaces/IOrder";
import AliclikStatusBadge from "@/components/aliclik/AliclikStatusBadge";
import CancelAliclikButton from "@/components/aliclik/CancelAliclikButton";

// ─── TIPOS ──────────────────────────────────────────────────────────────────

type AliclikFilter = "all" | "problem" | "canceled";

// ─── HELPERS ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-PE");
  } catch {
    return iso;
  }
}

function formatSyncedAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ─── CONTADORES POR ESTADO ──────────────────────────────────────────────────

const ALICLIK_STATUS_LABELS: Record<string, string> = {
  TO_PREPARE: "Por preparar",
  IN_TRANSIT: "En tránsito",
  DELIVERED:  "Entregados",
  CANCELED:   "Cancelados",
  RETURNED:   "Devueltos",
  PENDING:    "Pendientes",
  PICKED_UP:  "Recogidos",
};

interface StatusCount {
  status: string;
  label: string;
  count: number;
  colorClass: string;
}

const STATUS_COLORS: Record<string, string> = {
  TO_PREPARE: "bg-amber-100 text-amber-700",
  IN_TRANSIT: "bg-blue-100 text-blue-700",
  DELIVERED:  "bg-green-100 text-green-700",
  CANCELED:   "bg-gray-100 text-gray-600",
  RETURNED:   "bg-red-100 text-red-700",
  PENDING:    "bg-yellow-100 text-yellow-700",
  PICKED_UP:  "bg-indigo-100 text-indigo-700",
};

// ─── COMPONENTE PRINCIPAL ───────────────────────────────────────────────────

export default function AliclikOrderTrackingView() {
  const { auth, selectedStoreId } = useAuth();

  const [orders, setOrders] = useState<OrderHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<AliclikFilter>("all");

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchOrders = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const res = await axios.get<OrderHeader[]>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`,
      );

      const aliclikOnly = res.data
        .filter((o) => o.aliclikDispatchStatus !== null && o.aliclikDispatchStatus !== undefined)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );

      setOrders(aliclikOnly);
    } catch {
      toast.error("Error al cargar pedidos de Aliclik");
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // ── Filtrado ─────────────────────────────────────────────────────────────

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Filtro de búsqueda por número de pedido o cliente
      if (search) {
        const q = search.toLowerCase();
        const matchesNum = order.orderNumber.toLowerCase().includes(q);
        const matchesName = order.customer?.fullName?.toLowerCase().includes(q);
        if (!matchesNum && !matchesName) return false;
      }

      // Filtro por estado Aliclik (selector)
      if (statusFilter && order.aliclikDispatchStatus !== statusFilter) return false;

      // Filtro de tabs internas
      if (activeFilter === "problem") {
        return order.aliclikDispatchStatus === "RETURNED";
      }
      if (activeFilter === "canceled") {
        return order.aliclikDispatchStatus === "CANCELED";
      }

      return true;
    });
  }, [orders, search, statusFilter, activeFilter]);

  // ── Contadores por estado ─────────────────────────────────────────────────

  const statusCounts = useMemo<StatusCount[]>(() => {
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      const s = o.aliclikDispatchStatus ?? "UNKNOWN";
      counts[s] = (counts[s] ?? 0) + 1;
    });
    return Object.entries(counts)
      .filter(([status]) => status !== "UNKNOWN")
      .map(([status, count]) => ({
        status,
        label: ALICLIK_STATUS_LABELS[status] ?? status,
        count,
        colorClass: STATUS_COLORS[status] ?? "bg-purple-100 text-purple-700",
      }))
      .sort((a, b) => b.count - a.count);
  }, [orders]);

  // ── Banners de alerta ─────────────────────────────────────────────────────

  const returnedCount = useMemo(
    () => orders.filter((o) => o.aliclikDispatchStatus === "RETURNED").length,
    [orders],
  );

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Resumen de estados ── */}
      {statusCounts.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 border rounded-xl bg-muted/20">
          {statusCounts.map(({ status, label, count, colorClass }) => (
            <button
              key={status}
              type="button"
              onClick={() =>
                setStatusFilter((prev) => (prev === status ? "" : status))
              }
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all
                ${colorClass}
                ${statusFilter === status ? "ring-2 ring-offset-1 ring-current" : "opacity-90 hover:opacity-100"}
              `}
            >
              <span>{label}</span>
              <span className="bg-white/50 rounded-full px-1.5 py-0.5 font-bold text-[11px]">
                {count}
              </span>
            </button>
          ))}
          {statusFilter && (
            <button
              type="button"
              onClick={() => setStatusFilter("")}
              className="text-xs text-muted-foreground underline self-center ml-1"
            >
              Limpiar filtro
            </button>
          )}
        </div>
      )}

      {/* ── Barra de filtros ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border rounded-xl bg-muted/20">
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Búsqueda rápida</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="N° pedido o cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Estado Aliclik</Label>
          <select
            className="w-full h-9 text-sm border rounded-md px-3 bg-background"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="TO_PREPARE">Por preparar</option>
            <option value="PENDING">Pendiente</option>
            <option value="PICKED_UP">Recogido</option>
            <option value="IN_TRANSIT">En tránsito</option>
            <option value="DELIVERED">Entregado</option>
            <option value="RETURNED">Devuelto</option>
            <option value="CANCELED">Cancelado</option>
          </select>
        </div>
      </div>

      {/* ── Tabs de filtro interno ── */}
      <div className="flex items-center gap-2">
        {(
          [
            { key: "all",      label: "Todos" },
            { key: "problem",  label: "Con problemas" },
            { key: "canceled", label: "Cancelados" },
          ] as { key: AliclikFilter; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveFilter(key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors
              ${
                activeFilter === key
                  ? "bg-foreground text-background border-foreground"
                  : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/60"
              }
            `}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {filteredOrders.length} registro{filteredOrders.length !== 1 ? "s" : ""}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={fetchOrders}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* ── Banner de devueltos ── */}
      {returnedCount > 0 && activeFilter !== "problem" && (
        <div
          role="alert"
          className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-red-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {returnedCount} pedido{returnedCount !== 1 ? "s" : ""} devuelto{returnedCount !== 1 ? "s" : ""} en Aliclik
          </span>
          <Button
            size="sm"
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-100"
            onClick={() => setActiveFilter("problem")}
          >
            Ver devueltos
          </Button>
        </div>
      )}

      {/* ── Tabla ── */}
      <div className="border rounded-xl overflow-hidden bg-background">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-[11px] uppercase font-bold px-4">
                N° Pedido
              </TableHead>
              <TableHead className="text-[11px] uppercase font-bold px-4">
                Cliente
              </TableHead>
              <TableHead className="text-[11px] uppercase font-bold px-4 text-center">
                Estado Aliclik
              </TableHead>
              <TableHead className="text-[11px] uppercase font-bold px-4 text-center">
                Sincronizado
              </TableHead>
              <TableHead className="text-[11px] uppercase font-bold px-4">
                Fecha pedido
              </TableHead>
              <TableHead className="text-[11px] uppercase font-bold px-4 text-right">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell
                    colSpan={6}
                    className="h-12 animate-pulse bg-muted/20"
                  />
                </TableRow>
              ))
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-muted-foreground"
                >
                  No hay pedidos enviados a Aliclik
                  {(search || statusFilter || activeFilter !== "all") && (
                    <span className="block text-xs mt-1">
                      Probá quitando los filtros activos
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow
                  key={order.id}
                  className="hover:bg-muted/30 transition-colors"
                >
                  {/* N° Pedido */}
                  <TableCell className="px-4 py-3 text-xs font-bold font-mono">
                    {order.orderNumber}
                  </TableCell>

                  {/* Cliente */}
                  <TableCell className="px-4 py-3 text-xs max-w-[140px] truncate">
                    {order.customer?.fullName ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Estado Aliclik */}
                  <TableCell className="px-4 py-3 text-center">
                    <AliclikStatusBadge
                      aliclikDispatchStatus={order.aliclikDispatchStatus}
                      aliclikSyncedAt={order.aliclikSyncedAt}
                    />
                  </TableCell>

                  {/* Sincronizado */}
                  <TableCell className="px-4 py-3 text-center">
                    {order.aliclikSyncedAt ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono bg-muted/30"
                      >
                        {formatSyncedAt(order.aliclikSyncedAt)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">—</span>
                    )}
                  </TableCell>

                  {/* Fecha pedido */}
                  <TableCell className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(order.created_at)}
                  </TableCell>

                  {/* Acciones */}
                  <TableCell className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <CancelAliclikButton
                        orderId={order.id}
                        companyId={auth?.company?.id}
                        aliclikDispatchStatus={order.aliclikDispatchStatus}
                        onSuccess={fetchOrders}
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] px-2 gap-1 border-red-200 text-red-600 hover:bg-red-50"
                        label="Cancelar"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
