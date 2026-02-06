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
  icon: React.ReactNode;
  loading?: boolean;
}> = ({ title, value, subValue, icon, loading }) => (
  <Card className="bg-card/50 backdrop-blur-sm border-border shadow-sm">
    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
      <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
        {title}
      </CardTitle>
      <div className="p-2 bg-primary/5 rounded-full text-primary">{icon}</div>
    </CardHeader>
    <CardContent>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : (
        <>
          <div className="text-xl font-bold text-foreground">{value}</div>
          {subValue && (
            <p className="text-[10px] font-medium text-primary mt-1">
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

      const [billingRes, invRes, receivablesRes, courierRes] =
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

  return (
    <div className="flex flex-col h-full w-full overflow-auto bg-muted/30 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Panel Financiero
          </h2>
          <p className="text-sm text-muted-foreground">
            Estado de ingresos, egresos y valorización de activos
          </p>
        </div>
        <PeriodSelector onPeriodChange={handlePeriodChange} />
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Valor Inventario"
          value={`S/ ${inventoryValue.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`}
          subValue="Costo de reposición est."
          icon={<Package className="h-5 w-5 text-primary" />}
          loading={loading}
        />
        <StatCard
          title="Ingresos Totales"
          value={`S/ ${currentYearSales.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`}
          subValue={`${growth >= 0 ? "+" : ""}${growth.toFixed(1)}% vs año anterior`}
          icon={<Wallet className="h-5 w-5 text-primary" />}
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
            icon={<CreditCard className="h-5 w-5 text-orange-500" />}
            loading={loading}
          />
        </div>
      </div>

      {/* Second KPI Row - Receivables Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Lima / Callao"
          value={receivables.limaCount}
          subValue="Pedidos pendientes"
          icon={<Receipt className="h-5 w-5 text-primary" />}
          loading={loading}
        />
        <StatCard
          title="Provincia"
          value={receivables.provinciaCount}
          subValue="Pedidos pendientes"
          icon={<Receipt className="h-5 w-5 text-primary" />}
          loading={loading}
        />
        <StatCard
          title="Ticket Promedio Pendiente"
          value={`S/ ${receivables.avgTicket.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`}
          subValue="Por cobrar"
          icon={<BarChart3 className="h-5 w-5 text-primary" />}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evolución Card */}
        <div className="lg:col-span-2">
          <DashboardCard
            title="Evolución de Ingresos (Año Actual vs Anterior)"
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
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  style={{
                    fontSize: "12px",
                    fill: "hsl(var(--muted-foreground))",
                  }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  style={{
                    fontSize: "12px",
                    fill: "hsl(var(--muted-foreground))",
                  }}
                />
                <Tooltip
                  formatter={(value: any, name) => {
                    if (name === "Actual" || name === "Anterior")
                      return [
                        `S/ ${value.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`,
                        "Venta",
                      ];
                    return [value, name];
                  }}
                  labelStyle={{ fontWeight: "bold", marginBottom: "4px" }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-card p-3 border border-border shadow-lg rounded-lg text-xs">
                          <p className="font-bold mb-2 text-foreground border-b pb-1">
                            {label}
                          </p>
                          <div className="space-y-1">
                            <div className="flex justify-between gap-4">
                              <span className="text-blue-600 font-medium">
                                Este Año:
                              </span>
                              <span className="font-bold">
                                S/{" "}
                                {data.Actual.toLocaleString("es-PE", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground/70">
                                Año Anterior:
                              </span>
                              <span className="text-muted-foreground italic">
                                S/{" "}
                                {data.Anterior.toLocaleString("es-PE", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                            <div className="mt-2 pt-2 border-t flex justify-between gap-4">
                              <span className="text-primary/70">Órdenes:</span>
                              <span className="font-bold">{data.ordenes}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-primary/70">
                                Productos:
                              </span>
                              <span className="font-bold">
                                {data.productos}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
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

        {/* Resumen Diario Placeholder */}
        <DashboardCard
          title="Distribución Mensual"
          isLoading={loading}
          data={billing}
        >
          <div className="space-y-4">
            {billing
              .filter((b) => b.currentYear > 0)
              .slice(-5)
              .reverse()
              .map((b) => (
                <div
                  key={b.month}
                  className="flex items-center justify-between p-3 bg-card rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                      <Receipt className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-foreground">
                      {b.monthName}
                    </span>
                  </div>
                  <span className="font-bold text-foreground">
                    S/{" "}
                    {b.currentYear.toLocaleString("es-PE", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              ))}
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
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="courierName"
                tick={{ fontSize: 12 }}
                tickFormatter={(v) =>
                  v.length > 10 ? v.substring(0, 10) + "..." : v
                }
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `S/ ${v.toLocaleString()}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
                        <p className="font-bold text-foreground">
                          {data.courierName}
                        </p>
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">
                              Ingresos Envío:
                            </span>
                            <span className="font-bold text-green-600">
                              S/{" "}
                              {data.shippingRevenue.toLocaleString("es-PE", {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">
                              Órdenes:
                            </span>
                            <span className="font-bold">
                              {data.ordersCount}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">
                              Participación:
                            </span>
                            <span className="font-bold">
                              {data.percentage}%
                            </span>
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
                name="Ingresos Envío"
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
              <div className="text-center text-gray-400 py-8">
                Sin datos de courier
              </div>
            ) : (
              courierStats.map((c) => (
                <div
                  key={c.courierName}
                  className="flex items-center justify-between p-3 bg-card rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/10 text-green-500 rounded-lg">
                      <Package className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-medium text-foreground block">
                        {c.courierName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {c.ordersCount} órdenes
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-foreground block">
                      S/{" "}
                      {c.shippingRevenue.toLocaleString("es-PE", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-xs text-green-500">
                      {c.percentage}%
                    </span>
                  </div>
                </div>
              ))
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

      {/* Profitability Modal Removed */}
    </div>
  );
};
