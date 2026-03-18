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
  Legend,
  PieChart,
  Pie,
  AreaChart,
  Area,
  Line,
} from "recharts";
import { ChevronDown, AlertTriangle } from "lucide-react";

/* ─────────────────── Types ─────────────────── */

interface ShippingGuide {
  id: string;
  guideNumber: string;
  storeId: string;
  courierId?: string | null;
  courierName?: string | null;
  orderIds: string[];
  status: string;
  deliveryType: string;
  created_at: string;
  updated_at: string;
}

const GUIDE_STATUS_COLORS: Record<string, string> = {
  CREADA: "#94a3b8",
  APROBADA: "#14b8a6",
  ASIGNADA: "#3b82f6",
  EN_RUTA: "#f59e0b",
  ENTREGADA: "#10b981",
  PARCIAL: "#f97316",
  FALLIDA: "#ef4444",
  CANCELADA: "#ef4444",
};

const COURIER_COLORS = [
  "#0d9488", // teal-600
  "#1e3a5f", // navy
  "#65a30d", // lime-600
  "#6366f1", // indigo
  "#ec4899", // pink
  "#f59e0b", // amber
];

/* ─────────────────── Component ─────────────────── */

export default function MetricasSeguimientosPage() {
  const { selectedStoreId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [guides, setGuides] = useState<ShippingGuide[]>([]);

  // Date range label
  const now = new Date();
  const dateFrom = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 13);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const dateLabel = useMemo(() => {
    const fmt = (d: Date) =>
      d.toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
    return `Hoy — ${fmt(dateFrom)}`;
  }, [dateFrom]);

  // Fetch data
  useEffect(() => {
    if (!selectedStoreId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [ordersRes, guidesRes] = await Promise.all([
          axios.get(
            `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`
          ),
          axios.get<ShippingGuide[]>(
            `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/store/${selectedStoreId}`
          ),
        ]);
        setOrders(ordersRes.data || []);
        setGuides(guidesRes.data || []);
      } catch (error) {
        console.error("Error fetching seguimiento data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedStoreId]);

  // ── KPIs ──

  // En tránsito ahora: orders with EN_ENVIO status
  const enTransito = useMemo(
    () => orders.filter((o) => o.status === "EN_ENVIO").length,
    [orders]
  );

  // Entrega primer intento: delivered guides / (delivered + failed)
  const entregaPrimerIntento = useMemo(() => {
    const delivered = guides.filter((g) => g.status === "ENTREGADA").length;
    const failed = guides.filter((g) => g.status === "FALLIDA" || g.status === "PARCIAL").length;
    const total = delivered + failed;
    if (total === 0) return 0;
    return Math.round((delivered / total) * 100);
  }, [guides]);

  const entregaMeta = 85;
  const entregaDiff = entregaPrimerIntento - entregaMeta;

  // Sin movimiento +48h: orders EN_ENVIO older than 2 days
  const sinMovimiento = useMemo(() => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    return orders.filter(
      (o) =>
        o.status === "EN_ENVIO" &&
        new Date(o.updated_at || o.created_at) < twoDaysAgo
    );
  }, [orders]);

  // Courier breakdown for the alert
  const sinMovimientoByCourier = useMemo(() => {
    const map: Record<string, number> = {};
    sinMovimiento.forEach((o) => {
      const courier = o.courier || "Sin asignar";
      map[courier] = (map[courier] || 0) + 1;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => `${name} (${count})`)
      .join(", ");
  }, [sinMovimiento]);

  // Tiempo promedio entrega (days from created to delivered)
  const tiempoPromedio = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "ENTREGADO" || o.status === "PAGADO");
    if (delivered.length === 0) return 0;
    const totalDays = delivered.reduce((sum: number, o: any) => {
      const created = new Date(o.created_at);
      const updated = new Date(o.updated_at || o.created_at);
      return sum + Math.max(0.1, (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    }, 0);
    return Number((totalDays / delivered.length).toFixed(1));
  }, [orders]);

  // ── Performance por Courier ──
  const courierPerformance = useMemo(() => {
    const map: Record<string, { delivered: number; total: number }> = {};
    guides.forEach((g) => {
      const name = g.courierName || "Sin asignar";
      if (!map[name]) map[name] = { delivered: 0, total: 0 };
      if (["ENTREGADA", "FALLIDA", "PARCIAL"].includes(g.status)) {
        map[name].total++;
        if (g.status === "ENTREGADA") map[name].delivered++;
      }
    });
    return Object.entries(map)
      .filter(([, v]) => v.total > 0)
      .map(([name, v], idx) => ({
        name: name.length > 15 ? name.substring(0, 12) + "..." : name,
        rate: Math.round((v.delivered / v.total) * 100),
        color: COURIER_COLORS[idx % COURIER_COLORS.length],
      }))
      .sort((a, b) => b.rate - a.rate);
  }, [guides]);

  // ── Estado en tránsito (donut) ──
  const transitStatus = useMemo(() => {
    const activeGuides = guides.filter(
      (g) => !["ENTREGADA", "CANCELADA"].includes(g.status)
    );
    const map: Record<string, number> = {};
    activeGuides.forEach((g) => {
      map[g.status] = (map[g.status] || 0) + 1;
    });
    return Object.entries(map).map(([status, value]) => ({
      name: status.replace("_", " "),
      value,
      color: GUIDE_STATUS_COLORS[status] || "#94a3b8",
    }));
  }, [guides]);

  // ── Pedidos procesados últimos 14 días ──
  const dailyProcessed = useMemo(() => {
    const days: { date: string; procesados: number; retrasados: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayLabel = d.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });

      const dayGuides = guides.filter((g) => {
        const gd = new Date(g.created_at).toISOString().split("T")[0];
        return gd === dateStr;
      });

      const procesados = dayGuides.filter(
        (g) => g.status === "ENTREGADA" || g.status === "EN_RUTA"
      ).length;
      const retrasados = dayGuides.filter(
        (g) => g.status === "FALLIDA" || g.status === "PARCIAL"
      ).length;

      days.push({ date: dayLabel, procesados, retrasados });
    }
    return days;
  }, [guides]);

  // ── Cancelados / Fallidos por motivo ──
  const cancelReasons = useMemo(() => {
    const failedGuides = guides.filter(
      (g) => g.status === "FALLIDA" || g.status === "CANCELADA"
    );
    const reasons: Record<string, number> = {};
    failedGuides.forEach((g) => {
      const reason = g.status === "FALLIDA" ? "Entrega fallida" : "Cancelada";
      reasons[reason] = (reasons[reason] || 0) + 1;
    });

    // Also count order-level cancellation reasons
    orders
      .filter((o) => o.status === "ANULADO")
      .forEach((o) => {
        const reason = typeof o.cancellationReason === "string"
          ? o.cancellationReason
          : o.cancellationReason?.reason || "Sin motivo";
        reasons[reason] = (reasons[reason] || 0) + 1;
      });

    const colors = ["#10b981", "#94a3b8", "#3b82f6", "#a78bfa", "#f59e0b", "#ec4899"];
    return Object.entries(reasons)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value], idx) => ({
        name: name.length > 18 ? name.substring(0, 15) + "..." : name,
        value,
        color: colors[idx % colors.length],
      }));
  }, [guides, orders]);

  // ── Tasa de devolución por courier ──
  const devolucionByCourier = useMemo(() => {
    const map: Record<string, { total: number; failed: number }> = {};
    guides.forEach((g) => {
      const name = g.courierName || "Sin asignar";
      if (!map[name]) map[name] = { total: 0, failed: 0 };
      map[name].total++;
      if (g.status === "FALLIDA" || g.status === "PARCIAL") {
        map[name].failed++;
      }
    });
    return Object.entries(map)
      .filter(([, v]) => v.total > 5)
      .map(([name, v], idx) => ({
        name: name.length > 15 ? name.substring(0, 12) + "..." : name,
        tasa: Number(((v.failed / v.total) * 100).toFixed(1)),
        color: COURIER_COLORS[idx % COURIER_COLORS.length],
      }))
      .sort((a, b) => b.tasa - a.tasa);
  }, [guides]);

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-50/50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            Seguimiento
          </h1>
          <p className="text-xs text-slate-400 font-semibold tracking-[0.15em] uppercase mt-1">
            Rastreo en tránsito — conectado a couriers
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700">
          <span>{dateLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </div>
      </div>

      {/* Alert banner */}
      {sinMovimiento.length > 0 && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-5 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-slate-800">
                {sinMovimiento.length} pedidos sin movimiento +48h
              </p>
              <p className="text-xs text-slate-500">
                {sinMovimientoByCourier}. Contactar al courier o escalar al cliente.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-600">
            CRÍTICO
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* En tránsito ahora */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
            En Tránsito Ahora
          </p>
          <p className="text-2xl font-black text-slate-800">
            {loading ? "—" : enTransito}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            Pedidos con courier
          </p>
        </div>

        {/* Entrega 1er intento */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Entrega 1er Intento
            </p>
            {entregaDiff !== 0 && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  entregaDiff >= 0
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-red-50 text-red-500"
                }`}
              >
                {entregaDiff > 0 ? "+" : ""}
                {entregaDiff}%
              </span>
            )}
          </div>
          <p className="text-2xl font-black text-emerald-500">
            {loading ? "—" : `${entregaPrimerIntento}%`}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            Meta: &gt;85%
          </p>
        </div>

        {/* Sin movimiento +48h */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
            Sin Movimiento +48h
          </p>
          <p className="text-2xl font-black text-amber-500">
            {loading ? "—" : sinMovimiento.length}
          </p>
          <p className="text-xs text-amber-500 font-semibold mt-0.5">
            Alerta activa
          </p>
        </div>

        {/* Tiempo promedio entrega */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
            Tiempo Promedio Entrega
          </p>
          <p className="text-2xl font-black text-slate-800">
            {loading ? "—" : `${tiempoPromedio}d`}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            Pickup → cliente
          </p>
        </div>
      </div>

      {/* Row 1: Courier performance + Estado en tránsito */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance por Courier */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Performance por Courier — Tasa entrega 1er intento
          </h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : courierPerformance.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">
              Sin datos de couriers
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={courierPerformance}
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
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 100]}
                />
                <Tooltip
                  formatter={(value: any) => [`${value}%`, "Tasa 1er intento"]}
                  contentStyle={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                />
                <Bar dataKey="rate" radius={[6, 6, 0, 0]} barSize={55}>
                  {courierPerformance.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Estado en tránsito */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Estado en tránsito
          </h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : transitStatus.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">
              No hay guías en tránsito
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={260}>
                <PieChart>
                  <Pie
                    data={transitStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {transitStatus.map((entry, idx) => (
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
                {transitStatus.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-xs text-slate-600 font-medium truncate">
                      {s.name}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold ml-auto">
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Pedidos procesados últimos 14 días */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
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
                <linearGradient id="colorProcSeg" x1="0" y1="0" x2="0" y2="1">
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
                fill="url(#colorProcSeg)"
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

      {/* Row 3: Cancelados + Tasa devolución */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cancelados por motivo */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Cancelados — motivo
          </h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : cancelReasons.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">
              Sin cancelaciones
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
                    <span className="text-xs text-slate-400 font-semibold ml-auto">
                      {r.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tasa de devolución por courier */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Tasa de devolución por courier — últimos 30 días
          </h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : devolucionByCourier.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">
              Sin datos suficientes
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={devolucionByCourier}
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
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(value: any) => [`${value}%`, "Tasa devolución"]}
                  contentStyle={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                />
                <Bar dataKey="tasa" radius={[6, 6, 0, 0]} barSize={55}>
                  {devolucionByCourier.map((entry, idx) => (
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
