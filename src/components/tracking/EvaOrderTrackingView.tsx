"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Search, RefreshCw } from "lucide-react";
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
import EvaStatusBadge, {
  STATUS_LABEL,
  STATUS_GROUP,
  GROUP_CLS,
} from "@/components/eva/EvaStatusBadge";

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

interface StatusCount {
  status: string;
  label: string;
  count: number;
  colorClass: string;
}

// ─── COMPONENTE PRINCIPAL ───────────────────────────────────────────────────

export default function EvaOrderTrackingView() {
  const { selectedStoreId } = useAuth();

  const [orders, setOrders] = useState<OrderHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchOrders = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const res = await axios.get<OrderHeader[]>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`,
      );

      const evaOnly = res.data
        .filter((o) => o.evaStatus !== null && o.evaStatus !== undefined)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );

      setOrders(evaOnly);
    } catch {
      toast.error("Error al cargar pedidos de EVA Courier");
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

      // Filtro por estado EVA (selector)
      if (statusFilter && order.evaStatus !== statusFilter) return false;

      return true;
    });
  }, [orders, search, statusFilter]);

  // ── Contadores por estado ─────────────────────────────────────────────────

  const statusCounts = useMemo<StatusCount[]>(() => {
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      const s = o.evaStatus ?? "UNKNOWN";
      counts[s] = (counts[s] ?? 0) + 1;
    });
    return Object.entries(counts)
      .filter(([status]) => status !== "UNKNOWN")
      .map(([status, count]) => ({
        status,
        label: STATUS_LABEL[status] ?? status,
        count,
        colorClass: GROUP_CLS[STATUS_GROUP[status] ?? "progreso"],
      }))
      .sort((a, b) => b.count - a.count);
  }, [orders]);

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
          <Label className="text-xs font-semibold">Estado EVA</Label>
          <select
            className="w-full h-9 text-sm border rounded-md px-3 bg-background"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABEL).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Contador y refresco ── */}
      <div className="flex items-center gap-2">
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
                Estado EVA
              </TableHead>
              <TableHead className="text-[11px] uppercase font-bold px-4 text-center">
                Sincronizado
              </TableHead>
              <TableHead className="text-[11px] uppercase font-bold px-4">
                Fecha pedido
              </TableHead>
              <TableHead className="text-[11px] uppercase font-bold px-4">
                Tracking EVA
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
                  No hay pedidos enviados a EVA Courier
                  {(search || statusFilter) && (
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

                  {/* Estado EVA */}
                  <TableCell className="px-4 py-3 text-center">
                    <EvaStatusBadge
                      evaStatus={order.evaStatus}
                      evaSyncedAt={order.evaSyncedAt}
                    />
                  </TableCell>

                  {/* Sincronizado */}
                  <TableCell className="px-4 py-3 text-center">
                    {order.evaSyncedAt ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono bg-muted/30"
                      >
                        {formatSyncedAt(order.evaSyncedAt)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">—</span>
                    )}
                  </TableCell>

                  {/* Fecha pedido */}
                  <TableCell className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(order.created_at)}
                  </TableCell>

                  {/* Tracking EVA */}
                  <TableCell className="px-4 py-3 text-xs font-mono">
                    {order.evaTrackingId ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
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
