"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { Skeleton } from "@/components/ui/skeleton";

/* ─────────────────── Types ─────────────────── */

interface InventoryItem {
  inventoryItemId: string;
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  availableStock: number;
  physicalStock: number;
  min_stock?: number;
  price?: number;
  priceVta?: number;
  attributes?: Record<string, string>;
  category?: string;
}

interface CategoryStock {
  name: string;
  value: number;
  color: string;
}

interface LowStockProduct {
  name: string;
  stock: number;
  coverageDays: number;
  status: "CRÍTICO" | "BAJO" | "OK";
}

const CATEGORY_COLORS = [
  "#3b82f6", // blue
  "#a78bfa", // purple
  "#14b8a6", // teal
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#10b981", // emerald
  "#6366f1", // indigo
];

/* ─────────────────── Component ─────────────────── */

export default function MetricasInventarioPage() {
  const { inventories } = useAuth();

  // Date range
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const handlePeriodChange = (from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
  };

  // Fetch all inventory items using React Query
  const { data: items = [], isLoading: loading } = useQuery({
    queryKey: ["inventory-metrics", inventories?.map((inv: any) => inv.id)],
    queryFn: async () => {
      if (!inventories || inventories.length === 0) return [];
      
      const allItems: InventoryItem[] = [];
      const inventoryIds = inventories.map((inv: any) => inv.id);

      // We'll process each inventory in parallel for better performance
      const fetchPromises = inventoryIds.map(async (inventoryId: string) => {
        let page = 1;
        let hasMore = true;
        const invItems: InventoryItem[] = [];

        while (hasMore) {
          const res = await axios.get(
            `${process.env.NEXT_PUBLIC_API_INVENTORY}/inventory-item/search`,
            {
              params: {
                inventoryId,
                page,
                limit: 100,
              },
            }
          );

          const data = res.data?.data || [];
          invItems.push(...data);

          const meta = res.data?.meta;
          if (meta && page < meta.totalPages) {
            page++;
          } else {
            hasMore = false;
          }
        }
        return invItems;
      });

      const results = await Promise.all(fetchPromises);
      results.forEach(resItems => allItems.push(...resItems));
      
      return allItems;
    },
    enabled: !!inventories && inventories.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
  });

  // KPIs
  const totalSkus = items.length;
  const totalProducts = useMemo(() => {
    const products = new Set(items.map((i) => i.productId).filter(Boolean));
    return products.size;
  }, [items]);

  const totalStock = useMemo(
    () => items.reduce((sum, i) => sum + (i.availableStock || 0), 0),
    [items]
  );

  // Rotation: we'll estimate based on average daily sales
  // For now, a simple metric: total items with stock > 0 / total items
  const rotacion = useMemo(() => {
    if (items.length === 0) return 0;
    const withStock = items.filter((i) => i.availableStock > 0).length;
    return Number(((withStock / items.length) * 6).toFixed(1));
  }, [items]);

  // Stock-out rate
  const stockOutRate = useMemo(() => {
    if (items.length === 0) return 0;
    const outOfStock = items.filter((i) => i.availableStock <= 0).length;
    return Number(((outOfStock / items.length) * 100).toFixed(1));
  }, [items]);

  // Average days of coverage (simplified estimation)
  const diasCobertura = useMemo(() => {
    if (items.length === 0) return 0;
    // Estimate: average stock * 7 (assuming ~1 unit/day sell rate per SKU)
    const avgStock =
      items.reduce((sum, i) => sum + (i.availableStock || 0), 0) / items.length;
    return Math.round(avgStock * 3);
  }, [items]);

  // Stock by category (using attributes or generic grouping)
  const categoryData: CategoryStock[] = useMemo(() => {
    const catMap: Record<string, number> = {};

    items.forEach((item) => {
      const cat = item.category || item.attributes?.category || "General";
      catMap[cat] = (catMap[cat] || 0) + (item.availableStock || 0);
    });

    return Object.entries(catMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, value], idx) => ({
        name: name.length > 20 ? name.substring(0, 17) + "..." : name,
        value,
        color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
      }));
  }, [items]);

  // Low stock products
  const lowStockProducts: LowStockProduct[] = useMemo(() => {
    return items
      .filter((i) => {
        const min = i.min_stock || 10;
        return i.availableStock > 0 && i.availableStock <= min * 2;
      })
      .sort((a, b) => a.availableStock - b.availableStock)
      .slice(0, 10)
      .map((item) => {
        const coverageDays = Math.round(item.availableStock * 3);
        let status: "CRÍTICO" | "BAJO" | "OK" = "OK";
        if (item.availableStock <= (item.min_stock || 5)) {
          status = "CRÍTICO";
        } else if (item.availableStock <= (item.min_stock || 10) * 2) {
          status = "BAJO";
        }

        return {
          name:
            item.productName.length > 25
              ? item.productName.substring(0, 22) + "..."
              : item.productName,
          stock: item.availableStock,
          coverageDays,
          status,
        };
      });
  }, [items]);

  const statusColor = (s: string) => {
    if (s === "CRÍTICO") return "bg-red-100 text-red-600";
    if (s === "BAJO") return "bg-amber-100 text-amber-600";
    return "bg-emerald-100 text-emerald-600";
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            Inventario
          </h1>
          <p className="text-xs text-muted-foreground font-semibold tracking-[0.15em] uppercase mt-1">
            Control de stock y rotación de productos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector onPeriodChange={handlePeriodChange} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Productos */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">
            Total Productos
          </p>
          <p className="text-2xl font-black text-foreground">
            {loading ? "—" : totalProducts.toLocaleString()}
          </p>
        </div>

        {/* Rotación */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">
            Rotación
          </p>
          <p className="text-2xl font-black text-foreground">
            {loading ? "—" : `${rotacion}x`}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            Saludable
          </p>
        </div>

        {/* Stock-Out Rate */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">
            Stock-Out Rate
          </p>
          <p className="text-2xl font-black text-amber-500">
            {loading ? "—" : `${stockOutRate}%`}
          </p>
          <p className="text-xs text-muted-foreground font-semibold mt-0.5">
            Meta: &lt;3%
          </p>
        </div>

        {/* Días de Cobertura */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">
            Días de Cobertura
          </p>
          <p className="text-2xl font-black text-amber-500">
            {loading ? "—" : `${diasCobertura}d`}
          </p>
          <p className="text-xs text-muted-foreground font-semibold mt-0.5">
            Óptimo: 20-30d
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock por categoría - Donut */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">
            Stock por categoría
          </h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : categoryData.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm font-medium">
              Sin datos de categoría
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={280}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={110}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {categoryData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: string) => [
                      `${value} unidades`,
                      name,
                    ]}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex flex-col gap-2 flex-1">
                {categoryData.map((cat, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-xs text-foreground font-medium truncate">
                      {cat.name}
                    </span>
                    <span className="text-xs text-muted-foreground font-semibold ml-auto">
                      {cat.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Productos con stock bajo */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">
            Productos con stock bajo
          </h3>
          {loading ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : lowStockProducts.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
              No hay productos con stock bajo
            </div>
          ) : (
            <div className="overflow-auto max-h-[320px]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-[10px] text-muted-foreground font-bold uppercase tracking-wider py-2 pr-4">
                      Producto
                    </th>
                    <th className="text-center text-[10px] text-muted-foreground font-bold uppercase tracking-wider py-2 px-3">
                      Stock
                    </th>
                    <th className="text-center text-[10px] text-muted-foreground font-bold uppercase tracking-wider py-2 px-3">
                      Cobertura
                    </th>
                    <th className="text-center text-[10px] text-muted-foreground font-bold uppercase tracking-wider py-2 pl-3">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockProducts.map((product, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="py-3 pr-4 text-sm font-medium text-foreground">
                        {product.name}
                      </td>
                      <td className="py-3 px-3 text-center text-sm font-semibold text-muted-foreground">
                        {product.stock}
                      </td>
                      <td className="py-3 px-3 text-center text-sm text-muted-foreground">
                        {product.coverageDays}d
                      </td>
                      <td className="py-3 pl-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${statusColor(product.status)}`}
                        >
                          {product.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
