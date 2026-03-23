"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { format, subDays, differenceInDays } from "date-fns";

/* ─────────────────── Types ─────────────────── */

interface KpiData {
  ventasMes: number;
  totalOrdenes: number;
  ticketPromedio: number;
  crecimientoMes: number;
  tasaAnulacion: number;
  ventasMesAnterior: number;
  ticketAnterior: number;
}

interface WeeklyChannelData {
  week: string;
  [channel: string]: string | number;
}

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
  color: string;
}

const TOP_PRODUCT_COLORS = [
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#a78bfa", // purple
  "#f59e0b", // amber
  "#ef4444", // red
  "#3b82f6", // blue
  "#ec4899", // pink
];

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "#ec4899",
  web: "#10b981",
  shopify: "#f59e42",
  marketplace: "#6366f1",
  presencial: "#3b82f6",
};

/* ─────────────────── Component ─────────────────── */

export default function MetricasVentasPage() {
  const { selectedStoreId } = useAuth();
  const [loading, setLoading] = useState(true);

  // Date range
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Data
  const [kpi, setKpi] = useState<KpiData>({
    ventasMes: 0,
    totalOrdenes: 0,
    ticketPromedio: 0,
    crecimientoMes: 0,
    tasaAnulacion: 0,
    ventasMesAnterior: 0,
    ticketAnterior: 0,
  });
  const [weeklyData, setWeeklyData] = useState<WeeklyChannelData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);

  // Handle period change
  const handlePeriodChange = (from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
  };

  // Fetch sales data
  useEffect(() => {
    if (!selectedStoreId || !fromDate || !toDate) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`
        );
        const orders = res.data || [];

        const start = new Date(fromDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);

        // Filter orders for selected period
        const periodOrders = orders.filter((o: any) => {
          const d = new Date(o.created_at);
          return d >= start && d <= end;
        });

        // Previous period for comparison
        const diffDays = differenceInDays(end, start) + 1;
        const prevEnd = subDays(start, 1);
        const prevStart = subDays(prevEnd, diffDays - 1);
        prevEnd.setHours(23, 59, 59, 999);
        prevStart.setHours(0, 0, 0, 0);

        const prevPeriodOrders = orders.filter((o: any) => {
          const d = new Date(o.created_at);
          return d >= prevStart && d <= prevEnd;
        });

        // KPIs
        const ventasMes = periodOrders.reduce(
          (sum: number, o: any) => sum + Number(o.grandTotal || 0),
          0
        );
        const ventasMesAnterior = prevPeriodOrders.reduce(
          (sum: number, o: any) => sum + Number(o.grandTotal || 0),
          0
        );
        const totalOrdenes = periodOrders.length;
        const ticketPromedio = totalOrdenes > 0 ? ventasMes / totalOrdenes : 0;
        const prevOrdenes = prevPeriodOrders.length;
        const ticketAnterior = prevOrdenes > 0 ? ventasMesAnterior / prevOrdenes : 0;

        const crecimientoMes = ventasMesAnterior === 0 
          ? (ventasMes > 0 ? 100 : 0) 
          : Math.round(((ventasMes - ventasMesAnterior) / ventasMesAnterior) * 100);

        const anuladas = periodOrders.filter((o: any) => o.status === "ANULADO").length;
        const tasaAnulacion = totalOrdenes > 0 ? Math.round((anuladas / totalOrdenes) * 100) : 0;

        setKpi({
          ventasMes,
          totalOrdenes,
          ticketPromedio,
          crecimientoMes,
          tasaAnulacion,
          ventasMesAnterior,
          ticketAnterior,
        });

        // Weekly channel breakdown
        const channelMap: Record<string, number[]> = {};
        periodOrders.forEach((o: any) => {
          const d = new Date(o.created_at);
          const dayDiff = differenceInDays(d, start);
          const weekIdx = Math.min(Math.floor(dayDiff / 7), 3);
          const channel = (o.salesChannel || "web").toLowerCase();
          if (!channelMap[channel]) channelMap[channel] = [0, 0, 0, 0];
          channelMap[channel][weekIdx] += Number(o.grandTotal || 0);
        });

        const weeks: WeeklyChannelData[] = [0, 1, 2, 3].map((i) => {
          const row: WeeklyChannelData = { week: `Sem ${i + 1}` };
          Object.entries(channelMap).forEach(([ch, vals]) => {
            row[ch] = Math.round(vals[i]);
          });
          return row;
        });
        setWeeklyData(weeks);

        // Top products
        const productStats: Record<string, { quantity: number; revenue: number }> = {};
        periodOrders.forEach((o: any) => {
          (o.items || []).forEach((item: any) => {
            const name = item.productName || item.name || "Producto";
            if (!productStats[name]) productStats[name] = { quantity: 0, revenue: 0 };
            productStats[name].quantity += Number(item.quantity || 1);
            productStats[name].revenue += Number(item.subtotal || item.price || 0);
          });
        });

        const sorted = Object.entries(productStats)
          .sort(([, a], [, b]) => b.quantity - a.quantity)
          .slice(0, 5)
          .map(([name, stats], idx) => ({
            name: name.length > 25 ? name.substring(0, 22) + "..." : name,
            quantity: stats.quantity,
            revenue: stats.revenue,
            color: TOP_PRODUCT_COLORS[idx % TOP_PRODUCT_COLORS.length],
          }));
        setTopProducts(sorted);
      } catch (error) {
        console.error("Error fetching ventas metrics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedStoreId, fromDate, toDate]);

  // Percentage change helper
  const pctChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const ventasPct = pctChange(kpi.ventasMes, kpi.ventasMesAnterior);
  const ticketPct = pctChange(kpi.ticketPromedio, kpi.ticketAnterior);

  // Channels detected
  const channels = useMemo(() => {
    if (weeklyData.length === 0) return [];
    const keys = Object.keys(weeklyData[0]).filter((k) => k !== "week");
    return keys;
  }, [weeklyData]);


  return (
    <div className="flex flex-col gap-6 p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Ventas</h1>
          <p className="text-xs text-muted-foreground font-semibold tracking-[0.15em] uppercase mt-1">
            Registro y análisis de ventas por canal y producto
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector onPeriodChange={handlePeriodChange} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ventas del mes */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
              Ventas del mes
            </p>
            {ventasPct !== 0 && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  ventasPct > 0
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-red-50 text-red-500"
                }`}
              >
                {ventasPct > 0 ? "+" : ""}
                {ventasPct}%
              </span>
            )}
          </div>
          <p className="text-2xl font-black text-foreground">
            S/ {kpi.ventasMes.toLocaleString("es-PE", { minimumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            {kpi.totalOrdenes} órdenes
          </p>
        </div>

        {/* Ticket promedio */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
              Ticket promedio
            </p>
            {ticketPct !== 0 && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  ticketPct > 0
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-red-50 text-red-500"
                }`}
              >
                {ticketPct > 0 ? "+" : ""}
                {ticketPct}%
              </span>
            )}
          </div>
          <p className="text-2xl font-black text-foreground">
            S/ {Math.round(kpi.ticketPromedio).toLocaleString("es-PE")}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">Por orden</p>
        </div>

        {/* Crecimiento Mensual */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">
            Crecimiento vs mes ant.
          </p>
          <p className={`text-2xl font-black ${kpi.crecimientoMes >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            {kpi.crecimientoMes > 0 ? "+" : ""}{kpi.crecimientoMes}%
          </p>
          <p className="text-xs text-muted-foreground font-semibold mt-0.5">Ingresos vs {kpi.ventasMesAnterior === 0 ? "0" : `S/ ${kpi.ventasMesAnterior.toLocaleString("es-PE", { minimumFractionDigits: 0 })}`}</p>
        </div>

        {/* Tasa Anulación */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">
            Tasa de anulación
          </p>
          <p className="text-2xl font-black text-amber-500">{kpi.tasaAnulacion}%</p>
          <p className="text-xs text-muted-foreground font-semibold mt-0.5">Meta: &lt;10%</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ventas por canal — tendencia semanal */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">
            Ventas por canal — tendencia semanal
          </h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={weeklyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="week"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                  tickFormatter={(v) =>
                    v >= 1000 ? `S/${(v / 1000).toFixed(0)}k` : `S/${v}`
                  }
                />
                <Tooltip
                  formatter={(value: any, name: string) => [
                    `S/ ${Number(value).toLocaleString("es-PE")}`,
                    name.charAt(0).toUpperCase() + name.slice(1),
                  ]}
                  contentStyle={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                />
                <Legend
                  verticalAlign="top"
                  height={30}
                  formatter={(value: string) =>
                    value.charAt(0).toUpperCase() + value.slice(1)
                  }
                  wrapperStyle={{ fontSize: "11px", fontWeight: 600 }}
                />
                {channels.map((ch) => (
                  <Line
                    key={ch}
                    type="monotone"
                    dataKey={ch}
                    stroke={CHANNEL_COLORS[ch] || "#94a3b8"}
                    strokeWidth={2.5}
                    dot={{ r: 4, strokeWidth: 2, fill: "white" }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top productos del mes */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">Top productos del mes</h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : topProducts.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
              Sin datos para el periodo
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={topProducts}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
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
                  tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }}
                  width={120}
                />
                <Tooltip
                  formatter={(value: any, name: string, props: any) => {
                    if (name === "quantity") {
                      return [`${value} unidades`, "Cantidad"];
                    }
                    return [value, name];
                  }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-card border border-border rounded-xl p-3 shadow-lg text-[11px] font-semibold">
                          <p className="text-foreground mb-1">{data.name}</p>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground font-normal">Unidades:</span>
                              <span className="text-foreground">{data.quantity}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground font-normal">Monto:</span>
                              <span className="text-foreground">S/ {Number(data.revenue).toLocaleString("es-PE")}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground font-normal">Porcentaje:</span>
                              <span className="text-emerald-500">
                                {kpi.ventasMes > 0 
                                  ? ((data.revenue / kpi.ventasMes) * 100).toFixed(1) 
                                  : 0}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="quantity" radius={[0, 6, 6, 0]} barSize={28}>
                  {topProducts.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
