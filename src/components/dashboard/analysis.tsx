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
import { Users, Radio, Tag, Package, Loader2, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

// Colores para canales
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

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#6366f1", "#14b8a6"];

export const Analysis: React.FC = () => {
  const { selectedStoreId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [channelData, setChannelData] = useState<{
    salesChannels: ChannelStats[];
    closingChannels: ChannelStats[];
  } | null>(null);
  const [sellerData, setSellerData] = useState<SellerStats[]>([]);
  const [brandData, setBrandData] = useState<BrandStats[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryStats[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchData = async () => {
    if (!selectedStoreId) return;

    setLoading(true);
    try {
      const params: Record<string, string> = { storeId: selectedStoreId };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const [channelRes, sellerRes, brandRes, categoryRes] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/stats/by-channel`, { params }),
        axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/stats/by-seller`, { params }),
        axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/stats/by-brand`, { params }),
        axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/stats/by-category`, { params }),
      ]);

      setChannelData(channelRes.data);
      setSellerData(sellerRes.data);
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

  // Top metrics
  const topSalesChannel = channelData?.salesChannels[0];
  const topClosingChannel = channelData?.closingChannels[0];
  const topCategory = categoryData.find(c => c.categoryId !== "SIN_CATEGORIA") || categoryData[0];
  const topBrand = brandData.find(b => b.brandId !== "SIN_MARCA") || brandData[0];

  // Prepare chart data
  const salesChannelChartData = channelData?.salesChannels.map((c) => ({
    name: c.channel.replace("_", " "),
    monto: c.totalAmount,
    ordenes: c.ordersCount,
    fill: CHANNEL_COLORS[c.channel] || "#8884d8",
  })) || [];

  const closingChannelChartData = channelData?.closingChannels.map((c) => ({
    name: c.channel.replace("_", " "),
    monto: c.totalAmount,
    ordenes: c.ordersCount,
    percentage: c.percentage,
    fill: CHANNEL_COLORS[c.channel] || "#8884d8",
  })) || [];

  const categoryChartData = categoryData.slice(0, 6).map((c, i) => ({
    name: c.categoryName,
    monto: c.totalAmount,
    percentage: c.percentage,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const brandChartData = brandData.slice(0, 6).map((b, i) => ({
    name: b.brandName,
    monto: b.totalAmount,
    percentage: b.percentage,
    fill: CHART_COLORS[i % CHART_COLORS.length],
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
            title="Canal de Venta Principal"
            value={topSalesChannel?.channel.replace("_", " ") || "-"}
            subValue={topSalesChannel ? `S/${topSalesChannel.totalAmount.toLocaleString("es-PE")} (${topSalesChannel.percentage}%)` : undefined}
            icon={<Radio className="h-4 w-4 text-muted-foreground" />}
            loading={loading}
          />
          <StatCard
            title="Canal de Cierre Principal"
            value={topClosingChannel?.channel.replace("_", " ") || "-"}
            subValue={topClosingChannel ? `S/${topClosingChannel.totalAmount.toLocaleString("es-PE")} (${topClosingChannel.percentage}%)` : undefined}
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
            loading={loading}
          />
          <StatCard
            title="Categoría Líder"
            value={topCategory?.categoryName || "-"}
            subValue={topCategory ? `S/${topCategory.totalAmount.toLocaleString("es-PE")} (${topCategory.percentage}%)` : undefined}
            icon={<Tag className="h-4 w-4 text-muted-foreground" />}
            loading={loading}
          />
          <StatCard
            title="Marca Líder"
            value={topBrand?.brandName || "-"}
            subValue={topBrand ? `S/${topBrand.totalAmount.toLocaleString("es-PE")} (${topBrand.percentage}%)` : undefined}
            icon={<Package className="h-4 w-4 text-muted-foreground" />}
            loading={loading}
          />
        </div>

        {/* Gráficos - Fila 1 */}
        <div className="grid gap-4 md:grid-cols-2 min-h-[300px]">
          {/* Canales de Venta */}
          <Card>
            <CardHeader>
              <CardTitle>Canales de Venta</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-[200px]">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={salesChannelChartData}
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
                      {salesChannelChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Canales de Cierre (Pie Chart) */}
          <Card>
            <CardHeader>
              <CardTitle>Canales de Cierre</CardTitle>
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
                      data={closingChannelChartData}
                      dataKey="monto"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ name, percentage }) => `${name} (${percentage}%)`}
                    >
                      {closingChannelChartData.map((entry, index) => (
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
        </div>

        {/* Gráficos - Fila 2: Categorías y Marcas */}
        <div className="grid gap-4 md:grid-cols-2 min-h-[300px]">
          {/* Categorías */}
          <Card>
            <CardHeader>
              <CardTitle>Ventas por Categoría</CardTitle>
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
                      data={categoryChartData}
                      dataKey="monto"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ name, percentage }) => `${name} (${percentage}%)`}
                    >
                      {categoryChartData.map((entry, index) => (
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

          {/* Marcas */}
          <Card>
            <CardHeader>
              <CardTitle>Ventas por Marca</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-[200px]">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={brandChartData}
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
                      {brandChartData.map((entry, index) => (
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
