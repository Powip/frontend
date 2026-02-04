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
  BarChart3,
  PackagePlus,
  Plus,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "./DashboardCard";
import { PeriodSelector } from "./PeriodSelector";
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
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Generar todos los días entre fromDate y toDate
  const getDatesInRange = (start: string, end: string) => {
    const dates = [];
    const curr = new Date(start + "T12:00:00");
    const last = new Date(end + "T12:00:00");
    while (curr <= last) {
      dates.push(new Date(curr).toISOString().split("T")[0]);
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  };

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
    if (fromDate && toDate) {
      fetchStats();
    }
  }, [selectedStoreId, fromDate, toDate]);

  const handlePeriodChange = (from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
  };

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
  const allPeriodDates =
    fromDate && toDate ? getDatesInRange(fromDate, toDate) : [];

  const fullPeriodData = allPeriodDates.map((date) => {
    const existingData = data?.dailySales.find((d) => d.date === date);
    return {
      date,
      name: new Date(date + "T12:00:00").toLocaleDateString("es-PE", {
        weekday: "short",
        day: "numeric",
      }),
      ventas: existingData?.amount || 0,
      ordenes: existingData?.orders || 0,
      productos: existingData?.products || 0,
    };
  });

  // Para el gráfico principal, si hay pocos días con data, mostramos los últimos de la selección
  const chartDisplayData =
    fullPeriodData.length > 7
      ? fullPeriodData.filter((d) => d.ventas > 0 || d.ordenes > 0).length < 5
        ? fullPeriodData.slice(-7) // Si casi no hay data, los últimos 7 días
        : fullPeriodData // Si hay data, mostramos todo el mes
      : fullPeriodData;

  const dailyChartData = chartDisplayData;

  const deliveryPercentage =
    data && data.totalOrders > 0
      ? Math.round((data.totalDelivered / data.totalOrders) * 100)
      : 0;

  return (
    <div className="flex flex-col h-full w-full overflow-auto min-h-0">
      {/* Header con selector de periodo */}
      <div className="bg-card border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/5 rounded-lg text-primary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Resumen General
            </h2>
            <p className="text-xs text-muted-foreground">
              Vista general de ventas y métricas
            </p>
          </div>
        </div>
        <PeriodSelector onPeriodChange={handlePeriodChange} />
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col px-4 py-4 gap-6 min-h-0 bg-muted/30">
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
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Ingresos diarios</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2"
                  onClick={() => setShowPreviewModal(true)}
                >
                  <Eye className="h-4 w-4" />
                  Ver mes completo
                </Button>
                <span className="text-xs text-muted-foreground hidden sm:inline-block">
                  Click en una barra para ver detalle
                </span>
              </div>
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
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
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
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
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
                <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase">
                    Órdenes
                  </p>
                  <p className="text-2xl font-bold text-blue-500">
                    {dailyDetails.totalOrders}
                  </p>
                </div>
                <div className="text-center p-3 bg-green-500/10 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase">
                    Facturación
                  </p>
                  <p className="text-2xl font-bold text-green-500">
                    S/{" "}
                    {dailyDetails.totalAmount.toLocaleString("es-PE", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="text-center p-3 bg-purple-500/10 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase">
                    Productos
                  </p>
                  <p className="text-2xl font-bold text-purple-500">
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
                        className="flex items-center justify-between p-3 bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => toggleOrderExpand(order.id)}
                      >
                        <div className="flex items-center gap-3">
                          {expandedOrders.has(order.id) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <span className="font-medium text-foreground">
                              #{order.orderNumber}
                            </span>
                            <span className="text-sm text-muted-foreground ml-2">
                              {order.customerName}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              order.status === "ENTREGADO"
                                ? "bg-green-500/20 text-green-500"
                                : order.status === "EN_ENVIO"
                                  ? "bg-yellow-500/20 text-yellow-500"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {STATUS_LABELS[order.status] || order.status}
                          </span>
                          <span className="font-bold text-foreground">
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
                                <TableRow className="bg-muted/50">
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
      {/* Modal de Vista Previa del Mes */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Ventas del Mes Completo
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto mt-4 border rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 bg-card shadow-sm">
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Ventas (S/)</TableHead>
                  <TableHead className="text-right">Órdenes</TableHead>
                  <TableHead className="text-right">Productos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fullPeriodData.length > 0 ? (
                  fullPeriodData.map((d) => (
                    <TableRow key={d.date}>
                      <TableCell className="font-medium">
                        {new Date(d.date + "T12:00:00").toLocaleDateString(
                          "es-PE",
                          {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          },
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        S/{" "}
                        {d.ventas.toLocaleString("es-PE", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right">{d.ordenes}</TableCell>
                      <TableCell className="text-right">
                        {d.productos}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No hay datos para este periodo
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
