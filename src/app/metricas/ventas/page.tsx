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
import { ChevronDown } from "lucide-react";

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

  // Month selector
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-based
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

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

  const monthLabel = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth);
    return d.toLocaleDateString("es-PE", { month: "short", year: "numeric" });
  }, [selectedMonth, selectedYear]);

  // Fetch sales data
  useEffect(() => {
    if (!selectedStoreId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`
        );
        const orders = res.data || [];

        // Filter orders for selected month
        const monthOrders = orders.filter((o: any) => {
          const d = new Date(o.created_at);
          return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        });

        // Previous month orders for comparison
        const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
        const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
        const prevMonthOrders = orders.filter((o: any) => {
          const d = new Date(o.created_at);
          return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
        });

        // KPIs
        const ventasMes = monthOrders.reduce(
          (sum: number, o: any) => sum + Number(o.grandTotal || 0),
          0
        );
        const ventasMesAnterior = prevMonthOrders.reduce(
          (sum: number, o: any) => sum + Number(o.grandTotal || 0),
          0
        );
        const totalOrdenes = monthOrders.length;
        const ticketPromedio = totalOrdenes > 0 ? ventasMes / totalOrdenes : 0;
        const prevOrdenes = prevMonthOrders.length;
        const ticketAnterior = prevOrdenes > 0 ? ventasMesAnterior / prevOrdenes : 0;

        const crecimientoMes = ventasMesAnterior === 0 
          ? (ventasMes > 0 ? 100 : 0) 
          : Math.round(((ventasMes - ventasMesAnterior) / ventasMesAnterior) * 100);

        const anuladas = monthOrders.filter((o: any) => o.status === "ANULADO").length;
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

        // Weekly channel breakdown (4 weeks of the month)
        const channelMap: Record<string, number[]> = {};
        monthOrders.forEach((o: any) => {
          const d = new Date(o.created_at);
          const dayOfMonth = d.getDate();
          const weekIdx = Math.min(Math.floor((dayOfMonth - 1) / 7), 3);
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
        const productCount: Record<string, number> = {};
        monthOrders.forEach((o: any) => {
          (o.items || []).forEach((item: any) => {
            const name = item.productName || item.name || "Producto";
            productCount[name] = (productCount[name] || 0) + Number(item.quantity || 1);
          });
        });

        const sorted = Object.entries(productCount)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([name, quantity], idx) => ({
            name: name.length > 25 ? name.substring(0, 22) + "..." : name,
            quantity,
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
  }, [selectedStoreId, selectedMonth, selectedYear]);

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

  // Month navigation
  const handleMonthChange = (direction: number) => {
    let newMonth = selectedMonth + direction;
    let newYear = selectedYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-50/50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Ventas</h1>
          <p className="text-xs text-slate-400 font-semibold tracking-[0.15em] uppercase mt-1">
            Registro y análisis de ventas por canal y producto
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleMonthChange(-1)}
            className="px-2 py-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            ‹
          </button>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700">
            <span className="capitalize">{monthLabel}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <button
            onClick={() => handleMonthChange(1)}
            className="px-2 py-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            ›
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ventas del mes */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
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
          <p className="text-2xl font-black text-slate-800">
            S/ {kpi.ventasMes.toLocaleString("es-PE", { minimumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            {kpi.totalOrdenes} órdenes
          </p>
        </div>

        {/* Ticket promedio */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
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
          <p className="text-2xl font-black text-slate-800">
            S/ {Math.round(kpi.ticketPromedio).toLocaleString("es-PE")}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">Por orden</p>
        </div>

        {/* Crecimiento Mensual */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
            Crecimiento vs mes ant.
          </p>
          <p className={`text-2xl font-black ${kpi.crecimientoMes >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            {kpi.crecimientoMes > 0 ? "+" : ""}{kpi.crecimientoMes}%
          </p>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">Ingresos vs {kpi.ventasMesAnterior === 0 ? "0" : `S/ ${kpi.ventasMesAnterior.toLocaleString("es-PE", { minimumFractionDigits: 0 })}`}</p>
        </div>

        {/* Tasa Anulación */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
            Tasa de anulación
          </p>
          <p className="text-2xl font-black text-amber-500">{kpi.tasaAnulacion}%</p>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">Meta: &lt;10%</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ventas por canal — tendencia semanal */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
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
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Top productos del mes</h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : topProducts.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">
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
                  formatter={(value: any) => [`${value} unidades`, "Cantidad"]}
                  contentStyle={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: "11px",
                    fontWeight: 600,
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
