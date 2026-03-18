"use client";

import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  ChevronDown,
} from "lucide-react";
import {
  ComposedChart,
  BarChart as RechartsBarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardCard } from "./DashboardCard";
import { PeriodSelector } from "./PeriodSelector";

// --- Types ---

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  description: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  loading?: boolean;
  data?: any[];
  subValue?: string;
  subValueColor?: string;
}

interface DashboardData {
  totalSales: number;
  totalOrders: number;
  totalProducts: number;
  averageTicket: number;
  totalDelivered: number;
  deliveredAmount: number;
  byStatus: Record<string, { count: number; amount: number }>;
  dailySales: Array<{
    date: string;
    orders: number;
    amount: number;
  }>;
  funnelMetrics: {
    ingresados: number;
    confirmados: number;
    enEnvio: number;
    entregados: number;
    pagados: number;
    rechazados: number;
  };
}

// --- Constants ---

const STATUS_COLORS: Record<string, string> = {
  INGRESADO: "#cbd5e1", // Slate 300
  CONFIRMADO: "#0ea5e9", // Sky 500
  EN_ENVIO: "#f59e0b",   // Amber 500
  ENTREGADO: "#00f2ad",  // Custom Green
  PAGADO: "#10b981",     // Emerald 500
  RECHAZADO: "#ef4444",  // Red 500
};

const STATUS_LABELS: Record<string, string> = {
  INGRESADO: "Ingresados",
  CONFIRMADO: "Confirmados",
  EN_ENVIO: "En Envío",
  ENTREGADO: "Entregados",
  PAGADO: "Pagados",
  RECHAZADO: "Rechazados",
};

// Status order and labels for the distribution chart
const DISTRIBUTION_STATUS_ORDER = [
  "PENDIENTE",
  "PREPARADO",
  "LLAMADO",
  "ASIGNADO_A_GUIA",
  "EN_ENVIO",
  "ENTREGADO",
  "PAGADO",
];

const DISTRIBUTION_STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  PREPARADO: "Preparado",
  LLAMADO: "Llamado",
  ASIGNADO_A_GUIA: "Con Guía",
  EN_ENVIO: "En Envío",
  ENTREGADO: "Entregado",
  PAGADO: "Pagado",
};

const DISTRIBUTION_STATUS_COLORS: Record<string, string> = {
  PENDIENTE: "#94a3b8",     // Slate 400
  PREPARADO: "#f59e0b",     // Amber 500
  LLAMADO: "#a78bfa",       // Violet 400
  ASIGNADO_A_GUIA: "#3b82f6", // Blue 500
  EN_ENVIO: "#f97316",      // Orange 500
  ENTREGADO: "#00f2ad",     // Custom Green
  PAGADO: "#10b981",        // Emerald 500
};

// --- Sub-components ---

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  description,
  trend,
  loading,
  subValue,
  subValueColor = "text-muted-foreground",
}) => {
  return (
    <Card className="bg-white border border-slate-200 shadow-sm hover:ring-1 hover:ring-primary/20 transition-all duration-300 group overflow-hidden">
      <CardContent className="p-4 flex flex-col h-full justify-between">
        <div className="flex justify-between items-start mb-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {title}
          </span>
          {trend && (
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
              trend.isPositive ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
            }`}>
              {trend.isPositive ? "+" : "-"}{trend.value}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-0.5">
          <div className="text-2xl font-bold text-slate-900 tracking-tight leading-none">
            {loading ? (
              <div className="h-7 w-24 bg-slate-100 animate-pulse rounded" />
            ) : (
              value
            )}
          </div>
          <div className={`text-[11px] font-medium ${subValueColor} flex items-center gap-1 mt-1`}>
            {description}
            {subValue && <span className="text-slate-400">• {subValue}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface FunnelStageProps {
  label: string;
  value: number;
  percentage: number;
  color: string;
  index: number | string;
  isBottomJoined?: boolean;
}

const FunnelStage: React.FC<FunnelStageProps> = ({ 
  label, value, percentage, color, index, isBottomJoined 
}) => (
  <div className="relative">
    <div 
      className={`grid grid-cols-[auto_1fr_auto] items-center gap-4 py-3 bg-white/50 hover:bg-white transition-colors group px-4 ${
        isBottomJoined ? "rounded-t-lg" : "rounded-lg"
      }`}
      style={{ borderLeft: `4px solid ${color}`, boxShadow: 'inset 0 0 20px -10px rgba(0,0,0,0.05)' }}
    >
      <div className="flex items-center gap-4">
        <div 
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white"
          style={{ backgroundColor: color }}
        >
          {index}
        </div>
        <span className="text-xs font-bold text-slate-800 tracking-tight whitespace-nowrap">
          {label}
        </span>
      </div>
      
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mx-4">
        <div 
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ 
            width: `${percentage}%`, 
            backgroundColor: color,
            opacity: 0.9
          }}
        />
      </div>

      <div className="flex items-center gap-3 text-right">
        <span className="text-lg font-black text-slate-900 tabular-nums min-w-[3ch]">
          {value}
        </span>
        <span className="text-[10px] font-bold text-slate-400 tabular-nums w-8">
          {percentage}%
        </span>
      </div>
    </div>
  </div>
);

const GapIndicator: React.FC<{ count: number }> = ({ count }) => (
  <div className="flex flex-col items-center py-1 opacity-60">
    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
      <ChevronDown className="w-3 h-3" />
      <span>{count} no avanzan</span>
    </div>
  </div>
);

const FunnelCOD: React.FC<{ 
  selectedStoreId: string;
}> = ({ selectedStoreId }) => {
  const [period, setPeriod] = useState<"day" | "week" | "month">("month");
  const [funnelData, setFunnelData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchFunnelData = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const now = new Date();
      let fromDate = "";
      
      if (period === "day") {
        fromDate = now.toISOString().split("T")[0];
      } else if (period === "week") {
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        fromDate = lastWeek.toISOString().split("T")[0];
      } else {
        const lastMonth = new Date(now.setMonth(now.getMonth() - 1));
        fromDate = lastMonth.toISOString().split("T")[0];
      }

      const toDate = new Date().toISOString().split("T")[0];

      const res = await axios.get<DashboardData>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/stats/summary`,
        { params: { storeId: selectedStoreId, fromDate, toDate } }
      );
      setFunnelData(res.data);
    } catch (error) {
      console.error("Error fetching funnel data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, period]);

  useEffect(() => {
    fetchFunnelData();
  }, [fetchFunnelData]);

  const total = funnelData?.funnelMetrics?.ingresados || 0;
  const confirmed = funnelData?.funnelMetrics?.confirmados || 0;
  const inEnvio = funnelData?.funnelMetrics?.enEnvio || 0;
  const delivered = funnelData?.funnelMetrics?.entregados || 0;
  const paid = funnelData?.funnelMetrics?.pagados || 0;
  const rejected = funnelData?.funnelMetrics?.rechazados || 0;

  const realEffectiveness = total > 0 ? Math.round((delivered / total) * 100) : 0;
  const operationalEffectiveness = confirmed > 0 ? Math.round((delivered / confirmed) * 100) : 0;

  return (
    <>
    <Card className="bg-white border border-slate-200 shadow-xl flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-6 border-b border-slate-100 bg-white px-6">
        <div>
          <CardTitle className="text-xl font-black text-slate-800 tracking-tight">
            Funnel Efectividad COD
          </CardTitle>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          {(["day", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 text-[10px] font-black rounded-md transition-all ${
                period === p 
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" 
                : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {p === "day" ? "HOY" : p === "week" ? "SEMANA" : "MES"}
            </button>
          ))}
        </div>
      </CardHeader>
      
      <CardContent className="p-6 bg-slate-50/30 flex flex-col gap-8">
        {/* Metric Boxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">

            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
              DUEÑO DEL NEGOCIO
            </span>
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-slate-800">Efectividad Real</span>
              <span className="text-[10px] text-slate-400 font-bold italic">Entregados / Ingresados</span>
            </div>
            <div className="mt-4 text-5xl font-black text-[#00f2ad] tracking-tighter">
              {realEffectiveness}%
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">

            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block mb-1">
              SUPERVISOR DE OPERACIONES
            </span>
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-slate-800">Efectividad Operativa</span>
              <span className="text-[10px] text-slate-400 font-bold italic">Entregados / Confirmados</span>
            </div>
            <div className="mt-4 text-5xl font-black text-[#0ea5e9] tracking-tighter">
              {operationalEffectiveness}%
            </div>
          </div>
        </div>

        {/* Funnel List */}
        <div className="flex flex-col">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 gap-3">
              <Loader2 className="w-8 h-8 text-[#00f2ad] animate-spin" />
              <span className="text-xs text-slate-500 font-medium font-black uppercase tracking-widest">
                Sincronizando Métricas...
              </span>
            </div>
          ) : (
            <>
              <FunnelStage 
                index={1} 
                label="Ingresados" 
                value={total} 
                percentage={100} 
                color={STATUS_COLORS.INGRESADO} 
              />
              <GapIndicator count={total - confirmed} />
              
              <FunnelStage 
                index={2} 
                label="Confirmados (call center)" 
                value={confirmed} 
                percentage={total > 0 ? Math.round((confirmed / total) * 100) : 0} 
                color={STATUS_COLORS.CONFIRMADO} 
              />
              <GapIndicator count={confirmed - inEnvio} />

              <FunnelStage 
                index={3} 
                label="En envío (guía generada)" 
                value={inEnvio} 
                percentage={total > 0 ? Math.round((inEnvio / total) * 100) : 0} 
                color={STATUS_COLORS.EN_ENVIO} 
              />
              <GapIndicator count={inEnvio - delivered} />

              {/* Joined Stages Group */}
              <div className="bg-slate-100/50 rounded-xl p-0.5 border border-slate-200 shadow-inner">
                <FunnelStage 
                  index={4} 
                  label="Entregados" 
                  value={delivered} 
                  percentage={total > 0 ? Math.round((delivered / total) * 100) : 0} 
                  color={STATUS_COLORS.ENTREGADO}
                  isBottomJoined
                />
                <div className="h-px bg-slate-200 mx-4" />
                <FunnelStage 
                  index={5} 
                  label="Pagados (COD cobrado)" 
                  value={paid} 
                  percentage={total > 0 ? Math.round((paid / total) * 100) : 0} 
                  color={STATUS_COLORS.PAGADO} 
                />
              </div>

              <div className="flex items-center justify-center py-2 h-8">
                <div className="w-px h-full bg-slate-200" />
              </div>

              <FunnelStage 
                index="X" 
                label="Rechazados / devueltos" 
                value={rejected} 
                percentage={total > 0 ? Math.round((rejected / total) * 100) : 0} 
                color={STATUS_COLORS.RECHAZADO} 
              />
            </>
          )}
        </div>

      </CardContent>
    </Card>

    {/* Charts Section — separate cards */}
    {!loading && funnelData && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ingresos Diarios */}
        <Card className="bg-white border border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black text-slate-800 tracking-tight">Ingresos Diarios</h3>
              <div className="flex items-center gap-4 text-[10px] font-bold">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#3b82f6]" />
                  <span className="text-slate-500">Ventas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#a78bfa]" />
                  <span className="text-slate-500">Órdenes</span>
                </div>
              </div>
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={(funnelData.dailySales || []).map((d) => ({
                    day: new Date(d.date).getDate(),
                    amount: d.amount,
                    orders: d.orders,
                  }))}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }}
                  />
                  <YAxis
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }}
                    tickFormatter={(v) => `S/${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                    formatter={(value: number, name: string) => [
                      name === "amount" ? `S/ ${value.toLocaleString("es-PE")}` : value,
                      name === "amount" ? "Ventas" : "Órdenes",
                    ]}
                    labelFormatter={(label) => `Día ${label}`}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="amount"
                    fill="#3b82f6"
                    radius={[3, 3, 0, 0]}
                    barSize={12}
                    opacity={0.85}
                  />
                  <Line
                    yAxisId="right"
                    dataKey="orders"
                    type="monotone"
                    stroke="#a78bfa"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3, fill: "#a78bfa" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Distribución por Estado */}
        <Card className="bg-white border border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-sm font-black text-slate-800 tracking-tight mb-6">Distribución por Estado</h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart
                  layout="vertical"
                  data={DISTRIBUTION_STATUS_ORDER.map((key) => ({
                    name: DISTRIBUTION_STATUS_LABELS[key] || key,
                    count: funnelData.byStatus[key]?.count || 0,
                    color: DISTRIBUTION_STATUS_COLORS[key] || "#94a3b8",
                  }))}
                  margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={70}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#64748b", fontWeight: 700 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                    formatter={(value: number) => [value, "Órdenes"]}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={16}>
                    {DISTRIBUTION_STATUS_ORDER.map((key) => (
                      <Cell
                        key={key}
                        fill={DISTRIBUTION_STATUS_COLORS[key] || "#94a3b8"}
                      />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    )}
    </>
  );
};

// --- Main Component ---

export const Stats: React.FC = () => {
  const { selectedStoreId } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const fetchStats = useCallback(async () => {
    if (!selectedStoreId) return;

    setLoading(true);
    try {
      const summaryRes = await axios.get<DashboardData>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/stats/summary`,
        {
          params: {
            storeId: selectedStoreId,
            ...(fromDate && { fromDate }),
            ...(toDate && { toDate }),
          },
        }
      );
      setData(summaryRes.data);
    } catch (error) {
      console.error("Error al obtener las estadísticas:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, fromDate, toDate]);

  useEffect(() => {
    if (fromDate && toDate) {
      fetchStats();
    }
  }, [fetchStats, fromDate, toDate]);

  const handlePeriodChange = (from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
  };

  const deliveryPercentage =
    data && data.totalOrders > 0
      ? Math.round((data.totalDelivered / data.totalOrders) * 100)
      : 0;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-slate-50/50">
      {/* Header con selector de periodo */}
      <div className="px-8 py-6 flex items-center justify-between border-b border-slate-200 bg-white shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            PANEL DE CONTROL
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">
            Resumen General de Operaciones
          </p>
        </div>
        <div className="flex items-center gap-4">
          <PeriodSelector onPeriodChange={handlePeriodChange} />
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col p-8 gap-8 min-h-0 overflow-y-auto scrollbar-none">
        {/* Cards de resumen */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Ventas Totales"
            value={
              data
                ? `S/ ${data.totalSales.toLocaleString("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : "-"
            }
            description="Monto acumulado"
            loading={loading}
            subValueColor="text-green-600"
          />

          <StatCard
            title="Órdenes"
            value={data?.totalOrders || 0}
            description="Total pedidos"
            loading={loading}
            subValueColor="text-green-600"
          />

          <StatCard
            title="Productos"
            value={data?.totalProducts || 0}
            description="Total ítems vendidos"
            loading={loading}
          />

          <StatCard
            title="Ticket Promedio"
            value={
              data
                ? `S/ ${data.averageTicket.toLocaleString("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : "-"
            }
            description="Por orden"
            loading={loading}
            subValueColor="text-green-600"
          />

          <StatCard
            title="Entregados"
            value={data?.totalDelivered || 0}
            description={`${deliveryPercentage}% efectividad`}
            loading={loading}
            subValueColor="text-green-600"
          />
        </div>

        {/* Funnel Section */}
        <div className="grid grid-cols-1 gap-6 min-h-[600px] pb-8">
          <FunnelCOD selectedStoreId={selectedStoreId || ""} />
        </div>
      </div>
    </div>
  );
};
