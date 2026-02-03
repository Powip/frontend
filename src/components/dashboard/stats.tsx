"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
  CheckCircle,
  Loader2,
  Calendar,
  PackagePlus,
  Plus,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "./DashboardCard";
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

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  trend?: string;
  loading?: boolean;
  data?: any[]; // Datos para el modal de vista previa
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  description,
  trend,
  loading,
  data = [],
}) => {
  return (
    <DashboardCard
      title={title}
      isLoading={loading}
      data={data}
      className="h-auto"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold">{value}</div>
          <div className="p-2 bg-primary/5 rounded-full text-primary">
            {icon}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {trend && (
          <div className="flex items-center pt-1">
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-xs text-green-500">{trend}</span>
          </div>
        )}
      </div>
    </DashboardCard>
  );
};

// Colores para el gráfico de estados
const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: "#6b7280",
  PREPARADO: "#eab308",
  LLAMADO: "#3b82f6",
  ASIGNADO_A_GUIA: "#8b5cf6",
  EN_ENVIO: "#f59e0b",
  ENTREGADO: "#22c55e",
  ANULADO: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  PREPARADO: "Preparado",
  LLAMADO: "Llamado",
  ASIGNADO_A_GUIA: "Con Guía",
  EN_ENVIO: "En Envío",
  ENTREGADO: "Entregado",
  ANULADO: "Anulado",
};

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
}

export const Stats: React.FC = () => {
  const { selectedStoreId } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [deliveredOrders, setDeliveredOrders] = useState<any[]>([]);
  const [recentProducts, setRecentProducts] = useState<any[]>([]);

  // Daily details modal state
  const [dailyModalOpen, setDailyModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dailyDetails, setDailyDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const fetchStats = async () => {
    if (!selectedStoreId) return;

    setLoading(true);
    try {
      const [
        summaryRes,
        recentOrdersRes,
        deliveredOrdersRes,
        recentProductsRes,
      ] = await Promise.all([
        axios.get<DashboardData>(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/stats/summary`,
          {
            params: {
              storeId: selectedStoreId,
              ...(fromDate && { fromDate }),
              ...(toDate && { toDate }),
            },
          },
        ),
        axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/stats/recent-orders`, {
          params: { storeId: selectedStoreId, limit: 20 },
        }),
        axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/stats/recent-orders`, {
          params: { storeId: selectedStoreId, limit: 20, status: "ENTREGADO" },
        }),
        axios.get(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/stats/recent-products`,
          {
            params: { storeId: selectedStoreId, limit: 20 },
          },
        ),
      ]);

      setData(summaryRes.data);
      setRecentOrders(recentOrdersRes.data || []);
      setDeliveredOrders(deliveredOrdersRes.data || []);
      setRecentProducts(recentProductsRes.data || []);
    } catch (error) {
      console.error("Error al obtener las estadísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [selectedStoreId]);

  // Fetch daily details when clicking on the chart
  const fetchDailyDetails = async (date: string) => {
    if (!selectedStoreId) return;

    setLoadingDetails(true);
    setSelectedDay(date);
    setDailyModalOpen(true);
    setExpandedOrders(new Set());

    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/stats/daily-details`,
        {
          params: { storeId: selectedStoreId, date },
        },
      );
      setDailyDetails(response.data);
    } catch (error) {
      console.error("Error fetching daily details:", error);
      setDailyDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Toggle order expansion to show products
  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  // Preparar datos para gráfico de estados
  const statusChartData = data
    ? Object.entries(data.byStatus)
        .filter(([status]) => status !== "ANULADO")
        .map(([status, info]) => ({
          name: STATUS_LABELS[status] || status,
          cantidad: info.count,
          monto: info.amount,
          fill: STATUS_COLORS[status] || "#8884d8",
        }))
    : [];

  // Preparar datos para gráfico de ventas diarias
  const dailyChartData =
    data?.dailySales.map((d) => ({
      date: d.date, // Keep original date for click handler
      name: new Date(d.date + "T12:00:00").toLocaleDateString("es-PE", {
        weekday: "short",
        day: "numeric",
      }),
      ventas: d.amount,
      ordenes: d.orders,
      productos: d.products,
    })) || [];

  const deliveryPercentage =
    data && data.totalOrders > 0
      ? Math.round((data.totalDelivered / data.totalOrders) * 100)
      : 0;

  return (
    <div className="flex flex-col h-full w-full overflow-auto min-h-0">
      {/* Filtros de fecha */}
      <div className="px-4 py-3 border-b flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Período:</span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-auto"
          />
          <span className="text-muted-foreground">a</span>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-auto"
          />
        </div>
        <Button onClick={fetchStats} size="sm">
          Actualizar
        </Button>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col px-4 py-4 gap-6 min-h-0">
        {/* Cards de resumen */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Ventas Totales"
            value={
              data
                ? `S/${data.totalSales.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`
                : "-"
            }
            icon={<DollarSign className="h-4 w-4" />}
            description="Monto acumulado"
            loading={loading}
            data={recentOrders}
          />

          <StatCard
            title="Órdenes"
            value={data?.totalOrders || 0}
            icon={<ShoppingCart className="h-4 w-4" />}
            description="Total pedidos"
            loading={loading}
            data={recentOrders}
          />

          <StatCard
            title="Productos"
            value={data?.totalProducts || 0}
            icon={<PackagePlus className="h-4 w-4" />}
            description={`${deliveryPercentage}% pedidos entregados`}
            loading={loading}
            data={recentProducts}
          />

          <StatCard
            title="Ticket Promedio"
            value={
              data
                ? `S/${data.averageTicket.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`
                : "-"
            }
            icon={<Package className="h-4 w-4" />}
            description="Promedio por orden"
            loading={loading}
            data={recentOrders}
          />

          <StatCard
            title="Entregados"
            value={data?.totalDelivered || 0}
            icon={<CheckCircle className="h-4 w-4 text-green-500" />}
            description={
              data
                ? `S/${data.deliveredAmount.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`
                : "-"
            }
            loading={loading}
            data={deliveredOrders}
          />
        </div>

        {/* Gráficos */}
        <div className="flex-1 grid gap-4 md:grid-cols-2 lg:grid-cols-7 min-h-[350px]">
          {/* Ventas por día */}
          <Card className="col-span-4">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Ingresos diarios</CardTitle>
              <span className="text-xs text-muted-foreground">
                Click en una barra para ver detalle
              </span>
            </CardHeader>
            <CardContent className="flex-1 min-h-[250px]">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dailyChartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis
                      yAxisId="left"
                      orientation="left"
                      stroke="#02a8e1"
                      tickFormatter={(value) => `S/${value}`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#8884d8"
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === "Ventas (S/)") return [`S/${value}`, name];
                        return [value, name];
                      }}
                      labelStyle={{ color: "var(--foreground)" }}
                      contentStyle={{
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Bar
                      yAxisId="left"
                      dataKey="ventas"
                      fill="#02a8e1"
                      name="Ventas (S/)"
                      radius={[4, 4, 0, 0]}
                      cursor="pointer"
                      onClick={(data: any) => {
                        if (data?.payload?.date) {
                          fetchDailyDetails(data.payload.date);
                        }
                      }}
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="ordenes"
                      fill="#8884d8"
                      name="Órdenes"
                      radius={[4, 4, 0, 0]}
                      cursor="pointer"
                      onClick={(data: any) => {
                        if (data?.payload?.date) {
                          fetchDailyDetails(data.payload.date);
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Distribución por estado */}
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Distribución por Estado</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-[250px]">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={statusChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" />
                    <Tooltip
                      formatter={(value) => [value, "Cantidad"]}
                      labelStyle={{ color: "var(--foreground)" }}
                      contentStyle={{
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--border)",
                      }}
                    />
                    <Bar dataKey="cantidad" name="Cantidad">
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Daily Details Modal */}
      <Dialog open={dailyModalOpen} onOpenChange={setDailyModalOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Detalle del Día -{" "}
              {selectedDay &&
                new Date(selectedDay + "T12:00:00").toLocaleDateString(
                  "es-PE",
                  {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  },
                )}
            </DialogTitle>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : dailyDetails ? (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4 py-4 border-b">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase">Órdenes</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {dailyDetails.totalOrders}
                  </p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase">Facturación</p>
                  <p className="text-2xl font-bold text-green-600">
                    S/{" "}
                    {dailyDetails.totalAmount.toLocaleString("es-PE", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase">Productos</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {dailyDetails.totalProducts}
                  </p>
                </div>
              </div>

              {/* Orders List */}
              <div className="flex-1 overflow-auto mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Órdenes del día ({dailyDetails.orders.length})
                </h3>
                <div className="space-y-2">
                  {dailyDetails.orders.map((order: any) => (
                    <div
                      key={order.id}
                      className="border rounded-lg overflow-hidden"
                    >
                      {/* Order Header - Clickable */}
                      <div
                        className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => toggleOrderExpand(order.id)}
                      >
                        <div className="flex items-center gap-3">
                          {expandedOrders.has(order.id) ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          )}
                          <div>
                            <span className="font-medium text-gray-800">
                              #{order.orderNumber}
                            </span>
                            <span className="text-sm text-gray-500 ml-2">
                              {order.customerName}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              order.status === "ENTREGADO"
                                ? "bg-green-100 text-green-700"
                                : order.status === "EN_ENVIO"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {STATUS_LABELS[order.status] || order.status}
                          </span>
                          <span className="font-bold text-gray-800">
                            S/{" "}
                            {order.grandTotal.toLocaleString("es-PE", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Products Table - Expandable */}
                      {expandedOrders.has(order.id) &&
                        order.products.length > 0 && (
                          <div className="border-t bg-white">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-gray-50/50">
                                  <TableHead className="text-xs">
                                    Producto
                                  </TableHead>
                                  <TableHead className="text-xs text-center">
                                    Cant.
                                  </TableHead>
                                  <TableHead className="text-xs text-right">
                                    P. Unit
                                  </TableHead>
                                  <TableHead className="text-xs text-right">
                                    Subtotal
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {order.products.map(
                                  (product: any, idx: number) => (
                                    <TableRow key={idx}>
                                      <TableCell className="text-sm">
                                        {product.productName}
                                      </TableCell>
                                      <TableCell className="text-sm text-center">
                                        {product.quantity}
                                      </TableCell>
                                      <TableCell className="text-sm text-right">
                                        S/{" "}
                                        {product.unitPrice.toLocaleString(
                                          "es-PE",
                                          {
                                            minimumFractionDigits: 2,
                                          },
                                        )}
                                      </TableCell>
                                      <TableCell className="text-sm text-right font-medium">
                                        S/{" "}
                                        {product.subtotal.toLocaleString(
                                          "es-PE",
                                          {
                                            minimumFractionDigits: 2,
                                          },
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ),
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No hay datos para este día
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
