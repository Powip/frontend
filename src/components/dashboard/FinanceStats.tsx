"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import {
  Wallet,
  Landmark,
  TrendingDown,
  BarChart3,
  Receipt,
  Package,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardCard } from "./DashboardCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

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

export const FinanceStats: React.FC = () => {
  const { selectedStoreId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<BillingStats[]>([]);
  const [inventoryValue, setInventoryValue] = useState(0);

  const fetchData = async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const [billingRes, invRes] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/stats/billing`, {
          params: { storeId: selectedStoreId },
        }),
        axios.get(
          `${process.env.NEXT_PUBLIC_API_INVENTORY}/stats/inventory-value`,
          {
            params: { storeId: selectedStoreId },
          },
        ),
      ]);

      setBilling(billingRes.data || []);
      setInventoryValue(invRes.data?.totalValue || 0);
    } catch (error) {
      console.error("Error fetching finance stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedStoreId]);

  const currentYearSales = billing.reduce((sum, b) => sum + b.currentYear, 0);
  const previousYearSales = billing.reduce((sum, b) => sum + b.previousYear, 0);
  const growth =
    previousYearSales > 0
      ? ((currentYearSales - previousYearSales) / previousYearSales) * 100
      : 0;

  return (
    <div className="flex flex-col h-full w-full overflow-auto bg-gray-50/50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Panel Financiero</h2>
          <p className="text-sm text-gray-500">
            Estado de ingresos, egresos y valorización de activos
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Valor Inventario"
          value={`S/ ${inventoryValue.toLocaleString()}`}
          subValue="Costo de reposición est."
          icon={<Package className="h-5 w-5 text-primary" />}
          loading={loading}
        />
        <StatCard
          title="Ingresos Totales (YTD)"
          value={`S/ ${currentYearSales.toLocaleString()}`}
          subValue={`${growth >= 0 ? "+" : ""}${growth.toFixed(1)}% vs año anterior`}
          icon={<Wallet className="h-5 w-5 text-primary" />}
          loading={loading}
        />
        <StatCard
          title="Facturación Media"
          value={`S/ ${Math.round(currentYearSales / (billing.filter((b) => b.currentYear > 0).length || 1)).toLocaleString()}`}
          subValue="Mensual"
          icon={<Landmark className="h-5 w-5 text-primary" />}
          loading={loading}
        />
        <StatCard
          title="Margen Estimado"
          value="32.4%"
          subValue="Bruto antes de operativos"
          icon={<TrendingDown className="h-5 w-5 text-primary" />}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evolución Card */}
        <div className="lg:col-span-2">
          <DashboardCard
            title="Evolución de Ingresos (Año Actual vs Anterior)"
            isLoading={loading}
            data={billing}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={billing.map((b) => ({
                  name: b.monthName,
                  Actual: b.currentYear,
                  Anterior: b.previousYear,
                }))}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                <Area
                  type="monotone"
                  dataKey="Actual"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorActual)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Anterior"
                  stroke="#94a3b8"
                  fillOpacity={0}
                  strokeDasharray="5 5"
                />
              </AreaChart>
            </ResponsiveContainer>
          </DashboardCard>
        </div>

        {/* Resumen Diario Placeholder */}
        <DashboardCard
          title="Distribución Mensual"
          isLoading={loading}
          data={billing}
        >
          <div className="space-y-4">
            {billing
              .filter((b) => b.currentYear > 0)
              .slice(-5)
              .reverse()
              .map((b) => (
                <div
                  key={b.month}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <Receipt className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-gray-700">
                      {b.monthName}
                    </span>
                  </div>
                  <span className="font-bold text-gray-900">
                    S/ {b.currentYear.toLocaleString()}
                  </span>
                </div>
              ))}
          </div>
        </DashboardCard>
      </div>
    </div>
  );
};
