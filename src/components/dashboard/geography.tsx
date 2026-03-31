"use client";

import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
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
  Eye,
  Download,
  ChevronRight,
} from "lucide-react";
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
import { exportToExcel } from "@/lib/excel";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "./DashboardCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasAdminAccess } from "@/config/permissions.config";

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
  loading?: boolean;
  onClick?: () => void;
  clickable?: boolean;
}> = ({ title, value, subValue, loading, onClick, clickable }) => (
  <Card
    className={`bg-card border border-border shadow-sm hover:ring-1 hover:ring-primary/20 transition-all duration-300 group overflow-hidden ${clickable ? "cursor-pointer hover:shadow-md" : ""}`}
    onClick={clickable ? onClick : undefined}
  >
    <CardContent className="p-4 flex flex-col h-full justify-between">
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">
        {title}
      </span>
      {loading ? (
        <div className="h-7 w-24 bg-muted animate-pulse rounded" />
      ) : (
        <>
          <div className="text-2xl font-bold text-foreground tracking-tight leading-none">{value}</div>
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
interface GeographyProps {
  fromDate: string;
  toDate: string;
}

export const Geography: React.FC<GeographyProps> = ({ fromDate, toDate }) => {
  const { auth, selectedStoreId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [locationData, setLocationData] = useState<LocationStats[]>([]);
  const [paymentData, setPaymentData] = useState<PaymentStats[]>([]);
  const [deliveryData, setDeliveryData] = useState<DeliveryStats[]>([]);
  const [billingData, setBillingData] = useState<BillingStats[]>([]);
  const [summaryData, setSummaryData] = useState({
    deliveredAmount: 0,
    totalDelivered: 0,
  });

  // Detalle para modal anidado
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [detailedOrders, setDetailedOrders] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Modales de KPI
  const [isZonesModalOpen, setIsZonesModalOpen] = useState(false);
  const [isPaymentsModalOpen, setIsPaymentsModalOpen] = useState(false);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [billingOrders, setBillingOrders] = useState<any[]>([]);

  // Local filters
  const [geoDimension, setGeoDimension] = useState<
    "city" | "province" | "district"
  >("city");

  const fetchData = useCallback(async () => {
    if (!selectedStoreId) return;

    setLoading(true);
    try {
      const isAdmin = hasAdminAccess(auth?.user?.role);
      const params: any = { 
        storeId: selectedStoreId,
        ...(!isAdmin && { sellerId: auth?.user?.id })
      };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const locationParams = { ...params, dimension: geoDimension };

      const [locationRes, paymentRes, deliveryRes, billingRes, summaryRes] =
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
          axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/stats/summary`, {
            params,
          }),
        ]);

      setLocationData(locationRes.data);
      setPaymentData(paymentRes.data);
      setDeliveryData(deliveryRes.data);
      setBillingData(billingRes.data);
      setSummaryData({
        deliveredAmount: summaryRes.data.deliveredAmount || 0,
        totalDelivered: summaryRes.data.totalDelivered || 0,
      });
    } catch (error) {
      console.error("Error al obtener datos geográficos:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocationDetails = async (location: string) => {
    if (!selectedStoreId) return;

    setLoadingDetails(true);
    setSelectedLocation(location);
    setIsDetailsOpen(true);

    try {
      const isAdmin = hasAdminAccess(auth?.user?.role);
      const params: any = {
        storeId: selectedStoreId,
        dimension: geoDimension,
        value: location,
        ...(!isAdmin && { sellerId: auth?.user?.id })
      };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

  const fetchLocationDetails = useCallback(
    async (location: string) => {
      if (!selectedStoreId) return;

      setLoadingDetails(true);
      setSelectedLocation(location);
      setIsDetailsOpen(true);

      try {
        const params: any = {
          storeId: selectedStoreId,
          dimension: geoDimension,
          value: location,
        };
        if (fromDate) params.fromDate = fromDate;
        if (toDate) params.toDate = toDate;

        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/stats/by-location/details`,
          { params },
        );
        setDetailedOrders(res.data);
      } catch (error) {
        console.error("Error al obtener detalle por ubicación:", error);
      } finally {
        setLoadingDetails(false);
      }
    },
    [selectedStoreId, geoDimension, fromDate, toDate],
  );

  const fetchBillingOrders = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoadingDetails(true);
    setIsBillingModalOpen(true);
    try {
      // Use the correct singular endpoint that exists in the controller
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`,
      );

      // Get all orders and filter manually since the backend doesn't support these filters on this endpoint
      const allOrders = res.data || [];

      // Parse dates for comparison
      const start = fromDate ? new Date(fromDate + "T00:00:00") : null;
      const end = toDate ? new Date(toDate + "T23:59:59") : null;

      const isAdmin = hasAdminAccess(auth?.user?.role);
      const filteredOrders = allOrders.filter((o: any) => {
        // Filter by state (ENTREGADO for billing)
        if (o.status !== "ENTREGADO") return false;

        // Filter by seller if not admin
        if (!isAdmin && o.sellerId !== auth?.user?.id) return false;

        // Filter by date range
        const orderDate = new Date(o.created_at);
        if (start && orderDate < start) return false;
        if (end && orderDate > end) return false;

        return true;
      });

      // Map data for modal display
      const mappedOrders = filteredOrders.map((o: any) => ({
        ...o,
        customerName: o.customer?.fullName || "Sin nombre",
        paymentMethod:
          o.payments?.length > 0 ? o.payments[0].paymentMethod : "-",
        createdAt: o.created_at, // Map for table field
      }));

      setBillingOrders(mappedOrders);
    } catch (error) {
      console.error("Error fetching billing orders:", error);
      toast.error("No se pudieron obtener las órdenes de facturación");
    } finally {
      setLoadingDetails(false);
    }
  }, [selectedStoreId, fromDate, toDate]);

  useEffect(() => {
    if (fromDate && toDate) {
      fetchData();
    }
  }, [fetchData, fromDate, toDate]);

  const periodBilling = summaryData.deliveredAmount;
  const topLocation = locationData[0];

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background">
      {/* Header with Date Filters */}
      <div className="px-8 py-6 flex items-center justify-between border-b border-border bg-card shadow-sm">
        <div>
          <h2 className="text-xl font-black text-foreground tracking-tight">
            Geografía & Clientes
          </h2>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1">
            Distribución territorial y métodos de pago
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 space-y-8">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Zona Top"
            value={topLocation?.name || "Sin datos"}
            subValue={
              topLocation ? `${topLocation.percentage}% del total` : undefined
            }
            loading={loading}
            clickable
            onClick={() => setIsZonesModalOpen(true)}
          />
          <StatCard
            title="Pago Líder"
            value={paymentData[0]?.method.replace("_", " ") || "-"}
            subValue={
              paymentData[0]
                ? `${paymentData[0].percentage}% de acogida`
                : undefined
            }
            loading={loading}
            clickable
            onClick={() => setIsPaymentsModalOpen(true)}
          />
          <StatCard
            title="Facturación"
            value={`S/ ${periodBilling.toLocaleString()}`}
            subValue="Filtro aplicado"
            loading={loading}
            clickable
            onClick={fetchBillingOrders}
          />
          <StatCard
            title="Ticket Promedio"
            value={`S/ ${Math.round(paymentData.reduce((s, p) => s + p.totalAmount, 0) / (paymentData.reduce((s, p) => s + p.ordersCount, 0) || 1))}`}
            subValue="Promedio general"
            loading={loading}
            clickable
            onClick={() => setIsPaymentsModalOpen(true)}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px]">
          {/* Ubicación Card */}
          <DashboardCard
            title="Impacto por Territorialidad"
            isLoading={loading}
            data={locationData}
            renderRowAction={(row) => (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 flex items-center gap-1 text-[10px] text-primary hover:text-primary/80"
                onClick={() => fetchLocationDetails(row.name)}
              >
                <Eye className="h-3 w-3" />
                Ver más
              </Button>
            )}
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
                data={locationData.slice(0, 10).map((d, i) => ({
                  ...d,
                  fill: CHART_COLORS[i % CHART_COLORS.length],
                }))}
                layout="vertical"
                margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  vertical={true}
                  stroke="#f1f5f9"
                />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={90}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#64748b", fontWeight: 700 }}
                />
                <Tooltip
                  cursor={{ fill: "var(--foreground)", opacity: 0.05 }}
                  formatter={(value) => [
                    `S/ ${Number(value).toLocaleString("es-PE")}`,
                    "Monto",
                  ]}
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
                />
                <Bar
                  dataKey="percentage"
                  radius={[0, 6, 6, 0]}
                  barSize={16}
                  label={{ position: "right", formatter: (v: any) => `${v}%`, fontSize: 10, fill: "#64748b", fontWeight: 700 }}
                >
                  {locationData.slice(0, 10).map((_, i) => (
                    <Cell
                      key={`cell-${i}`}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </DashboardCard>

          {/* Pagos Card */}
          <DashboardCard
            title="Preferencia de Pago"
            isLoading={loading}
            data={paymentData}
            summaryStats={[
              { label: "Método top", value: paymentData[0]?.method || "-" },
            ]}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentData.map((p, i) => ({
                    name: p.method.replace("_", " "),
                    value: p.ordersCount,
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
                      fillOpacity={0.85}
                      stroke="white"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [
                    `${value} pedidos`,
                    "Cantidad",
                  ]}
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
                />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </DashboardCard>
        </div>
      </div>

      {/* Modal Genérico para KPI (Zonas o Pagos) */}
      <Dialog open={isZonesModalOpen} onOpenChange={setIsZonesModalOpen}>
        <DialogContent className="sm:max-w-4xl w-[90vw]">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-4">
            <DialogTitle>Detalle de Zonas</DialogTitle>
            {hasAdminAccess(auth?.user?.role) && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => exportToExcel(locationData, "detalle_zonas")}
                disabled={locationData.length === 0}
              >
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            )}
          </DialogHeader>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="text-xs font-bold">ZONA</TableHead>
                  <TableHead className="text-xs font-bold text-right">
                    ÓRDENES
                  </TableHead>
                  <TableHead className="text-xs font-bold text-right">
                    MONTO
                  </TableHead>
                  <TableHead className="text-xs font-bold text-right">
                    %
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locationData.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">
                      {item.name}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {item.ordersCount}
                    </TableCell>
                    <TableCell className="text-xs text-right font-bold">
                      S/ {item.totalAmount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-right text-primary font-medium">
                      {item.percentage}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentsModalOpen} onOpenChange={setIsPaymentsModalOpen}>
        <DialogContent className="sm:max-w-4xl w-[90vw]">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-4">
            <DialogTitle>Detalle de Métodos de Pago</DialogTitle>
            {hasAdminAccess(auth?.user?.role) && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => exportToExcel(paymentData, "detalle_pagos")}
                disabled={paymentData.length === 0}
              >
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            )}
          </DialogHeader>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="text-xs font-bold">MÉTODO</TableHead>
                  <TableHead className="text-xs font-bold text-right">
                    ÓRDENES
                  </TableHead>
                  <TableHead className="text-xs font-bold text-right">
                    MONTO
                  </TableHead>
                  <TableHead className="text-xs font-bold text-right">
                    %
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentData.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">
                      {item.method.replace("_", " ")}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {item.ordersCount}
                    </TableCell>
                    <TableCell className="text-xs text-right font-bold">
                      S/ {item.totalAmount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-right text-primary font-medium">
                      {item.percentage}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalle de Facturación */}
      <Dialog open={isBillingModalOpen} onOpenChange={setIsBillingModalOpen}>
        <DialogContent className="sm:max-w-7xl w-[95vw] max-h-[85vh] flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-4">
            <div>
              <DialogTitle>Detalle de Facturación</DialogTitle>
              <p className="text-xs text-gray-500">
                Órdenes entregadas en el periodo seleccionado
              </p>
            </div>
            {hasAdminAccess(auth?.user?.role) && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() =>
                  exportToExcel(billingOrders, "detalle_facturacion")
                }
                disabled={billingOrders.length === 0}
              >
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-auto mt-4 rounded-md border">
            {loadingDetails ? (
              <div className="h-60 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted sticky top-0">
                  <TableRow>
                    <TableHead className="text-xs font-bold">
                      N° ORDEN
                    </TableHead>
                    <TableHead className="text-xs font-bold">CLIENTE</TableHead>
                    <TableHead className="text-xs font-bold">CANAL</TableHead>
                    <TableHead className="text-xs font-bold">PAGO</TableHead>
                    <TableHead className="text-xs font-bold text-right">
                      MONTO
                    </TableHead>
                    <TableHead className="text-xs font-bold">FECHA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billingOrders.map((order, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium">
                        {order.orderNumber}
                      </TableCell>
                      <TableCell className="text-xs">
                        {order.customerName}
                      </TableCell>
                      <TableCell className="text-xs">
                        {order.salesChannel}
                      </TableCell>
                      <TableCell className="text-xs">
                        {order.paymentMethod}
                      </TableCell>
                      <TableCell className="text-xs text-right font-bold">
                        S/ {order.grandTotal.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalle de Órdenes por Ubicación */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-7xl w-[90vw] max-h-[80vh] flex flex-col p-6">
          <DialogHeader className="flex flex-row items-center justify-between pb-4 border-b">
            <div>
              <DialogTitle className="text-lg">
                Órdenes en {selectedLocation}
              </DialogTitle>
              <p className="text-xs text-muted-foreground uppercase">
                {geoDimension === "city"
                  ? "Departamento"
                  : geoDimension === "province"
                    ? "Provincia"
                    : "Distrito"}
              </p>
            </div>
            {hasAdminAccess(auth?.user?.role) && (
              <Button
                onClick={() =>
                  exportToExcel(
                    detailedOrders,
                    `ordenes-${selectedLocation?.toLowerCase()}`,
                  )
                }
                size="sm"
                className="gap-2"
                disabled={detailedOrders.length === 0}
              >
                <Download className="h-4 w-4" />
                Exportar Excel
              </Button>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-auto mt-4 rounded-md border">
            {loadingDetails ? (
              <div className="h-40 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : detailedOrders.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground italic">
                No se encontraron órdenes para este periodo.
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-gray-50 sticky top-0">
                  <TableRow>
                    <TableHead className="text-xs uppercase font-bold">
                      Orden
                    </TableHead>
                    <TableHead className="text-xs uppercase font-bold">
                      Cliente
                    </TableHead>
                    <TableHead className="text-xs uppercase font-bold text-right">
                      Monto
                    </TableHead>
                    <TableHead className="text-xs uppercase font-bold">
                      Fecha
                    </TableHead>
                    <TableHead className="text-xs uppercase font-bold">
                      Estado
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailedOrders.map((order, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium">
                        {order.n_orden}
                      </TableCell>
                      <TableCell className="text-xs">{order.cliente}</TableCell>
                      <TableCell className="text-xs text-right font-bold">
                        S/ {order.monto.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {new Date(order.fecha).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium 
                          ${order.estado === "ENTREGADO" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
                        >
                          {order.estado}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
