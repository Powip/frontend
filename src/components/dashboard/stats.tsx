"use client";

import React, { useEffect, useState, useCallback } from "react";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  ChevronDown,
  Download,
} from "lucide-react";
import { exportSalesToExcel, SaleExportData } from "@/utils/exportSalesExcel";
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
import { hasAdminAccess } from "@/config/permissions.config";
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
    products: number;
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
    <Card className="bg-card border border-border shadow-sm hover:ring-1 hover:ring-primary/20 transition-all duration-300 group overflow-hidden">
      <CardContent className="p-4 flex flex-col h-full justify-between">
        <div className="flex justify-between items-start mb-2">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {title}
          </span>
          {trend && (
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
              trend.isPositive ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
            }`}>
              {trend.isPositive ? "+" : "-"}{trend.value}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-0.5">
          <div className="text-2xl font-bold text-card-foreground tracking-tight leading-none">
            {loading ? (
              <div className="h-7 w-24 bg-muted animate-pulse rounded" />
            ) : (
              value
            )}
          </div>
          <div className={`text-[11px] font-medium ${subValueColor} flex items-center gap-1 mt-1`}>
            {description}
            {subValue && <span className="text-muted-foreground opacity-70">• {subValue}</span>}
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
      className={`grid grid-cols-[auto_1fr_auto] items-center gap-4 py-3 bg-background/50 hover:bg-background transition-colors group px-4 ${
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
        <span className="text-xs font-bold text-foreground tracking-tight whitespace-nowrap">
          {label}
        </span>
      </div>
      
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mx-4">
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
        <span className="text-lg font-black text-foreground tabular-nums min-w-[3ch]">
          {value}
        </span>
        <span className="text-[10px] font-bold text-muted-foreground tabular-nums w-8">
          {percentage}%
        </span>
      </div>
    </div>
  </div>
);

const GapIndicator: React.FC<{ count?: number }> = ({ count }) => (
  <div className="flex flex-col items-center py-1 opacity-60">
    <div className="flex flex-col items-center justify-center text-[10px] font-bold text-muted-foreground">
      <ChevronDown className="w-4 h-4" />
      {count !== undefined && <span>{count} no avanzan</span>}
    </div>
  </div>
);

const FunnelCOD: React.FC<{ 
  selectedStoreId: string;
  fromDate: string;
  toDate: string;
}> = ({ selectedStoreId, fromDate, toDate }) => {
  const { auth } = useAuth();
  const [funnelData, setFunnelData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchFunnelData = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const isAdmin = hasAdminAccess(auth?.user?.role);
      const res = await axiosAuth.get<DashboardData>(
        `${GATEWAY.ventas}/stats/summary`,
        {
          params: {
            storeId: selectedStoreId,
            fromDate,
            toDate,
            ...(!isAdmin && { sellerId: auth?.user?.id })
          }
        }
      );
      setFunnelData(res.data);
    } catch (error) {
      console.error("Error fetching funnel data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, fromDate, toDate, auth?.user?.id, auth?.user?.role]);

  useEffect(() => {
    fetchFunnelData();
  }, [fetchFunnelData]);

  const baseTotal = funnelData?.totalOrders || 0;
  const ingresados = funnelData?.funnelMetrics?.ingresados || 0;
  const confirmed = funnelData?.funnelMetrics?.confirmados || 0;
  const inEnvio = funnelData?.funnelMetrics?.enEnvio || 0;
  const delivered = funnelData?.funnelMetrics?.entregados || 0;
  const paid = funnelData?.funnelMetrics?.pagados || 0;
  const rejected = funnelData?.funnelMetrics?.rechazados || 0;

  const realEffectiveness = baseTotal > 0 ? Math.round(((delivered + paid) / baseTotal) * 100) : 0;
  const cumulativeConfirmados = confirmed + inEnvio + delivered + paid;
  const operationalEffectiveness = cumulativeConfirmados > 0 ? Math.round(((delivered + paid) / cumulativeConfirmados) * 100) : 0;

  const [downloading, setDownloading] = useState(false);

  const handleExport = async () => {
    if (!selectedStoreId) return;
    setDownloading(true);
    try {
      const res = await axiosAuth.get(
        `${GATEWAY.ventas}/order-header/store/${selectedStoreId}`,
        { params: { fromDate, toDate } }
      );
      
      const orders = res.data;

      // Ordenar por estado jerárquico
      const statusWeight: Record<string, number> = {
        PENDIENTE: 1,
        LLAMADO: 2,
        PREPARADO: 3,
        ASIGNADO_A_GUIA: 4,
        EN_ENVIO: 5,
        ENTREGADO: 6,
        PAGADO: 7,
        RECHAZADO: 8,
        ANULADO: 9,
      };
      
      orders.sort((a: any, b: any) => (statusWeight[a.status] || 99) - (statusWeight[b.status] || 99));

      const exportData: SaleExportData[] = orders.map((o: any) => {
        const approvedPayments = (o.payments || []).filter((p: any) => p.status === 'PAID');
        const advancePayment = approvedPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        const total = Number(o.grandTotal) || 0;
        const pendingPayment = Math.max(0, total - advancePayment);
        const productsStr = (o.items || []).map((i: any) => `${i.quantity}x ${i.productName}`).join(" | ");

        return {
          orderNumber: o.orderNumber,
          clientName: o.customer?.fullName || "-",
          phoneNumber: o.customer?.phoneNumber || "-",
          documentType: o.customer?.documentType || "-",
          documentNumber: o.customer?.documentNumber || "-",
          date: new Date(o.created_at).toLocaleDateString("es-PE"),
          products: productsStr,
          total,
          advancePayment,
          pendingPayment,
          status: o.status,
          salesRegion: o.salesRegion || "-",
          province: o.customer?.province || "-",
          city: o.customer?.city || "-",
          district: o.customer?.district || "-",
          zone: o.customer?.reference || "-",
          address: o.customer?.address || "-",
          paymentMethod: (o.payments && o.payments.length > 0) ? o.payments[0].paymentMethod : "N/A",
          deliveryType: o.deliveryType || "-",
          courier: o.courier || "-",
          sellerName: o.sellerName || "-",
          guideNumber: o.guideNumber || "-"
        };
      });

      exportSalesToExcel(exportData, `funnel_efectividad_cod`);
    } catch(err) {
      console.error("Error exporting to Excel", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
    <Card className="bg-card border border-border shadow-xl flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-6 border-b border-border bg-card px-6">
        <div>
          <CardTitle className="text-xl font-black text-foreground tracking-tight">
            Funnel Efectividad COD
          </CardTitle>
        </div>
        <button
          onClick={handleExport}
          disabled={downloading}
          className="flex items-center gap-2 px-4 py-2 bg-[#00f2ad] text-slate-900 rounded-md text-xs font-bold hover:bg-[#00d89a] transition-colors shadow-none disabled:opacity-50 tracking-tight"
        >
          {downloading ? (
             <>
               <Loader2 className="w-4 h-4 animate-spin text-slate-800" /> Procesando...
             </>
          ) : (
             <>
               <Download className="w-4 h-4 text-slate-800 stroke-[3px]" /> Exportar a Excel
             </>
          )}
        </button>
      </CardHeader>
      
      <CardContent className="p-6 bg-muted/10 flex flex-col gap-8">
        {/* Metric Boxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card rounded-2xl p-6 shadow-sm border border-border relative overflow-hidden group hover:shadow-md transition-shadow">

            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-1">
              DUEÑO DEL NEGOCIO
            </span>
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-foreground">Efectividad Real</span>
              <span className="text-[10px] text-muted-foreground font-bold italic">Entregados / Ingresados</span>
            </div>
            <div className="mt-4 text-5xl font-black text-[#00f2ad] tracking-tighter">
              {realEffectiveness}%
            </div>
          </div>

          <div className="bg-card rounded-2xl p-6 shadow-sm border border-border relative overflow-hidden group hover:shadow-md transition-shadow">

            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block mb-1">
              SUPERVISOR DE OPERACIONES
            </span>
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-foreground">Efectividad Operativa</span>
              <span className="text-[10px] text-muted-foreground font-bold italic">Entregados / Confirmados</span>
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
                label="Ingresados (Pendientes)" 
                value={ingresados} 
                percentage={baseTotal > 0 ? Math.round((ingresados / baseTotal) * 100) : 0} 
                color={STATUS_COLORS.INGRESADO} 
              />
              <GapIndicator />
              
              <FunnelStage 
                index={2} 
                label="Confirmados (Llamado)" 
                value={confirmed} 
                percentage={baseTotal > 0 ? Math.round((confirmed / baseTotal) * 100) : 0} 
                color={STATUS_COLORS.CONFIRMADO} 
              />
              <GapIndicator />

              <FunnelStage 
                index={3} 
                label="En envío" 
                value={inEnvio} 
                percentage={baseTotal > 0 ? Math.round((inEnvio / baseTotal) * 100) : 0} 
                color={STATUS_COLORS.EN_ENVIO} 
              />
              <GapIndicator />

              {/* Joined Stages Group */}
              <div className="bg-muted/30 rounded-xl p-0.5 border border-border shadow-inner">
                <FunnelStage 
                  index={4} 
                  label="Entregados" 
                  value={delivered} 
                  percentage={baseTotal > 0 ? Math.round((delivered / baseTotal) * 100) : 0} 
                  color={STATUS_COLORS.ENTREGADO}
                  isBottomJoined
                />
                <div className="h-px bg-border mx-4" />
                <FunnelStage 
                  index={5} 
                  label="Pagados" 
                  value={paid} 
                  percentage={baseTotal > 0 ? Math.round((paid / baseTotal) * 100) : 0} 
                  color={STATUS_COLORS.PAGADO} 
                />
              </div>

              <div className="flex items-center justify-center py-2 h-8">
                <div className="w-px h-full bg-border" />
              </div>

              <FunnelStage 
                index="X" 
                label="Rechazados / devueltos" 
                value={rejected} 
                percentage={baseTotal > 0 ? Math.round((rejected / baseTotal) * 100) : 0} 
                color={STATUS_COLORS.RECHAZADO} 
              />
            </>
          )}
        </div>

      </CardContent>
    </Card>

    {/* Charts Section — separate cards */}
    {!loading && funnelData && (
      <div className="grid grid-cols-1 gap-6">
        {/* Ventas Diarias */}
        <Card className="bg-card border border-border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black text-foreground tracking-tight">Ventas Diarias</h3>
              <div className="flex items-center gap-4 text-[10px] font-bold">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#3b82f6]" />
                  <span className="text-muted-foreground">Ventas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#a78bfa]" />
                  <span className="text-muted-foreground">Órdenes</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#00f2ad]" />
                  <span className="text-muted-foreground">Unidades</span>
                </div>
              </div>
            </div>
            <div className="h-[300px]">
              {(() => {
                const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
                const to   = toDate   ? new Date(`${toDate}T23:59:59`)   : null;

                const filteredDailySales = (funnelData.dailySales || []).filter((d) => {
                  if (!from || !to) return true;
                  const itemDate = new Date(`${d.date}T12:00:00`);
                  return itemDate >= from && itemDate <= to;
                });

                return filteredDailySales.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Sin datos para el período seleccionado
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={filteredDailySales.map((d) => {
                        const dateStr = typeof d.date === "string" && d.date.length === 10 ? `${d.date}T12:00:00` : d.date;
                        const dateObj = new Date(dateStr);
                        const formattedDate = dateObj.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });

                        return {
                          dayLabel: formattedDate,
                          amount: d.amount,
                          orders: d.orders,
                          units: d.products,
                        };
                      })}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="dayLabel"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }}
                    interval="preserveStartEnd"
                    minTickGap={40}
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
                    cursor={{ fill: "var(--foreground)", opacity: 0.05 }}
                    itemStyle={{ color: "var(--foreground)" }}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "var(--foreground)",
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === "amount") return [`S/ ${value.toLocaleString("es-PE")}`, "Ventas"];
                      if (name === "orders") return [value, "Órdenes"];
                      if (name === "units") return [value, "Unidades"];
                      return [value, name];
                    }}
                    labelFormatter={(label) => `${label}`}
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
                  <Line
                    yAxisId="right"
                    dataKey="units"
                    type="monotone"
                    stroke="#00f2ad"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3, fill: "#00f2ad" }}
                    strokeDasharray="4 2"
                  />
                    </ComposedChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Distribución por Estado */}
        <Card className="bg-card border border-border shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-sm font-black text-foreground tracking-tight mb-6">Distribución por Estado</h3>
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
                    cursor={{ fill: "var(--foreground)", opacity: 0.05 }}
                    itemStyle={{ color: "var(--foreground)" }}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "var(--foreground)",
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
    
    {/* HardSpacer para garantizar margen al llegar al fondo del scroll container */}
    <div className="h-16 w-full flex-shrink-0" />
    </>
  );
};

// --- Main Component ---

interface StatsProps {
  fromDate: string;
  toDate: string;
}

export const Stats: React.FC<StatsProps> = ({ fromDate, toDate }) => {
  const { selectedStoreId, auth } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!selectedStoreId) return;

    setLoading(true);
    try {
      const isAdmin = hasAdminAccess(auth?.user?.role);
      const summaryRes = await axiosAuth.get<DashboardData>(
        `${GATEWAY.ventas}/stats/summary`,
        {
          params: {
            storeId: selectedStoreId,
            ...(fromDate && { fromDate }),
            ...(toDate && { toDate }),
            ...(!isAdmin && { sellerId: auth?.user?.id }),
          },
        }
      );
      setData(summaryRes.data);
    } catch (error) {
      console.error("Error al obtener las estadísticas:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, fromDate, toDate, auth?.user?.id, auth?.user?.role]);

  useEffect(() => {
    if (fromDate && toDate) {
      fetchStats();
    }
  }, [fetchStats, fromDate, toDate]);

  const deliveryPercentage =
    data && data.totalOrders > 0
      ? Math.round((data.totalDelivered / data.totalOrders) * 100)
      : 0;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background">
      {/* Contenido principal */}
      <div className="flex-1 flex flex-col p-8 gap-8 min-h-0 overflow-y-auto scrollbar-none pb-32">
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
          <FunnelCOD selectedStoreId={selectedStoreId || ""} fromDate={fromDate} toDate={toDate} />
        </div>
      </div>
    </div>
  );
};
