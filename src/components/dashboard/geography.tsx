"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, CreditCard, Truck, Receipt, Loader2, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface RegionStats {
  region: string;
  ordersCount: number;
  totalAmount: number;
  percentage: number;
}

interface PaymentStats {
  method: string;
  ordersCount: number;
  totalAmount: number;
  percentage: number;
}

interface DeliveryStats {
  type: string;
  ordersCount: number;
  totalAmount: number;
  percentage: number;
}

interface BillingStats {
  month: number;
  monthName: string;
  currentYear: number;
  previousYear: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  loading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subValue, icon, loading }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : (
        <>
          <div className="text-2xl font-bold">{value}</div>
          {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
        </>
      )}
    </CardContent>
  </Card>
);

// Colores
const REGION_COLORS: Record<string, string> = {
  LIMA: "#3b82f6",
  PROVINCIA: "#10b981",
  SIN_REGION: "#9ca3af",
};

const PAYMENT_COLORS: Record<string, string> = {
  YAPE: "#6d28d9",
  PLIN: "#22c55e",
  CONTRAENTREGA: "#f59e0b",
  BCP: "#1e40af",
  BANCO_NACION: "#dc2626",
  MERCADO_PAGO: "#00b4e7",
  POS: "#6b7280",
  OTRO: "#9ca3af",
};

const DELIVERY_COLORS: Record<string, string> = {
  DOMICILIO: "#3b82f6",
  RETIRO_TIENDA: "#10b981",
  PUNTO_EXTERNO: "#f59e0b",
  OTRO: "#9ca3af",
};

export const Geography: React.FC = () => {
  const { selectedStoreId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [regionData, setRegionData] = useState<RegionStats[]>([]);
  const [paymentData, setPaymentData] = useState<PaymentStats[]>([]);
  const [deliveryData, setDeliveryData] = useState<DeliveryStats[]>([]);
  const [billingData, setBillingData] = useState<BillingStats[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchData = async () => {
    if (!selectedStoreId) return;

    setLoading(true);
    try {
      const params: any = { storeId: selectedStoreId };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const [regionRes, paymentRes, deliveryRes, billingRes] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/stats/by-region`, { params }),
        axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/stats/by-payment`, { params }),
        axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/stats/by-delivery`, { params }),
        axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/stats/billing`, { params: { storeId: selectedStoreId } }),
      ]);

      setRegionData(regionRes.data);
      setPaymentData(paymentRes.data);
      setDeliveryData(deliveryRes.data);
      setBillingData(billingRes.data);
    } catch (error) {
      console.error("Error al obtener datos geográficos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedStoreId]);

  // Top metrics
  const limaStats = regionData.find((r) => r.region === "LIMA");
  const provinciaStats = regionData.find((r) => r.region === "PROVINCIA");
  const topPayment = paymentData[0];
  const currentMonthBilling = billingData[new Date().getMonth()]?.currentYear || 0;

  // Prepare chart data
  const regionChartData = regionData.map((r) => ({
    name: r.region === "SIN_REGION" ? "Sin Región" : r.region,
    monto: r.totalAmount,
    ordenes: r.ordersCount,
    percentage: r.percentage,
    fill: REGION_COLORS[r.region] || "#8884d8",
  }));

  const paymentChartData = paymentData.map((p) => ({
    name: p.method.replace("_", " "),
    monto: p.totalAmount,
    ordenes: p.ordersCount,
    fill: PAYMENT_COLORS[p.method] || "#8884d8",
  }));

  const deliveryChartData = deliveryData.map((d) => ({
    name: d.type === "RETIRO_TIENDA" ? "Retiro" : d.type === "PUNTO_EXTERNO" ? "Punto Ext." : d.type.replace("_", " "),
    monto: d.totalAmount,
    percentage: d.percentage,
    fill: DELIVERY_COLORS[d.type] || "#8884d8",
  }));

  const billingChartData = billingData.map((b) => ({
    name: b.monthName,
    [new Date().getFullYear()]: b.currentYear,
    [new Date().getFullYear() - 1]: b.previousYear,
  }));

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
        <Button onClick={fetchData} size="sm">
          Actualizar
        </Button>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col px-4 py-4 gap-6 min-h-0">
        {/* Cards de resumen */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Ventas Lima"
            value={limaStats ? `S/${limaStats.totalAmount.toLocaleString("es-PE")}` : "S/0"}
            subValue={limaStats ? `${limaStats.ordersCount} órdenes (${limaStats.percentage}%)` : "0 órdenes"}
            icon={<MapPin className="h-4 w-4 text-blue-500" />}
            loading={loading}
          />
          <StatCard
            title="Ventas Provincia"
            value={provinciaStats ? `S/${provinciaStats.totalAmount.toLocaleString("es-PE")}` : "S/0"}
            subValue={provinciaStats ? `${provinciaStats.ordersCount} órdenes (${provinciaStats.percentage}%)` : "0 órdenes"}
            icon={<MapPin className="h-4 w-4 text-green-500" />}
            loading={loading}
          />
          <StatCard
            title="Método Pago Líder"
            value={topPayment?.method.replace("_", " ") || "-"}
            subValue={topPayment ? `S/${topPayment.totalAmount.toLocaleString("es-PE")} (${topPayment.percentage}%)` : undefined}
            icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
            loading={loading}
          />
          <StatCard
            title="Facturación Mes Actual"
            value={`S/${currentMonthBilling.toLocaleString("es-PE")}`}
            subValue={billingData[new Date().getMonth()] ? `${billingData[new Date().getMonth()].monthName} ${new Date().getFullYear()}` : undefined}
            icon={<Receipt className="h-4 w-4 text-muted-foreground" />}
            loading={loading}
          />
        </div>

        {/* Gráficos - Fila 1 */}
        <div className="grid gap-4 md:grid-cols-2 min-h-[300px]">
          {/* Ventas por Región (Pie) */}
          <Card>
            <CardHeader>
              <CardTitle>Ventas por Región</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-[200px]">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={regionChartData}
                      dataKey="monto"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ name, percentage }) => `${name} (${percentage}%)`}
                    >
                      {regionChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`S/${value}`, "Monto"]}
                      contentStyle={{
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--border)",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Métodos de Pago */}
          <Card>
            <CardHeader>
              <CardTitle>Métodos de Pago</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-[200px]">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={paymentChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" />
                    <Tooltip
                      formatter={(value) => [`S/${value}`, "Monto"]}
                      labelStyle={{ color: "var(--foreground)" }}
                      contentStyle={{
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--border)",
                      }}
                    />
                    <Bar dataKey="monto" name="Monto">
                      {paymentChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Gráficos - Fila 2 */}
        <div className="grid gap-4 md:grid-cols-2 min-h-[300px]">
          {/* Tipo de Entrega (Pie) */}
          <Card>
            <CardHeader>
              <CardTitle>Tipo de Entrega</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-[200px]">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={deliveryChartData}
                      dataKey="monto"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ name, percentage }) => `${name} (${percentage}%)`}
                    >
                      {deliveryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`S/${value}`, "Monto"]}
                      contentStyle={{
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--border)",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Facturación Mensual */}
          <Card>
            <CardHeader>
              <CardTitle>Facturación Mensual (Año Actual vs Anterior)</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-[200px]">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={billingChartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => [`S/${value}`, ""]}
                      labelStyle={{ color: "var(--foreground)" }}
                      contentStyle={{
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--border)",
                      }}
                    />
                    <Legend />
                    <Bar dataKey={new Date().getFullYear()} fill="#3b82f6" name={`${new Date().getFullYear()}`} />
                    <Bar dataKey={new Date().getFullYear() - 1} fill="#9ca3af" name={`${new Date().getFullYear() - 1}`} />
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
