"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { format, differenceInDays, subMonths, startOfMonth, endOfMonth, isSameMonth } from "date-fns";

/* ─────────────────── Constants ─────────────────── */

const FREQ_COLORS = ["#0d9488", "#3b82f6", "#a78bfa", "#cbd5e1"];

const MONTH_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

/* ─────────────────── Component ─────────────────── */

export default function MetricasClientesPage() {
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

  useEffect(() => {
    if (!selectedStoreId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`
        );
        setOrders(res.data || []);
      } catch (error) {
        console.error("Error fetching clientes data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedStoreId, fromDate, toDate]);

  // Filter orders for the period
  const periodOrders = useMemo(
    () =>
      orders.filter((o) => {
        const d = new Date(o.created_at);
        return d >= periodDates.from && d <= periodDates.to;
      }),
    [orders, periodDates]
  );

  // ── Build customer map ──
  const customerMap = useMemo(() => {
    const map: Record<
      string,
      { firstOrder: Date; orderCount: number; totalSpent: number }
    > = {};

    periodOrders.forEach((o: any) => {
      const cId =
        o.customer?.documentNumber ||
        o.customer?.phoneNumber ||
        o.customer?.fullName ||
        o.id;
      if (!cId) return;

      if (!map[cId]) {
        map[cId] = {
          firstOrder: new Date(o.created_at),
          orderCount: 0,
          totalSpent: 0,
        };
      }
      map[cId].orderCount++;
      map[cId].totalSpent += parseFloat(o.grandTotal || "0");

      const orderDate = new Date(o.created_at);
      if (orderDate < map[cId].firstOrder) {
        map[cId].firstOrder = orderDate;
      }
    });

    return map;
  }, [periodOrders]);

  // ── KPIs ──
  const totalClientes = Object.keys(customerMap).length;

  // Clientes este mes
  const thisMonth = new Date();
  const clientesEsteMes = useMemo(() => {
    const from = periodDates.from;
    const to = periodDates.to;
    return Object.values(customerMap).filter((c) => {
      return c.firstOrder >= from && c.firstOrder <= to;
    }).length;
  }, [customerMap, periodDates]);

  // Tasa de recompra: customers with >1 order / total
  const tasaRecompra = useMemo(() => {
    const total = Object.keys(customerMap).length;
    if (total === 0) return 0;
    const recompra = Object.values(customerMap).filter(
      (c) => c.orderCount > 1
    ).length;
    return Math.round((recompra / total) * 100);
  }, [customerMap]);

  // LTV Estimado: avg total spent per customer
  const ltv = useMemo(() => {
    const customers = Object.values(customerMap);
    if (customers.length === 0) return 0;
    const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0);
    return Math.round(totalRevenue / customers.length);
  }, [customerMap]);

  // Frecuencia media de compra: Total Pedidos / Total Clientes
  const frecuenciaMedia = useMemo(() => {
    if (totalClientes === 0) return 0;
    const totalPedidos = Object.values(customerMap).reduce((s, c) => s + c.orderCount, 0);
    return Number((totalPedidos / totalClientes).toFixed(1));
  }, [customerMap, totalClientes]);

  // ── Nuevos vs Recurrentes por mes ──
  const monthlyData = useMemo(() => {
    const data: { month: string; nuevos: number; recurrentes: number }[] = [];
    
    // Calculate months between fromDate and toDate
    const start = startOfMonth(periodDates.from);
    const end = startOfMonth(periodDates.to);
    
    let current = start;
    while (current <= end) {
      const monthIdx = current.getMonth();
      const year = current.getFullYear();

      const monthOrders = periodOrders.filter((o: any) => {
        const d = new Date(o.created_at);
        return d.getMonth() === monthIdx && d.getFullYear() === year;
      });

      const customerOrders: Record<string, number> = {};
      monthOrders.forEach((o: any) => {
        const cId = o.customer?.documentNumber || o.customer?.phoneNumber || o.customer?.fullName || o.id;
        if (!cId) return;
        customerOrders[cId] = (customerOrders[cId] || 0) + 1;
      });

      let nuevos = 0;
      let recurrentes = 0;
      Object.keys(customerOrders).forEach((cId) => {
        const first = customerMap[cId]?.firstOrder;
        if (first && first.getMonth() === monthIdx && first.getFullYear() === year) {
          nuevos++;
        } else {
          recurrentes++;
        }
      });

      data.push({
        month: MONTH_NAMES[monthIdx],
        nuevos,
        recurrentes,
      });

      // Move to next month
      current = new Date(current);
      current.setMonth(current.getMonth() + 1);
    }

    return data;
  }, [periodOrders, customerMap, periodDates]);

  // ── Frecuencia de compra ──
  const frecuencia = useMemo(() => {
    const buckets = [
      { name: "1 compra", min: 1, max: 1, value: 0 },
      { name: "2-3 compras", min: 2, max: 3, value: 0 },
      { name: "4-5 compras", min: 4, max: 5, value: 0 },
      { name: "6+ compras", min: 6, max: Infinity, value: 0 },
    ];

    Object.values(customerMap).forEach((c) => {
      const bucket = buckets.find(
        (b) => c.orderCount >= b.min && c.orderCount <= b.max
      );
      if (bucket) bucket.value++;
    });

    return buckets
      .filter((b) => b.value > 0)
      .map((b, idx) => ({
        name: b.name,
        value: b.value,
        color: FREQ_COLORS[idx % FREQ_COLORS.length],
      }));
  }, [customerMap]);

  return (
    <div className="flex flex-col gap-6 p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            Clientes
          </h1>
          <p className="text-xs text-muted-foreground font-semibold tracking-[0.15em] uppercase mt-1">
            Retención, valor de vida y análisis de base de clientes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector onPeriodChange={handlePeriodChange} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Clientes */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">
            Total Clientes
          </p>
          <p className="text-2xl font-black text-foreground">
            {loading ? "—" : totalClientes.toLocaleString("es-PE")}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            +{clientesEsteMes} este mes
          </p>
        </div>

        {/* Tasa de Recompra */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
              Tasa de Recompra
            </p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30">
              +5%
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-500">
            {loading ? "—" : `${tasaRecompra}%`}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            Meta: &gt;35%
          </p>
        </div>

        {/* LTV Estimado */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">
            LTV Estimado
          </p>
          <p className="text-2xl font-black text-foreground">
            {loading ? "—" : `S/ ${ltv.toLocaleString("es-PE")}`}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            Valor de por vida
          </p>
        </div>

        {/* Frecuencia Promedio */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">
            Frecuencia Promedio
          </p>
          <p className="text-2xl font-black text-foreground">
            {loading ? "—" : `${frecuenciaMedia}x`}
          </p>
          <p className="text-xs text-muted-foreground font-semibold mt-0.5">
            Pedidos por cliente
          </p>
        </div>
      </div>

      {/* Row: Nuevos vs Recurrentes + Frecuencia de compra */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Nuevos vs Recurrentes */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">
            Nuevos vs Recurrentes
          </h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={monthlyData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={30}
                  wrapperStyle={{ fontSize: "11px", fontWeight: 600 }}
                />
                <Bar
                  dataKey="nuevos"
                  name="Nuevos"
                  fill="#1e3a5f"
                  radius={[6, 6, 0, 0]}
                  barSize={35}
                />
                <Bar
                  dataKey="recurrentes"
                  name="Recurrentes"
                  fill="#0d9488"
                  radius={[6, 6, 0, 0]}
                  barSize={35}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Frecuencia de compra */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">
            Frecuencia de compra
          </h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : frecuencia.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">
              Sin datos
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={260}>
                <PieChart>
                  <Pie
                    data={frecuencia}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {frecuencia.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: string) => [`${value}`, name]}
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
              <div className="flex flex-col gap-2 flex-1">
                {frecuencia.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: f.color }}
                    />
                    <span className="text-xs text-foreground font-medium">
                      {f.name}
                    </span>
                    <span className="text-xs text-muted-foreground font-semibold ml-auto">
                      {f.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
