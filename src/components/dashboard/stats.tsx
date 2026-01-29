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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "./DashboardCard";

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

  const fetchStats = async () => {
    if (!selectedStoreId) return;

    setLoading(true);
    try {
      const response = await axios.get<DashboardData>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/stats/summary`,
        {
          params: {
            storeId: selectedStoreId,
            ...(fromDate && { fromDate }),
            ...(toDate && { toDate }),
          },
        },
      );
      setData(response.data);
    } catch (error) {
      console.error("Error al obtener las estadísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [selectedStoreId]);

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
      name: new Date(d.date).toLocaleDateString("es-PE", {
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
            data={data?.dailySales || []}
          />

          <StatCard
            title="Órdenes"
            value={data?.totalOrders || 0}
            icon={<ShoppingCart className="h-4 w-4" />}
            description="Total pedidos"
            loading={loading}
            data={data?.dailySales || []}
          />

          <StatCard
            title="Productos"
            value={data?.totalProducts || 0}
            icon={<PackagePlus className="h-4 w-4" />}
            description={`${deliveryPercentage}% pedidos entregados`}
            loading={loading}
            data={data?.dailySales || []}
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
          />
        </div>

        {/* Gráficos */}
        <div className="flex-1 grid gap-4 md:grid-cols-2 lg:grid-cols-7 min-h-[350px]">
          {/* Ventas por día */}
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Ingresos diarios</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-[250px]">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
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
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="ventas"
                      stroke="#02a8e1"
                      activeDot={{ r: 8 }}
                      strokeWidth={3}
                      name="Ventas (S/)"
                      dot={{ r: 4 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="ordenes"
                      stroke="#8884d8"
                      strokeWidth={2}
                      name="Órdenes"
                      dot={{ r: 4 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="productos"
                      stroke="#ffc658"
                      strokeWidth={2}
                      name="Productos"
                      dot={{ r: 4 }}
                    />
                  </LineChart>
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
    </div>
  );
};
