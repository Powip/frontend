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
import { Users, Radio, Tag, Package, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "./DashboardCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

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
  totalAmount: number;
  percentage: number;
}

interface CategoryStats {
  categoryId: string;
  categoryName: string;
  ordersCount: number;
  totalAmount: number;
  percentage: number;
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
  const { selectedStoreId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [channelData, setChannelData] = useState<{
    salesChannels: ChannelStats[];
    closingChannels: ChannelStats[];
  } | null>(null);
  const [brandData, setBrandData] = useState<BrandStats[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryStats[]>([]);

  // Local states for filters
  const [channelDimension, setChannelDimension] = useState<"sales" | "closing">(
    "sales",
  );
  const [productDimension, setProductDimension] = useState<
    "category" | "brand"
  >("category");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchData = async () => {
    if (!selectedStoreId) return;

    setLoading(true);
    try {
      const params: Record<string, string> = { storeId: selectedStoreId };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

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
    fetchData();
  }, [selectedStoreId]);

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

  const topSalesChannel = channelData?.salesChannels[0];
  const topCategory =
    categoryData.find((c) => c.categoryId !== "SIN_CATEGORIA") ||
    categoryData[0];

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-gray-50/50">
      {/* Header with Date Filters */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/5 rounded-lg text-primary">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              Análisis de Mercado
            </h2>
            <p className="text-xs text-gray-500">
              Distribución de ventas por canal y producto
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
            title="Canal Top"
            value={topSalesChannel?.channel.replace("_", " ") || "-"}
            subValue={
              topSalesChannel
                ? `${topSalesChannel.percentage}% del total`
                : undefined
            }
            icon={<Radio className="h-5 w-5 text-primary" />}
            loading={loading}
          />
          <StatCard
            title="Categoría Top"
            value={topCategory?.categoryName || "-"}
            subValue={
              topCategory ? `${topCategory.percentage}% del total` : undefined
            }
            icon={<Tag className="h-5 w-5 text-primary" />}
            loading={loading}
          />
          <StatCard
            title="Ventas Totales"
            value={`S/ ${channelData?.salesChannels.reduce((sum, c) => sum + c.totalAmount, 0).toLocaleString() || 0}`}
            subValue="Periodo seleccionado"
            icon={<Package className="h-5 w-5 text-primary" />}
            loading={loading}
          />
          <StatCard
            title="Total Pedidos"
            value={`${channelData?.salesChannels.reduce((sum, c) => sum + c.ordersCount, 0) || 0}`}
            subValue="Ordenes procesadas"
            icon={<Users className="h-5 w-5 text-primary" />}
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
                  style={{ fontSize: "12px" }}
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
                <Bar dataKey="monto" radius={[0, 4, 4, 0]} barSize={20}>
                  {getChannelChartData().map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.fill}
                      fillOpacity={0.8}
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
    </div>
  );
};
