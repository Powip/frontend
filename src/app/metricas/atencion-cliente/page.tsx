"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
} from "recharts";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { HeadphonesIcon, TrendingUp, CheckCircle2 } from "lucide-react";

/* ─────────────────── Constants ─────────────────── */

const STATUS_COLORS = [
  "#10b981", // confirmad
  "#f59e0b", // reprogramado (llamado)
  "#ec4899", // no contesta (pendiente)
  "#6366f1", // anulado
];

const UPSELL_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b"];

/* ─────────────────── Component ─────────────────── */

export default function MetricasAtencionClientePage() {
  const { selectedStoreId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);

  // Date range
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const handlePeriodChange = (from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
  };

  const periodDates = useMemo(() => {
    if (!fromDate || !toDate) return { from: new Date(), to: new Date() };
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }, [fromDate, toDate]);

  // Fetch
  useEffect(() => {
    if (!selectedStoreId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`,
        );
        setOrders(res.data || []);
      } catch (error) {
        console.error("Error fetching gestion pedidos data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedStoreId, fromDate, toDate]);

  // ── Data Memoization ──

  const targetOrders = useMemo(() => {
    if (!fromDate || !toDate) return orders;
    return orders.filter((o) => {
      const d = new Date(o.created_at);
      return d >= periodDates.from && d <= periodDates.to;
    });
  }, [orders, periodDates, fromDate, toDate]);

  // Pending to be managed (Backlog)
  const preparadosCount = useMemo(() => {
    return targetOrders.filter((o) => o.status === "PREPARADO").length;
  }, [targetOrders]);

  // Managed (Already passed PREPARADO or PENDIENTE)
  const managedOrders = useMemo(() => {
    // Actually, "no contesta" is PENDIENTE, but let's count anything that the agent might interact with.
    // Usually, agents grab PREPARADO and change them. If they are LLAMADO, CONFIRMADO, etc, they are managed.
    return targetOrders.filter((o) => o.status !== "PREPARADO");
  }, [targetOrders]);

  // Confirmados = PAGADO, ENTREGADO, EN_ENVIO, CON_GUIA, CONFIRMADO...
  const confirmadosCount = useMemo(() => {
    return managedOrders.filter((o) =>
      ["ENTREGADO", "PAGADO", "EN_ENVIO", "CON_GUIA"].includes(o.status),
    ).length;
  }, [managedOrders]);

  // Tasa de Confirmación
  const tasaConfirmacion = useMemo(() => {
    if (managedOrders.length === 0) return 0;
    return Math.round((confirmadosCount / managedOrders.length) * 100);
  }, [confirmadosCount, managedOrders]);

  // Upselling Data
  const upsellOrders = useMemo(() => {
    return managedOrders.filter((o) => o.items && o.items.length > 1);
  }, [managedOrders]);

  const tasaUpselling = useMemo(() => {
    if (managedOrders.length === 0) return 0;
    return Math.round((upsellOrders.length / managedOrders.length) * 100);
  }, [upsellOrders, managedOrders]);

  const ingresoUpselling = useMemo(() => {
    return upsellOrders.reduce((acc, o) => {
      const items = o.items || [];
      if (items.length <= 1) return acc;
      const extraValue = items
        .slice(1)
        .reduce(
          (s: number, i: any) => s + Number(i.subtotal || i.price || 0),
          0,
        );
      return acc + extraValue;
    }, 0);
  }, [upsellOrders]);

  // ── Status distribution (Donut) ──
  const statusDistribution = useMemo(() => {
    const p = targetOrders.filter((o) => o.status === "PENDIENTE").length;
    const l = targetOrders.filter((o) => o.status === "LLAMADO").length;
    const a = targetOrders.filter((o) => o.status === "ANULADO").length;
    const c = confirmadosCount;

    return [
      { name: "Confirmados", value: c, color: STATUS_COLORS[0] },
      { name: "Reprogramados", value: l, color: STATUS_COLORS[1] },
      { name: "No Contesta", value: p, color: STATUS_COLORS[2] },
      { name: "Anulados", value: a, color: STATUS_COLORS[3] },
    ].filter((item) => item.value > 0);
  }, [targetOrders, confirmadosCount]);

  // ── Top 5 Upsell Products ──
  const topUpsellProducts = useMemo(() => {
    const counts: Record<string, number> = {};
    upsellOrders.forEach((o) => {
      const items = o.items || [];
      // Assume the first is the main product, the rest are upsells
      for (let i = 1; i < items.length; i++) {
        const name = items[i].name || items[i].title || "Producto Desconocido";
        counts[name] = (counts[name] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value], idx) => ({
        name: name.length > 18 ? name.substring(0, 16) + "..." : name,
        value,
        color: UPSELL_COLORS[idx % UPSELL_COLORS.length],
      }));
  }, [upsellOrders]);

  // ── Agent Performance Table ──
  const agentPerformance = useMemo(() => {
    const map: Record<
      string,
      {
        total: number;
        confirmed: number;
        upsellCount: number;
        upsellRev: number;
      }
    > = {};

    managedOrders.forEach((o) => {
      const agent = o.sellerName || o.userId || "Agente Desconocido";
      if (!map[agent]) {
        map[agent] = { total: 0, confirmed: 0, upsellCount: 0, upsellRev: 0 };
      }
      map[agent].total++;
      if (["ENTREGADO", "PAGADO", "EN_ENVIO", "CON_GUIA"].includes(o.status)) {
        map[agent].confirmed++;
      }
      if (o.items && o.items.length > 1) {
        map[agent].upsellCount++;
        map[agent].upsellRev += o.items
          .slice(1)
          .reduce(
            (s: number, i: any) => s + Number(i.subtotal || i.price || 0),
            0,
          );
      }
    });

    return Object.entries(map)
      .map(([name, stats]) => ({
        name: name.length > 15 ? name.substring(0, 15) : name,
        total: stats.total,
        confirmRate:
          stats.total > 0
            ? Math.round((stats.confirmed / stats.total) * 100)
            : 0,
        upsellRate:
          stats.total > 0
            ? Math.round((stats.upsellCount / stats.total) * 100)
            : 0,
        upsellRev: stats.upsellRev,
      }))
      .sort((a, b) => b.confirmRate - a.confirmRate);
  }, [managedOrders]);

  return (
    <div className="flex flex-col gap-6 p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            Gestión de Pedidos & Upselling
          </h1>
          <p className="text-xs text-muted-foreground font-semibold tracking-[0.15em] uppercase mt-1">
            Métricas de confirmación y retención (Exención de Tickets)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector onPeriodChange={handlePeriodChange} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Backlog */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm relative overflow-hidden group">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">
            Pedidos por Gestionar
          </p>
          <p className="text-2xl font-black text-foreground">
            {loading ? "—" : preparadosCount}
          </p>
          <p className="text-xs text-amber-500 font-semibold mt-0.5">
            En cola de llamadas
          </p>
          <div className="absolute right-[-10px] top-[-10px] bg-amber-50 dark:bg-amber-900/10 rounded-full p-4 opacity-50 transition-transform group-hover:scale-110">
            <HeadphonesIcon className="h-8 w-8 text-amber-200 dark:text-amber-800" />
          </div>
        </div>

        {/* Efectividad Confirmacion */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm relative overflow-hidden group">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">
            Tasa de Confirmación
          </p>
          <p className="text-2xl font-black text-emerald-500">
            {loading ? "—" : `${tasaConfirmacion}%`}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            De {managedOrders.length} gestionados
          </p>
          <div className="absolute right-[-10px] top-[-10px] bg-emerald-50 dark:bg-emerald-900/10 rounded-full p-4 opacity-50 transition-transform group-hover:scale-110">
            <CheckCircle2 className="h-8 w-8 text-emerald-200 dark:text-emerald-800" />
          </div>
        </div>

        {/* Upsell Rate */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm relative overflow-hidden group">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">
            Tasa de Upselling
          </p>
          <p className="text-2xl font-black text-foreground">
            {loading ? "—" : `${tasaUpselling}%`}
          </p>
          <p className="text-xs text-indigo-500 font-semibold mt-0.5">
            Logrado en su gestión
          </p>
          <div className="absolute right-[-10px] top-[-10px] bg-indigo-50 dark:bg-indigo-900/10 rounded-full p-4 opacity-50 transition-transform group-hover:scale-110">
            <TrendingUp className="h-8 w-8 text-indigo-200 dark:text-indigo-800" />
          </div>
        </div>

        {/* Upsell Revenue */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">
            Ingreso por Upsell
          </p>
          <p className="text-2xl font-black text-emerald-500">
            {loading
              ? "—"
              : `S/ ${ingresoUpselling.toLocaleString("es-PE", { minimumFractionDigits: 0 })}`}
          </p>
          <p className="text-xs text-emerald-600 font-semibold mt-0.5">
            Valor bruto rescatado
          </p>
        </div>
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estado Gestiones */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">
            Estado de Gestiones
          </h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : statusDistribution.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
              Sin datos
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={260}>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {statusDistribution.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: string) => [
                      `${value} pedidos`,
                      name,
                    ]}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-3 flex-1">
                {statusDistribution.map((s, idx) => (
                  <div key={idx} className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="text-xs text-foreground font-medium">
                        {s.name}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-muted-foreground ml-5">
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Top Upsells */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">
            Top Productos Añadidos (Upsell)
          </h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : topUpsellProducts.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
              No hay upselling registrado
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={topUpsellProducts}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#64748b", fontWeight: 500 }}
                  width={110}
                />
                <Tooltip
                  formatter={(value: any) => [`${value} uds.`, "Vendidos"]}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
                  {topUpsellProducts.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 2: Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded">
            Rendimiento por Confirmador (Agentes)
          </h3>
        </div>
        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : agentPerformance.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Sin datos de performance.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/30 border-b border-border/50">
                  <th className="text-left text-[10px] text-muted-foreground font-bold uppercase tracking-wider py-3 px-5">
                    Agente
                  </th>
                  <th className="text-center text-[10px] text-muted-foreground font-bold uppercase tracking-wider py-3 px-4">
                    Asignados
                  </th>
                  <th className="text-center text-[10px] text-muted-foreground font-bold uppercase tracking-wider py-3 px-4">
                    Confirmación
                  </th>
                  <th className="text-center text-[10px] text-muted-foreground font-bold uppercase tracking-wider py-3 px-4">
                    Tasa Upsell
                  </th>
                  <th className="text-right text-[10px] text-muted-foreground font-bold uppercase tracking-wider py-3 px-5">
                    Rev. Upsell
                  </th>
                </tr>
              </thead>
              <tbody>
                {agentPerformance.map((a, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors last:border-0"
                  >
                    <td className="py-3 px-5 text-sm font-semibold text-foreground flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 flex items-center justify-center text-xs font-bold uppercase">
                        {a.name.substring(0, 2)}
                      </div>
                      {a.name}
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-muted-foreground font-medium">
                      {a.total}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${a.confirmRate >= 60 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"}`}
                      >
                        {a.confirmRate}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-sm font-bold text-foreground">
                        {a.upsellRate}%
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right font-bold text-emerald-600 dark:text-emerald-500 text-sm">
                      S/{" "}
                      {a.upsellRev.toLocaleString("es-PE", {
                        minimumFractionDigits: 0,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
