"use client";

import React, { useEffect, useState } from "react";
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
  Users,
  Radio,
  Tag,
  Package,
  Calendar,
  Download,
  Eye,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "./DashboardCard";
import { PeriodSelector } from "./PeriodSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as XLSX from "xlsx";

interface ChannelStats {
  channel: string;
  ordersCount: number;
  totalAmount: number;
  percentage: number;
}

interface SellerStats {
  sellerId: string;
  sellerName: string;
  ordersCount: number;
  totalAmount: number;
  percentage: number;
}

interface BrandStats {
  brandId: string;
  brandName: string;
  ordersCount: number;
  productsCount: number;
  totalAmount: number;
  percentage: number;
}

interface CategoryStats {
  categoryId: string;
  categoryName: string;
  ordersCount: number;
  productsCount: number;
  totalAmount: number;
  percentage: number;
}

const StatCard: React.FC<{
  title: string;
  value: string | number;
  subValue?: string;
  icon?: React.ReactNode;
  loading?: boolean;
  onClick?: () => void;
  clickable?: boolean;
}> = ({ title, value, subValue, loading, onClick, clickable }) => (
  <Card
    className={`bg-white border border-slate-200 shadow-sm hover:ring-1 hover:ring-primary/20 transition-all duration-300 group overflow-hidden ${clickable ? "cursor-pointer hover:shadow-md" : ""}`}
    onClick={clickable ? onClick : undefined}
  >
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

const CHANNEL_COLORS: Record<string, string> = {
  WHATSAPP: "#25D366",
  INSTAGRAM: "#E1306C",
  FACEBOOK: "#1877F2",
  TIENDA_FISICA: "#6b7280",
  WEB: "#3b82f6",
  MERCADOLIBRE: "#FFE600",
  MARKETPLACE: "#f59e0b",
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

export const Analysis: React.FC = () => {
  const { auth, selectedStoreId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [channelData, setChannelData] = useState<{
    salesChannels: ChannelStats[];
    closingChannels: ChannelStats[];
  } | null>(null);
  const [brandData, setBrandData] = useState<BrandStats[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryStats[]>([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [productsModalOpen, setProductsModalOpen] = useState(false);

  // Local states for filters
  const [channelDimension, setChannelDimension] = useState<"sales" | "closing">(
    "sales",
  );
  const [productDimension, setProductDimension] = useState<
    "category" | "brand"
  >("category");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchData = async (from?: string, to?: string) => {
    if (!selectedStoreId) return;

    setLoading(true);
    try {
      const params: Record<string, string> = { storeId: selectedStoreId };
      if (from) params.fromDate = from;
      if (to) params.toDate = to;

      const [channelRes, brandRes, categoryRes] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/stats/by-channel`, {
          params,
        }),
        axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/stats/by-brand`, {
          params,
        }),
        axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/stats/by-category`, {
          params,
        }),
      ]);

      setChannelData(channelRes.data);
      setBrandData(brandRes.data);
      setCategoryData(categoryRes.data);
    } catch (error) {
      console.error("Error al obtener datos de análisis:", error);
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

  // Derived data for charts
  const getChannelChartData = () => {
    const source =
      channelDimension === "sales"
        ? channelData?.salesChannels
        : channelData?.closingChannels;
    return (
      source?.map((c) => ({
        name: c.channel.replace("_", " "),
        monto: c.totalAmount,
        ordenes: c.ordersCount,
        percentage: c.percentage,
        fill: CHANNEL_COLORS[c.channel] || "#8884d8",
      })) || []
    );
  };

  const getProductChartData = () => {
    const source = productDimension === "category" ? categoryData : brandData;
    return source.slice(0, 8).map((item: any, i) => ({
      name: item.categoryName || item.brandName,
      monto: item.totalAmount,
      ordenes: item.ordersCount,
      percentage: item.percentage,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }));
  };

  const topSalesChannel = channelData?.salesChannels?.[0];
  const topCategory =
    categoryData?.find((c) => c.categoryId !== "SIN_CATEGORIA") ||
    categoryData?.[0];

  // Computed category totals
  const categoryTotals = {
    totalBilling:
      categoryData?.reduce((sum, c) => sum + (c.totalAmount || 0), 0) || 0,
    totalOrders:
      categoryData?.reduce((sum, c) => sum + (c.ordersCount || 0), 0) || 0,
    totalProducts:
      categoryData?.reduce((sum, c) => sum + (c.productsCount || 0), 0) || 0,
  };
  const avgTicket =
    categoryTotals.totalOrders > 0
      ? categoryTotals.totalBilling / categoryTotals.totalOrders
      : 0;

  // Export Facturación function
  const handleExportFacturacion = async () => {
    try {
      // Use the correct singular endpoint that exists in the controller
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`,
      );

      // Get all orders and filter manually since the backend doesn't support these filters on this endpoint
      const allOrders = response.data || [];

      // Parse dates for comparison
      const start = fromDate ? new Date(fromDate + "T00:00:00") : null;
      const end = toDate ? new Date(toDate + "T23:59:59") : null;

      const orders = allOrders.filter((o: any) => {
        // Filter by state (ENTREGADO for billing)
        if (o.status !== "ENTREGADO") return false;

        // Filter by date range
        const orderDate = new Date(o.created_at);
        if (start && orderDate < start) return false;
        if (end && orderDate > end) return false;

        return true;
      });

      if (orders.length === 0) {
        toast.error("No hay datos para exportar en este período");
        return;
      }

      // Create professional Excel with summary and detail
      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = [
        ["REPORTE DE FACTURACIÓN"],
        [""],
        ["Período:", `${fromDate} a ${toDate}`],
        ["Generado:", new Date().toLocaleString("es-PE")],
        [""],
        ["RESUMEN"],
        ["Total Órdenes:", orders.length],
        [
          "Total Facturación:",
          `S/ ${orders.reduce((s: number, o: any) => s + (o.grandTotal || 0), 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`,
        ],
        [
          "Ticket Promedio:",
          `S/ ${(orders.length > 0 ? orders.reduce((s: number, o: any) => s + (o.grandTotal || 0), 0) / orders.length : 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`,
        ],
        [""],
        ["POR CANAL DE VENTA"],
        ...Object.entries(
          orders.reduce((acc: any, o: any) => {
            const ch = o.salesChannel || "OTRO";
            if (!acc[ch]) acc[ch] = { count: 0, total: 0 };
            acc[ch].count++;
            acc[ch].total += o.grandTotal || 0;
            return acc;
          }, {}),
        ).map(([ch, v]: [string, any]) => [
          `  ${ch}:`,
          `${v.count} órdenes - S/ ${v.total.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`,
        ]),
        [""],
        ["POR MÉTODO DE PAGO"],
        ...Object.entries(
          orders.reduce((acc: any, o: any) => {
            const pm = o.paymentMethod || "OTRO";
            if (!acc[pm]) acc[pm] = { count: 0, total: 0 };
            acc[pm].count++;
            acc[pm].total += o.grandTotal || 0;
            return acc;
          }, {}),
        ).map(([pm, v]: [string, any]) => [
          `  ${pm}:`,
          `${v.count} órdenes - S/ ${v.total.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`,
        ]),
      ];
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, "Resumen");

      // Detail sheet
      const detailData = orders.map((o: any) => ({
        "N° Orden": o.orderNumber,
        Fecha: new Date(o.createdAt).toLocaleDateString("es-PE"),
        Hora: new Date(o.createdAt).toLocaleTimeString("es-PE"),
        Cliente: o.customerName || "Sin nombre",
        Teléfono: o.customerPhone || "-",
        "Canal Venta": o.salesChannel,
        "Método Pago": o.paymentMethod,
        Subtotal: o.subtotal || 0,
        Envío: o.shippingCost || 0,
        Descuento: o.discount || 0,
        Total: o.grandTotal || 0,
        Adelanto: o.advancePayment || 0,
        Pendiente: o.pendingPayment || 0,
        Estado: o.status,
      }));
      const detailWs = XLSX.utils.json_to_sheet(detailData);
      XLSX.utils.book_append_sheet(wb, detailWs, "Detalle");

      XLSX.writeFile(wb, `facturacion_${fromDate}_${toDate}.xlsx`);
    } catch (error) {
      console.error("Error exporting:", error);
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-slate-50/50">
      {/* Header with Date Filters */}
      <div className="px-8 py-6 flex items-center justify-between border-b border-slate-200 bg-white shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Análisis Comercial
          </h2>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">
            Distribución de ventas por canal y producto
          </p>
        </div>

        <div className="flex items-center gap-3">
          <PeriodSelector onPeriodChange={handlePeriodChange} />
          {auth?.user?.role === "ADMIN" && (
            <Button
              onClick={handleExportFacturacion}
              variant="outline"
              size="sm"
              className="gap-2 border-slate-200 hover:bg-slate-50"
              disabled={!fromDate || !toDate}
            >
              <Download className="h-4 w-4" />
              Facturación
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 space-y-8">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Canal Top"
            value={topSalesChannel?.channel.replace("_", " ") || "-"}
            subValue={
              topSalesChannel
                ? `${topSalesChannel.percentage}% del total`
                : undefined
            }
            loading={loading}
          />
          <StatCard
            title="Categoría Top"
            value={topCategory?.categoryName || "-"}
            subValue={
              topCategory ? `${topCategory.percentage}% del total` : undefined
            }
            loading={loading}
            clickable={!!topCategory}
            onClick={() => setCategoryModalOpen(true)}
          />
          <StatCard
            title="Ventas Periodo"
            value={`S/ ${channelData?.salesChannels.reduce((sum, c) => sum + c.totalAmount, 0).toLocaleString() || 0}`}
            subValue="Periodo seleccionado"
            loading={loading}
          />
          <StatCard
            title="Órdenes"
            value={`${channelData?.salesChannels.reduce((sum, c) => sum + c.ordersCount, 0) || 0}`}
            subValue="Procesadas"
            loading={loading}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px]">
          {/* Canales Card */}
          <DashboardCard
            title="Rendimiento por Canal"
            isLoading={loading}
            data={
              channelDimension === "sales"
                ? channelData?.salesChannels || []
                : channelData?.closingChannels || []
            }
            filters={[
              {
                label: "Tipo de Canal",
                value: channelDimension,
                onChange: (v: any) => setChannelDimension(v),
                options: [
                  { label: "Canal de Venta", value: "sales" },
                  { label: "Canal de Cierre", value: "closing" },
                ],
              },
            ]}
            summaryStats={[
              {
                label: "Top",
                value:
                  (channelDimension === "sales"
                    ? channelData?.salesChannels[0]?.channel
                    : channelData?.closingChannels[0]?.channel) || "-",
              },
            ]}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={getChannelChartData()}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  vertical={true}
                  stroke="#f1f5f9"
                />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={90}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#64748b", fontWeight: 700 }}
                />
                <Tooltip
                  formatter={(value) => [
                    `S/ ${Number(value).toLocaleString("es-PE")}`,
                    "Monto",
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
                <Bar dataKey="monto" radius={[0, 6, 6, 0]} barSize={28}>
                  {getChannelChartData().map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.fill}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </DashboardCard>

          {/* Productos Card */}
          <DashboardCard
            title="Distribución de Productos"
            isLoading={loading}
            data={productDimension === "category" ? categoryData : brandData}
            filters={[
              {
                label: "Dimension",
                value: productDimension,
                onChange: (v: any) => setProductDimension(v),
                options: [
                  { label: "Categorías", value: "category" },
                  { label: "Marcas", value: "brand" },
                ],
              },
            ]}
            summaryStats={[
              {
                label: "Items",
                value:
                  productDimension === "category"
                    ? categoryData.length
                    : brandData.length,
              },
            ]}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={getProductChartData()}
                  dataKey="monto"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                >
                  {getProductChartData().map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.fill}
                      stroke="none"
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [
                    `S/ ${Number(value).toLocaleString()}`,
                    "Monto",
                  ]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </DashboardCard>
        </div>
      </div>

      {/* Categoría Top Modal */}
      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent className="sm:max-w-7xl w-[90vw] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Detalle por Categorías
            </DialogTitle>
          </DialogHeader>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-b">
            <div className="text-center p-3 bg-blue-500/10 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">
                Facturación Total
              </p>
              <p className="text-lg font-bold text-blue-500">
                S/{" "}
                {categoryTotals.totalBilling.toLocaleString("es-PE", {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="text-center p-3 bg-green-500/10 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">
                Nro. Órdenes
              </p>
              <p className="text-lg font-bold text-green-500">
                {categoryTotals.totalOrders.toLocaleString()}
              </p>
            </div>
            <div className="text-center p-3 bg-purple-500/10 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">
                Nro. Productos
              </p>
              <p className="text-lg font-bold text-purple-500">
                {categoryTotals.totalProducts.toLocaleString()}
              </p>
            </div>
            <div className="text-center p-3 bg-amber-500/10 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">
                Ticket Promedio
              </p>
              <p className="text-lg font-bold text-amber-500">
                S/{" "}
                {avgTicket.toLocaleString("es-PE", {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>

          {/* Categories Table */}
          <div className="flex-1 overflow-auto mt-4 rounded-md border">
            <Table>
              <TableHeader className="bg-muted sticky top-0">
                <TableRow>
                  <TableHead className="text-xs uppercase font-bold text-muted-foreground">
                    #
                  </TableHead>
                  <TableHead className="text-xs uppercase font-bold text-gray-600">
                    Categoría
                  </TableHead>
                  <TableHead className="text-xs uppercase font-bold text-gray-600 text-right">
                    Monto Total
                  </TableHead>
                  <TableHead className="text-xs uppercase font-bold text-gray-600 text-right">
                    Órdenes
                  </TableHead>
                  <TableHead className="text-xs uppercase font-bold text-gray-600 text-right">
                    Productos
                  </TableHead>
                  <TableHead className="text-xs uppercase font-bold text-gray-600 text-right">
                    % Participación
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryData.map((cat, idx) => (
                  <TableRow key={cat.categoryId}>
                    <TableCell className="font-medium">{idx + 1}</TableCell>
                    <TableCell className="font-medium">
                      {cat.categoryName}
                    </TableCell>
                    <TableCell className="text-right">
                      S/{" "}
                      {cat.totalAmount.toLocaleString("es-PE", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {cat.ordersCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {cat.productsCount}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {cat.percentage}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Productos Más Vendidos Modal */}
      <Dialog open={productsModalOpen} onOpenChange={setProductsModalOpen}>
        <DialogContent className="sm:max-w-7xl w-[90vw] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Productos Más Vendidos
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto mt-4 rounded-md border">
            <Table>
              <TableHeader className="bg-muted sticky top-0">
                <TableRow>
                  <TableHead className="text-xs uppercase font-bold text-muted-foreground">
                    #
                  </TableHead>
                  <TableHead className="text-xs uppercase font-bold text-gray-600">
                    {productDimension === "category" ? "Categoría" : "Marca"}
                  </TableHead>
                  <TableHead className="text-xs uppercase font-bold text-gray-600 text-right">
                    Monto Total
                  </TableHead>
                  <TableHead className="text-xs uppercase font-bold text-gray-600 text-right">
                    Órdenes
                  </TableHead>
                  <TableHead className="text-xs uppercase font-bold text-gray-600 text-right">
                    Productos
                  </TableHead>
                  <TableHead className="text-xs uppercase font-bold text-gray-600 text-right">
                    % del Total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(productDimension === "category"
                  ? categoryData
                  : brandData
                ).map((item: any, idx) => (
                  <TableRow key={item.categoryId || item.brandId}>
                    <TableCell className="font-medium">{idx + 1}</TableCell>
                    <TableCell className="font-medium">
                      {item.categoryName || item.brandName}
                    </TableCell>
                    <TableCell className="text-right">
                      S/{" "}
                      {item.totalAmount.toLocaleString("es-PE", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.ordersCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.productsCount}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {item.percentage}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
