"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";
import {
  Wallet,
  Landmark,
  TrendingDown,
  BarChart3,
  Receipt,
  Package,
  CreditCard,
  DollarSign,
  PieChart,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardCard } from "./DashboardCard";
import { PeriodSelector } from "./PeriodSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentDetailsModal } from "./PaymentDetailsModal";

interface BillingStats {
  month: number;
  monthName: string;
  currentYear: number;
  previousYear: number;
  currentOrders: number;
  previousOrders: number;
  currentProducts: number;
  previousProducts: number;
}

const StatCard: React.FC<{
  title: string;
  value: string | number;
  subValue?: string;
  loading?: boolean;
}> = ({ title, value, subValue, loading }) => (
  <Card className="bg-white border border-slate-200 shadow-sm hover:ring-1 hover:ring-primary/20 transition-all duration-300 overflow-hidden">
    <CardContent className="p-4 flex flex-col h-full justify-between">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
        {title}
      </span>
      {loading ? (
        <div className="h-7 w-24 bg-slate-100 animate-pulse rounded" />
      ) : (
        <>
          <div className="text-2xl font-bold text-slate-900 tracking-tight leading-none">{value}</div>
          {subValue && (
            <p className="text-[10px] font-medium text-green-600 mt-1">
              {subValue}
            </p>
          )}
        </>
      )}
    </CardContent>
  </Card>
);

export const FinanceStats: React.FC = () => {
  const { selectedStoreId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<BillingStats[]>([]);
  const [inventoryValue, setInventoryValue] = useState(0);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [dailyIncome, setDailyIncome] = useState<any[]>([]);

  // Receivables state
  const [receivables, setReceivables] = useState<{
    pendingOrders: any[];
    pendingTotal: number;
    paidTotal: number;
    limaCount: number;
    provinciaCount: number;
    avgTicket: number;
  }>({
    pendingOrders: [],
    pendingTotal: 0,
    paidTotal: 0,
    limaCount: 0,
    provinciaCount: 0,
    avgTicket: 0,
  });
  const [receivablesModalOpen, setReceivablesModalOpen] = useState(false);
  const [paymentsModalOpen, setPaymentsModalOpen] = useState(false);

  // Courier stats
  const [courierStats, setCourierStats] = useState<
    Array<{
      courierName: string;
      ordersCount: number;
      shippingRevenue: number;
      percentage: number;
    }>
  >([]);

  const fetchData = async (from?: string, to?: string) => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const params: Record<string, string> = { storeId: selectedStoreId };
      if (from) params.fromDate = from;
      if (to) params.toDate = to;

      const billingParams = { ...params };
      if (from) {
        billingParams.year = from.split("-")[0];
      }

      const [billingRes, invRes, receivablesRes, courierRes, dailyIncomeRes] =
        await Promise.all([
          axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/stats/billing`, {
            params: billingParams,
          }),
          axios.get(
            `${process.env.NEXT_PUBLIC_API_INVENTORY}/stats/inventory-value`,
            {
              params: {
                storeId: selectedStoreId,
                date: to,
              },
            },
          ),
          // Fetch receivables (pending payments)
          axios
            .get(`${process.env.NEXT_PUBLIC_API_VENTAS}/stats/receivables`, {
              params,
            })
            .catch(() => ({
              data: {
                pendingTotal: 0,
                limaCount: 0,
                provinciaCount: 0,
                avgTicket: 0,
                pendingOrders: [],
              },
            })),
          // Fetch courier stats
          axios
            .get(`${process.env.NEXT_PUBLIC_API_VENTAS}/stats/by-courier`, {
              params,
            })
            .catch(() => ({ data: [] })),
          // Fetch daily income
          axios
            .get(`${process.env.NEXT_PUBLIC_API_VENTAS}/stats/daily-income`, {
              params,
            })
            .catch(() => ({ data: [] })),
        ]);

      setBilling(billingRes.data || []);
      setInventoryValue(invRes.data?.totalValue || 0);

      // Process receivables
      const receivablesData = receivablesRes.data || {
        pendingTotal: 0,
        limaCount: 0,
        provinciaCount: 0,
        avgTicket: 0,
        pendingOrders: [],
      };

      setReceivables({
        ...receivablesData,
        paidTotal: 0, // Will be calculated from billing
      });

      // Process courier stats
      setCourierStats(courierRes.data || []);

      // Process daily income
      setDailyIncome(dailyIncomeRes.data || []);
    } catch (error) {
      console.error("Error fetching finance stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fromDate && toDate) {
      fetchData(fromDate, toDate);
    }
  }, [selectedStoreId, fromDate, toDate]);

  const handlePeriodChange = (from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
  };

  const getMonthFromDate = (dateStr: string) => {
    if (!dateStr) return 0;
    return parseInt(dateStr.split("-")[1], 10);
  };

  const startMonth = fromDate ? getMonthFromDate(fromDate) : 1;
  const endMonth = toDate ? getMonthFromDate(toDate) : 12;

  const filteredBilling = billing.filter(
    (b) => b.month >= startMonth && b.month <= endMonth,
  );

  const currentYearSales = filteredBilling.reduce(
    (sum, b) => sum + b.currentYear,
    0,
  );
  const previousYearSales = filteredBilling.reduce(
    (sum, b) => sum + b.previousYear,
    0,
  );
  const growth =
    previousYearSales > 0
      ? ((currentYearSales - previousYearSales) / previousYearSales) * 100
      : 0;

  const totalPaid = dailyIncome.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="flex flex-col h-full w-full overflow-auto bg-slate-50/50">
      {/* Header */}
      <div className="px-8 py-6 flex items-center justify-between border-b border-slate-200 bg-white shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Panel Financiero
          </h2>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">
            Estado de ingresos, egresos y valorización de activos
          </p>
        </div>
        <PeriodSelector onPeriodChange={handlePeriodChange} />
      </div>

      <div className="p-8 space-y-8">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Valor Almacén"
          value={`S/ ${inventoryValue.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`}
          subValue="Costo reposición est."
          loading={loading}
        />
        <StatCard
          title="Ingresos Totales"
          value={`S/ ${currentYearSales.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`}
          subValue={`${growth >= 0 ? "+" : ""}${growth.toFixed(1)}% vs año ant.`}
          loading={loading}
        />
        <div
          className="cursor-pointer hover:scale-[1.02] transition-transform"
          onClick={() => setReceivablesModalOpen(true)}
        >
          <StatCard
            title="Cuentas por Cobrar"
            value={`S/ ${receivables.pendingTotal.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`}
            subValue={`${receivables.pendingOrders.length} pedidos pendientes`}
            loading={loading}
          />
        </div>
        <div
          className="cursor-pointer hover:scale-[1.02] transition-transform"
          onClick={() => setPaymentsModalOpen(true)}
        >
          <StatCard
            title="Pagos Aprobados"
            value={`S/ ${totalPaid.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`}
            subValue="Total recaudado"
            loading={loading}
          />
        </div>
      </div>

      {/* Second KPI Row - Receivables Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Lima / Callao"
          value={receivables.limaCount}
          subValue="Pedidos pendientes"
          loading={loading}
        />
        <StatCard
          title="Provincia"
          value={receivables.provinciaCount}
          subValue="Pedidos pendientes"
          loading={loading}
        />
        <StatCard
          title="Ticket Promedio Pendiente"
          value={`S/ ${receivables.avgTicket.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`}
          subValue="Por cobrar"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evolución Card */}
        <div className="lg:col-span-2">
          <DashboardCard
            title="Evolución de Ingresos"
            isLoading={loading}
            data={billing}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={billing.map((b) => ({
                  name: b.monthName,
                  Actual: b.currentYear,
                  Anterior: b.previousYear,
                  ordenes: b.currentOrders,
                  productos: b.currentProducts,
                }))}
                margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }}
                  tickFormatter={(v) => `S/${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-xl text-xs">
                          <p className="font-bold mb-2 text-slate-800 border-b border-slate-100 pb-1">
                            {label}
                          </p>
                          <div className="space-y-1">
                            <div className="flex justify-between gap-4">
                              <span className="text-blue-600 font-medium">Este Año:</span>
                              <span className="font-bold text-slate-800">
                                S/ {data.Actual.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Año Anterior:</span>
                              <span className="text-slate-500 italic">
                                S/ {data.Anterior.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between gap-4">
                              <span className="text-slate-500">Órdenes:</span>
                              <span className="font-bold text-slate-800">{data.ordenes}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-500">Productos:</span>
                              <span className="font-bold text-slate-800">{data.productos}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  iconType="square"
                  wrapperStyle={{ fontSize: "11px", fontWeight: 700 }}
                  formatter={(value) => {
                    const year = new Date().getFullYear();
                    return value === "Actual" ? `${year}` : `${year - 1}`;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="Actual"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorActual)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Anterior"
                  stroke="#94a3b8"
                  fillOpacity={0}
                  strokeDasharray="5 5"
                />
              </AreaChart>
            </ResponsiveContainer>
          </DashboardCard>
        </div>

        {/* Distribución Mensual */}
        <DashboardCard
          title="Distribución Mensual"
          isLoading={loading}
          data={billing}
        >
          <div className="space-y-3">
            {billing
              .filter((b) => b.currentYear > 0)
              .slice(-5)
              .reverse()
              .map((b, i) => {
                const colors = ["bg-blue-500", "bg-green-500", "bg-amber-500", "bg-purple-500", "bg-rose-500"];
                return (
                  <div
                    key={b.month}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 ${colors[i % colors.length]} rounded-lg flex items-center justify-center`}>
                        <span className="text-white text-xs font-black">{b.monthName.charAt(0)}</span>
                      </div>
                      <span className="font-semibold text-slate-700 text-sm">
                        {b.monthName}
                      </span>
                    </div>
                    <span className="font-bold text-slate-900 text-sm">
                      S/ {b.currentYear.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })}
          </div>
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <DashboardCard
          title="Detalle de Ingresos Diarios"
          isLoading={loading}
          data={dailyIncome}
        >
          <div className="w-full">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyIncome}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
                  }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }}
                  tickFormatter={(value) => `S/ ${value}`}
                />
                <Tooltip
                  formatter={(value: any) => [
                    `S/ ${value.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`,
                    "Ingreso",
                  ]}
                  contentStyle={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                />
                <Bar
                  dataKey="amount"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={50}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardCard>
      </div>

      {/* Courier Revenue Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardCard
          title="Ingresos por Courier"
          isLoading={loading}
          data={courierStats}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={courierStats}
              margin={{ top: 20, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="courierName"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#64748b", fontWeight: 700 }}
                tickFormatter={(v) => v.length > 10 ? v.substring(0, 10) + "..." : v}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }}
                tickFormatter={(v) => `S/ ${v.toLocaleString()}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-3 rounded-xl shadow-lg border border-slate-200 text-xs">
                        <p className="font-bold text-slate-800">{data.courierName}</p>
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-500">Monto Recaudado:</span>
                            <span className="font-bold text-green-600">
                              S/ {data.shippingRevenue.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-500">Órdenes:</span>
                            <span className="font-bold text-slate-800">{data.ordersCount}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-500">Efectividad:</span>
                            <span className="font-bold text-slate-800">{data.percentage}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="shippingRevenue"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                name="Monto Recaudado"
              />
            </BarChart>
          </ResponsiveContainer>
        </DashboardCard>

        {/* Courier Summary Table */}
        <DashboardCard
          title="Resumen por Courier"
          isLoading={loading}
          data={courierStats}
        >
          <div className="space-y-3 max-h-[280px] overflow-y-auto">
            {courierStats.length === 0 ? (
              <div className="text-center text-slate-400 py-8">
                Sin datos de courier
              </div>
            ) : (
              courierStats.map((c, i) => {
                const colors = ["bg-emerald-500", "bg-blue-500", "bg-amber-500", "bg-purple-500"];
                return (
                  <div
                    key={c.courierName}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 ${colors[i % colors.length]} rounded-lg flex items-center justify-center`}>
                        <span className="text-white text-xs font-black">{c.courierName.charAt(0)}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700 block text-sm">
                          {c.courierName}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {c.ordersCount} órdenes
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900 block text-sm">
                        S/ {c.shippingRevenue.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-green-600 font-medium">
                        Efectividad: {c.percentage}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DashboardCard>
      </div>

      {/* Receivables Modal */}
      <Dialog
        open={receivablesModalOpen}
        onOpenChange={setReceivablesModalOpen}
      >
        <DialogContent className="sm:max-w-7xl w-[90vw] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Cuentas por Cobrar - Detalle
            </DialogTitle>
          </DialogHeader>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-b">
            <div className="text-center p-3 bg-orange-500/10 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">
                Total Pendiente
              </p>
              <p className="text-lg font-bold text-orange-500">
                S/{" "}
                {receivables.pendingTotal.toLocaleString("es-PE", {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="text-center p-3 bg-blue-500/10 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">
                Pedidos Lima/Callao
              </p>
              <p className="text-lg font-bold text-blue-500">
                {receivables.limaCount}
              </p>
            </div>
            <div className="text-center p-3 bg-purple-500/10 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">
                Pedidos Provincia
              </p>
              <p className="text-lg font-bold text-purple-500">
                {receivables.provinciaCount}
              </p>
            </div>
            <div className="text-center p-3 bg-green-500/10 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">
                Ticket Promedio
              </p>
              <p className="text-lg font-bold text-green-500">
                S/{" "}
                {receivables.avgTicket.toLocaleString("es-PE", {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>

          {/* Pending Orders Table */}
          <div className="flex-1 overflow-auto mt-4 rounded-md border">
            <Table>
              <TableHeader className="bg-muted sticky top-0">
                <TableRow>
                  <TableHead className="text-xs uppercase font-bold text-muted-foreground">
                    N° Orden
                  </TableHead>
                  <TableHead className="text-xs uppercase font-bold text-muted-foreground">
                    Cliente
                  </TableHead>
                  <TableHead className="text-xs uppercase font-bold text-muted-foreground">
                    Distrito
                  </TableHead>
                  <TableHead className="text-xs uppercase font-bold text-muted-foreground">
                    Zona
                  </TableHead>
                  <TableHead className="text-xs uppercase font-bold text-muted-foreground text-right">
                    Pendiente
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receivables.pendingOrders.map((order: any) => (
                  <TableRow key={order.id || order.orderNumber}>
                    <TableCell className="font-medium">
                      {order.orderNumber}
                    </TableCell>
                    <TableCell>{order.customerName || "Sin nombre"}</TableCell>
                    <TableCell>{order.district || "-"}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          ["LIMA", "CALLAO"].some((d) =>
                            (order.district || "").toUpperCase().includes(d),
                          )
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {["LIMA", "CALLAO"].some((d) =>
                          (order.district || "").toUpperCase().includes(d),
                        )
                          ? "Lima"
                          : "Provincia"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      S/{" "}
                      {(
                        order.pendingPayment ||
                        order.grandTotal ||
                        0
                      ).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
      <PaymentDetailsModal
        open={paymentsModalOpen}
        onOpenChange={setPaymentsModalOpen}
        storeId={selectedStoreId || ""}
        fromDate={fromDate}
        toDate={toDate}
      />
      </div>

      {/* Profitability Modal Removed */}
    </div>
  );
};
