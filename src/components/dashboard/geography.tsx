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
import {
  MapPin,
  CreditCard,
  Truck,
  Receipt,
  Calendar,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "./DashboardCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LocationStats {
  name: string;
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

const StatCard: React.FC<{
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  loading?: boolean;
}> = ({ title, value, subValue, icon, loading }) => (
  <Card className="bg-white/50 backdrop-blur-sm border-gray-100 shadow-sm">
    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
      <CardTitle className="text-xs font-medium text-gray-500 uppercase">
        {title}
      </CardTitle>
      <div className="p-2 bg-primary/5 rounded-full">{icon}</div>
    </CardHeader>
    <CardContent>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : (
        <>
          <div className="text-xl font-bold text-gray-800">{value}</div>
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

const CHART_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#6366f1",
  "#14b8a6",
];

export const Geography: React.FC = () => {
  const { selectedStoreId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [locationData, setLocationData] = useState<LocationStats[]>([]);
  const [paymentData, setPaymentData] = useState<PaymentStats[]>([]);
  const [deliveryData, setDeliveryData] = useState<DeliveryStats[]>([]);
  const [billingData, setBillingData] = useState<BillingStats[]>([]);

  // Local filters
  const [geoDimension, setGeoDimension] = useState<
    "city" | "province" | "district"
  >("city");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchData = async () => {
    if (!selectedStoreId) return;

    setLoading(true);
    try {
      const params: any = { storeId: selectedStoreId };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const locationParams = { ...params, dimension: geoDimension };

      const [locationRes, paymentRes, deliveryRes, billingRes] =
        await Promise.all([
          axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/stats/by-location`, {
            params: locationParams,
          }),
          axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/stats/by-payment`, {
            params,
          }),
          axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/stats/by-delivery`, {
            params,
          }),
          axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/stats/billing`, {
            params: { storeId: selectedStoreId },
          }),
        ]);

      setLocationData(locationRes.data);
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
  }, [selectedStoreId, geoDimension]);

  const currentMonthBilling =
    billingData[new Date().getMonth()]?.currentYear || 0;
  const topLocation = locationData[0];

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-gray-50/50">
      {/* Header with Date Filters */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/5 rounded-lg text-primary">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              Geografía y Finanzas
            </h2>
            <p className="text-xs text-gray-500">
              Distribución territorial y métodos de pago
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-8 w-36 bg-transparent border-none focus-visible:ring-0 text-xs"
            />
            <span className="text-gray-400 mx-1 px-1">-</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-8 w-36 bg-transparent border-none focus-visible:ring-0 text-xs"
            />
          </div>
          <Button onClick={fetchData} size="sm" className="h-8 rounded-lg">
            Filtrar
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Zona Top"
            value={topLocation?.name || "Sin datos"}
            subValue={
              topLocation ? `${topLocation.percentage}% del total` : undefined
            }
            icon={<MapPin className="h-5 w-5 text-primary" />}
            loading={loading}
          />
          <StatCard
            title="Pago Líder"
            value={paymentData[0]?.method.replace("_", " ") || "-"}
            subValue={
              paymentData[0]
                ? `${paymentData[0].percentage}% de acogida`
                : undefined
            }
            icon={<CreditCard className="h-5 w-5 text-primary" />}
            loading={loading}
          />
          <StatCard
            title="Facturación Mes"
            value={`S/ ${currentMonthBilling.toLocaleString()}`}
            subValue="Mes actual"
            icon={<Receipt className="h-5 w-5 text-primary" />}
            loading={loading}
          />
          <StatCard
            title="Ticket Promedio"
            value={`S/ ${Math.round(paymentData.reduce((s, p) => s + p.totalAmount, 0) / (paymentData.reduce((s, p) => s + p.ordersCount, 0) || 1))}`}
            subValue="Promedio general"
            icon={<Truck className="h-5 w-5 text-primary" />}
            loading={loading}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px]">
          {/* Ubicación Card */}
          <DashboardCard
            title="Impacto por Territorialidad"
            isLoading={loading}
            data={locationData}
            filters={[
              {
                label: "Nivel",
                value: geoDimension,
                onChange: (v: any) => setGeoDimension(v),
                options: [
                  { label: "Departamento", value: "city" },
                  { label: "Provincia", value: "province" },
                  { label: "Distrito", value: "district" },
                ],
              },
            ]}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={locationData
                  .slice(0, 10)
                  .map((d, i) => ({
                    ...d,
                    fill: CHART_COLORS[i % CHART_COLORS.length],
                  }))}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={true}
                  vertical={false}
                  stroke="#f0f0f0"
                />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={100}
                  axisLine={false}
                  tickLine={false}
                  style={{ fontSize: "11px" }}
                />
                <Tooltip
                  formatter={(value) => [
                    `S/ ${value.toLocaleString()}`,
                    "Monto",
                  ]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                />
                <Bar dataKey="totalAmount" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </DashboardCard>

          {/* Pagos Card */}
          <DashboardCard
            title="Preferencia de Pago"
            isLoading={loading}
            data={paymentData}
            summaryStats={[
              { label: "Método Top", value: paymentData[0]?.method || "-" },
            ]}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentData.map((p, i) => ({
                    name: p.method,
                    value: p.totalAmount,
                    fill:
                      PAYMENT_COLORS[p.method] ||
                      CHART_COLORS[i % CHART_COLORS.length],
                  }))}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {paymentData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fillOpacity={0.8}
                      stroke="white"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [
                    `S/ ${Number(value).toLocaleString()}`,
                    "Monto",
                  ]}
                />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </DashboardCard>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
          {/* Entrega Card */}
          <DashboardCard
            title="Canales de Entrega"
            isLoading={loading}
            data={deliveryData}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={deliveryData.map((d, i) => ({
                  name: d.type,
                  monto: d.totalAmount,
                  fill: CHART_COLORS[i % CHART_COLORS.length],
                }))}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f0f0f0"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  style={{ fontSize: "12px" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  style={{ fontSize: "12px" }}
                />
                <Tooltip />
                <Bar dataKey="monto" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </DashboardCard>

          {/* Histórico Card */}
          <DashboardCard
            title="Comparativo de Facturación"
            isLoading={loading}
            data={billingData}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={billingData.map((b) => ({
                  name: b.monthName,
                  Ventas: b.currentYear,
                  Anterior: b.previousYear,
                }))}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f0f0f0"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  style={{ fontSize: "12px" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  style={{ fontSize: "12px" }}
                />
                <Tooltip />
                <Legend />
                <Bar dataKey="Ventas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Anterior" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </DashboardCard>
        </div>
      </div>
    </div>
  );
};
