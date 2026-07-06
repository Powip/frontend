"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Area,
  AreaChart,
} from "recharts";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { format, differenceInDays } from "date-fns";

/* ─────────────────── Constants ─────────────────── */

const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: "#94a3b8",
  PREPARADO: "#f97316",
  LLAMADO: "#3b82f6",
  CON_GUIA: "#2563eb",
  EN_ENVIO: "#f97316",
  ENTREGADO: "#10b981",
  PAGADO: "#f59e0b",
  ANULADO: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  PREPARADO: "Preparado",
  LLAMADO: "Llamado",
  CON_GUIA: "Con Guía",
  EN_ENVIO: "En Envío",
  ENTREGADO: "Entregado",
  PAGADO: "Pagado",
  ANULADO: "Anulado",
};

const CANCEL_COLORS = [
  "#10b981",
  "#94a3b8",
  "#3b82f6",
  "#a78bfa",
  "#f59e0b",
  "#ec4899",
  "#ef4444",
];

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/* ─────────────────── Component ─────────────────── */

export default function MetricasOperacionesPage() {
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

  // Fetch orders
  useEffect(() => {
    if (!selectedStoreId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await axiosAuth.get(
          `${GATEWAY.ventas}/order-header/store/${selectedStoreId}`
        );
        setOrders(res.data || []);
      } catch (error) {
        console.error("Error fetching orders for operations:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedStoreId]);

  // Filter orders for the period
  const periodOrders = useMemo(
    () =>
      orders.filter((o) => {
        const d = new Date(o.created_at);
        return d >= periodDates.from && d <= periodDates.to;
      }),
    [orders, periodDates]
  );

  // ── KPIs ──
  const enCola = useMemo(
    () => orders.filter((o) => o.status === "PENDIENTE").length,
    [orders]
  );

  const totalActive = useMemo(
    () => orders.filter((o) => o.status !== "ANULADO").length,
    [orders]
  );

  const enColaPct = totalActive > 0 ? Math.round((enCola / totalActive) * 100) : 0;

  // Delayed orders (> 20 days in EN_ENVIO)
  const pedidosRetrasados = useMemo(() => {
    const twentyDaysAgo = new Date();
    twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
    
    return orders.filter((o) => {
      if (o.status !== "EN_ENVIO") return false;
      
      // Find the last log entry where it entered EN_ENVIO
      const enEnvioLog = o.logs
        ?.filter((l: any) => l.data?.status === "EN_ENVIO")
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        
      const entryDate = enEnvioLog ? new Date(enEnvioLog.timestamp) : new Date(o.updated_at || o.created_at);
      return entryDate < twentyDaysAgo;
    }).length;
  }, [orders]);

  // Average cycle time (days from created to ENTREGADO)
  const tiempoCiclo = useMemo(() => {
    const delivered = orders.filter(
      (o) => o.status === "ENTREGADO" || o.status === "PAGADO"
    );
    if (delivered.length === 0) return 0;
    const totalDays = delivered.reduce((sum: number, o: any) => {
      const created = new Date(o.created_at);
      // Find the first log entry for ENTREGADO or PAGADO
      const deliveredLog = o.logs
        ?.filter((l: any) => ["ENTREGADO", "PAGADO"].includes(l.data?.status))
        .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];
        
      const finished = deliveredLog ? new Date(deliveredLog.timestamp) : new Date(o.updated_at || o.created_at);
      return sum + Math.max(0, (finished.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    }, 0);
    return Number((totalDays / delivered.length).toFixed(1));
  }, [orders]);

  // Incident rate (cancelled / total)
  const tasaIncidencia = useMemo(() => {
    if (orders.length === 0) return 0;
    const cancelled = orders.filter((o) => o.status === "ANULADO").length;
    return Number(((cancelled / orders.length) * 100).toFixed(1));
  }, [orders]);

  // ── Flujo por Estado ──
  const statusFlow = useMemo(() => {
    const counts: Record<string, number> = {};
    const statusOrder = [
      "PENDIENTE",
      "PREPARADO",
      "LLAMADO",
      "CON_GUIA",
      "EN_ENVIO",
      "ENTREGADO",
      "PAGADO",
    ];
    statusOrder.forEach((s) => (counts[s] = 0));
    orders
      .filter((o) => o.status !== "ANULADO")
      .forEach((o) => {
        const status = o.status;
        if (counts[status] !== undefined) counts[status]++;
      });
    return statusOrder.map((s) => ({
      name: STATUS_LABELS[s] || s,
      value: counts[s],
      color: STATUS_COLORS[s],
    }));
  }, [orders]);

  // ── KPIs de Tiempo ──
  const timeKpis = useMemo(() => {
    const getDurationHours = (order: any, startStatus: string | null, endStatus: string) => {
      const logs = order.logs || [];
      const startTime = startStatus 
        ? new Date(logs.find((l: any) => l.data?.status === startStatus)?.timestamp || order.created_at).getTime()
        : new Date(order.created_at).getTime();
        
      // Special case for "Guía" which can be EN_ENVIO or CON_GUIA
      const endLog = logs.find((l: any) => {
        if (endStatus === "CON_GUIA") {
          return l.data?.status === "CON_GUIA" || l.data?.status === "EN_ENVIO";
        }
        return l.data?.status === endStatus;
      });
      
      if (!endLog && order.status !== endStatus) return null;
      
      const endTime = endLog ? new Date(endLog.timestamp).getTime() : new Date(order.updated_at || order.created_at).getTime();
      return Math.max(0, (endTime - startTime) / (1000 * 60 * 60));
    };

    const calculateAvgHours = (startStatus: string | null, endStatus: string) => {
      const durations = orders.map(o => getDurationHours(o, startStatus, endStatus)).filter(d => d !== null) as number[];
      if (durations.length === 0) return 0;
      return Number((durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(0));
    };

    return [
      { name: "Pendiente→Guía", hours: calculateAvgHours(null, "CON_GUIA"), color: "#6366f1" },
      { name: "Tiempo en Llamado", hours: calculateAvgHours("LLAMADO", "EN_ENVIO"), color: "#3b82f6" },
      { name: "Ciclo total", hours: calculateAvgHours(null, "ENTREGADO"), color: "#10b981" },
      { name: "Ant Llamado", hours: calculateAvgHours(null, "LLAMADO"), color: "#f59e0b" },
    ];
  }, [orders]);

  // ── Pedidos procesados en el tiempo ──
  const dailyProcessed = useMemo(() => {
    const days: { date: string; procesados: number; retrasados: number }[] = [];
    const diff = differenceInDays(periodDates.to, periodDates.from);
    
    const twentyDaysAgo = new Date();
    twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);

    for (let i = diff; i >= 0; i--) {
      const d = new Date(periodDates.to);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayLabel = d.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });

      const dayOrders = orders.filter((o) => {
        const od = new Date(o.created_at).toISOString().split("T")[0];
        return od === dateStr;
      });

      // Only those with a guide number are considered "procesados"
      const procesados = dayOrders.filter(
        (o) => o.guideNumber && o.status !== "ANULADO"
      ).length;

      // Delayed logic: > 20 days in EN_ENVIO
      const retrasados = dayOrders.filter((o) => {
        if (o.status !== "EN_ENVIO") return false;
        const enEnvioLog = o.logs
          ?.filter((l: any) => l.data?.status === "EN_ENVIO")
          .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        const entryDate = enEnvioLog ? new Date(enEnvioLog.timestamp) : new Date(o.updated_at || o.created_at);
        return entryDate < twentyDaysAgo;
      }).length;

      days.push({ date: dayLabel, procesados, retrasados });
    }
    return days;
  }, [orders, periodDates]);

  // ── Cancelados por motivo ──
  const cancelReasons = useMemo(() => {
    const reasons: Record<string, number> = {};
    orders
      .filter((o) => o.status === "ANULADO")
      .forEach((o) => {
        // Use notes for specific reason if available
        const reason = o.notes || o.cancellationReason?.reason || o.cancellationReason || "Sin motivo";
        const label = typeof reason === "string" ? reason : "Sin motivo";
        reasons[label] = (reasons[label] || 0) + 1;
      });

    return Object.entries(reasons)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value], idx) => ({
        name: name.length > 25 ? name.substring(0, 22) + "..." : name,
        value,
        color: CANCEL_COLORS[idx % CANCEL_COLORS.length],
      }));
  }, [orders]);

  // ── Reagendados vs resueltos por día de la semana ──
  const weekdayData = useMemo(() => {
    const data = DAY_LABELS.map((day) => ({
      day,
      reagendados: 0,
      resueltos: 0,
    }));

    periodOrders.forEach((o) => {
      const d = new Date(o.created_at);
      let dayIdx = d.getDay() - 1;
      if (dayIdx < 0) dayIdx = 6;

      if (["ENTREGADO", "PAGADO"].includes(o.status)) {
        data[dayIdx].resueltos++;
      }
      // Count orders that went through status changes as "reagendados"
      if (o.status === "EN_ENVIO" || o.status === "LLAMADO") {
        data[dayIdx].reagendados++;
      }
    });

    return data;
  }, [periodOrders]);

  return (
    <div className="flex flex-col gap-6 p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            Operaciones
          </h1>
          <p className="text-xs text-muted-foreground font-semibold tracking-[0.15em] uppercase mt-1">
            Ciclo de vida de cada pedido — del ingreso a la entrega
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector onPeriodChange={handlePeriodChange} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* En Cola */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">
            En Cola (sin procesar)
          </p>
          <p className="text-2xl font-black text-amber-500">
            {loading ? "—" : enCola}
          </p>
          <p className="text-xs text-amber-500 font-semibold mt-0.5">
            {enColaPct}% del total — límite
          </p>
        </div>

        {/* Tiempo Ciclo */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">
            Tiempo Ciclo Promedio
          </p>
          <p className="text-2xl font-black text-foreground">
            {loading ? "—" : `${tiempoCiclo}d`}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            Meta: &lt;5d
          </p>
        </div>

        {/* Pedidos Retrasados */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">
            Pedidos Retrasados por Recoger
          </p>
          <p className="text-2xl font-black text-amber-500">
            {loading ? "—" : pedidosRetrasados}
          </p>
          <p className="text-xs text-amber-500 font-semibold mt-0.5">
            Diferencia &gt; 20 días en envío
          </p>
        </div>

        {/* Tasa de Incidencia */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">
            Tasa de Incidencia
          </p>
          <p className="text-2xl font-black text-foreground">
            {loading ? "—" : `${tasaIncidencia}%`}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            Meta: &lt;5%
          </p>
        </div>
      </div>

      {/* Row 1: Flujo por Estado + KPIs de Tiempo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Flujo por Estado */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">
            Flujo por Estado (pedidos activos)
          </h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={statusFlow}
                layout="vertical"
                margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }}
                  width={80}
                />
                <Tooltip
                  formatter={(value: any) => [`${value} pedidos`, "Cantidad"]}
                  contentStyle={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                  {statusFlow.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* KPIs de Tiempo */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">
            KPIs de Tiempo (horas/días)
          </h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={timeKpis}
                margin={{ top: 5, right: 20, left: 10, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }}
                  interval={0}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                  tickFormatter={(v) => `${v}h`}
                />
                <Tooltip
                  formatter={(value: any) => [`${value} horas`, "Promedio"]}
                  contentStyle={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                />
                <Bar dataKey="hours" radius={[6, 6, 0, 0]} barSize={45}>
                  {timeKpis.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 2: Pedidos procesados últimos 14 días */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-muted-foreground mb-4">
          Pedidos procesados — últimos 14 días
        </h3>
        {loading ? (
          <div className="h-[250px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={dailyProcessed} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorProcessed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
              />
              <Tooltip
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
                wrapperStyle={{ fontSize: "11px", fontWeight: 600 }}
              />
              <Area
                type="monotone"
                dataKey="procesados"
                name="Procesados"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#colorProcessed)"
                dot={{ r: 3, strokeWidth: 2, fill: "white" }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="retrasados"
                name="Retrasados"
                stroke="#ec4899"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3, strokeWidth: 2, fill: "white" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Row 3: Cancelados + Reagendados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cancelados por motivo */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">
            Cancelados — motivo
          </h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : cancelReasons.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
              Sin cancelaciones en el periodo
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={260}>
                <PieChart>
                  <Pie
                    data={cancelReasons}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {cancelReasons.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: string) => [`${value}`, name]}
                    contentStyle={{
                      background: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 flex-1">
                {cancelReasons.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: r.color }}
                    />
                    <span className="text-xs text-slate-600 font-medium truncate">
                      {r.name}
                    </span>
                    <span className="text-xs text-muted-foreground font-semibold ml-auto">
                      {r.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Reagendados vs resueltos */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">
            Reagendados vs resueltos
          </h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={weekdayData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="day"
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
                  wrapperStyle={{ fontSize: "11px", fontWeight: 600 }}
                />
                <Bar
                  dataKey="reagendados"
                  name="Reagendados"
                  fill="#d4a017"
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                />
                <Bar
                  dataKey="resueltos"
                  name="Resueltos"
                  fill="#14b8a6"
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
