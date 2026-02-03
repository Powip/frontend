"use client";

console.log("[DEBUG] Archivo TeamManagement.tsx cargado");

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
} from "recharts";
import {
  Users,
  TrendingUp,
  Award,
  UserCheck,
  Loader2,
  Truck,
  Target,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardCard } from "./DashboardCard";
import { PeriodSelector } from "./PeriodSelector";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SellerStats {
  sellerId: string;
  sellerName: string;
  totalSales: number;
  orderCount: number;
  productsCount: number;
  averageTicket: number;
  monthlySales: number;
  weeklySales: number;
  deliveredCount?: number;
  createdCount?: number;
  deliveryEffectiveness?: number;
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

const CHART_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#6366f1",
];

export const TeamManagement: React.FC = () => {
  const { auth, selectedStoreId } = useAuth();
  const companyId = auth?.company?.id;
  const currentUserId = auth?.user?.id;
  const [loading, setLoading] = useState(true);
  const [sellers, setSellers] = useState<SellerStats[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [deliveryStats, setDeliveryStats] = useState<
    Record<string, { delivered: number; created: number }>
  >({});

  console.log("[DEBUG] TeamManagement renderizando", {
    companyId,
    selectedStoreId,
  });

  const fetchSellers = async (from?: string, to?: string) => {
    if (!companyId) {
      console.warn("[DEBUG] fetchSellers abortado: companyId es nulo");
      return;
    }
    setLoading(true);
    console.log("[DEBUG] fetchSellers iniciando para:", companyId);
    try {
      const params: Record<string, string> = {};
      if (from) params.fromDate = from;
      if (to) params.toDate = to;

      // Fetch seller stats and delivery effectiveness in parallel
      const [sellerRes, deliveryRes] = await Promise.all([
        axios.get(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/summary/company/${companyId}/sellers`,
          { params },
        ),
        axios
          .get(
            `${process.env.NEXT_PUBLIC_API_VENTAS}/stats/delivery-by-seller`,
            { params: { ...params, storeId: selectedStoreId } },
          )
          .catch(() => ({ data: [] })), // Gracefully handle if endpoint doesn't exist
      ]);

      // Build delivery stats map
      const delStats: Record<string, { delivered: number; created: number }> =
        {};
      (deliveryRes.data || []).forEach((d: any) => {
        delStats[d.sellerId] = {
          delivered: d.deliveredCount || 0,
          created: d.createdCount || 0,
        };
      });
      setDeliveryStats(delStats);

      // Merge delivery effectiveness into seller data
      const enrichedSellers = (sellerRes.data || []).map((s: SellerStats) => {
        const del = delStats[s.sellerId];
        return {
          ...s,
          deliveredCount: del?.delivered || 0,
          createdCount: del?.created || s.orderCount,
          deliveryEffectiveness:
            del && del.created > 0
              ? Math.round((del.delivered / del.created) * 100)
              : 0,
        };
      });

      console.log("[DEBUG] fetchSellers respuesta:", enrichedSellers);
      setSellers(enrichedSellers);
    } catch (error) {
      console.error("[DEBUG] Error fetching sellers:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("[DEBUG] TeamManagement montado");
    if (companyId && fromDate && toDate) {
      fetchSellers(fromDate, toDate);
    }
  }, [companyId, fromDate, toDate]);

  const handlePeriodChange = (from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
  };

  const activeSellers = (sellers || []).filter(
    (s) => s && s.sellerId && s.sellerId !== "unknown",
  );

  const realCollaborators = activeSellers.filter(
    (s) => s.sellerId !== "unassigned",
  );

  const topSeller =
    realCollaborators.length > 0
      ? [...realCollaborators].sort((a, b) => b.totalSales - a.totalSales)[0]
      : null;

  const totalSalesOverall = (sellers || []).reduce(
    (sum, s) => sum + (s?.totalSales || 0),
    0,
  );

  // Calculate overall delivery effectiveness
  const overallDelivered = (sellers || []).reduce(
    (sum, s) => sum + (s?.deliveredCount || 0),
    0,
  );
  const overallCreated = (sellers || []).reduce(
    (sum, s) => sum + (s?.createdCount || s?.orderCount || 0),
    0,
  );
  const overallEffectiveness =
    overallCreated > 0
      ? Math.round((overallDelivered / overallCreated) * 100)
      : 0;

  // Current user's stats (for "Tus Ventas")
  const currentUserStats = sellers.find((s) => s.sellerId === currentUserId);

  return (
    <div className="flex flex-col h-full w-full overflow-auto bg-gray-50/50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Gestión de Equipo</h2>
          <p className="text-sm text-gray-500">
            Monitoreo de desempeño y tiempos de respuesta
          </p>
        </div>
        <PeriodSelector onPeriodChange={handlePeriodChange} />
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Vendedor Estrella"
          value={topSeller?.sellerName || "N/A"}
          subValue={
            topSeller
              ? `S/ ${topSeller.totalSales.toLocaleString()}`
              : undefined
          }
          icon={<Award className="h-5 w-5 text-primary" />}
          loading={loading}
        />
        <StatCard
          title="Colaboradores Activos"
          value={realCollaborators.length}
          subValue="Con ventas en el periodo"
          icon={<Users className="h-5 w-5 text-primary" />}
          loading={loading}
        />
        <StatCard
          title="Promedio por Vendedor"
          value={
            realCollaborators.length > 0
              ? `S/ ${Math.round(totalSalesOverall / realCollaborators.length).toLocaleString()}`
              : "-"
          }
          subValue="Venta media (incl. sin asignar)"
          icon={<TrendingUp className="h-5 w-5 text-primary" />}
          loading={loading}
        />
        <StatCard
          title="Efectividad Entrega"
          value={`${overallEffectiveness}%`}
          subValue={`${overallDelivered}/${overallCreated} entregados`}
          icon={<Truck className="h-5 w-5 text-primary" />}
          loading={loading}
        />
      </div>

      {/* Current User Stats Card */}
      {currentUserStats && (
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary uppercase flex items-center gap-2">
              <Target className="h-4 w-4" />
              Tus Ventas - {currentUserStats.sellerName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-xs text-gray-500">Facturación</p>
                <p className="text-lg font-bold">
                  S/ {currentUserStats.totalSales.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Órdenes</p>
                <p className="text-lg font-bold">
                  {currentUserStats.orderCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Productos</p>
                <p className="text-lg font-bold">
                  {currentUserStats.productsCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Ticket Promedio</p>
                <p className="text-lg font-bold">
                  S/ {currentUserStats.averageTicket.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Efectividad</p>
                <p className="text-lg font-bold text-primary">
                  {currentUserStats.deliveryEffectiveness || 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Desempeño Ventas */}
        <DashboardCard
          title="Ventas por Colaborador"
          isLoading={loading}
          data={activeSellers}
          summaryStats={[
            {
              label: "Total",
              value: `S/ ${totalSalesOverall.toLocaleString()}`,
            },
          ]}
        >
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={activeSellers.map((s, i) => ({
                  ...s,
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
                  dataKey="sellerName"
                  axisLine={false}
                  tickLine={false}
                  style={{ fontSize: "12px" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  style={{ fontSize: "12px" }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const prodPerOrder =
                        data.orderCount > 0
                          ? (data.productsCount / data.orderCount).toFixed(1)
                          : 0;
                      return (
                        <div className="bg-white p-3 border border-gray-100 shadow-lg rounded-lg text-xs">
                          <p className="font-bold mb-2 text-gray-800 border-b pb-1">
                            {label}
                          </p>
                          <div className="space-y-1">
                            <div className="flex justify-between gap-4">
                              <span className="text-blue-600 font-medium">
                                Ventas:
                              </span>
                              <span className="font-bold">
                                S/ {data.totalSales.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-500">Órdenes:</span>
                              <span className="font-bold">
                                {data.orderCount}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-500">Productos:</span>
                              <span className="font-bold">
                                {data.productsCount}
                              </span>
                            </div>
                            <div className="mt-1 pt-1 border-t flex justify-between gap-4">
                              <span className="text-primary italic">
                                Prod/Orden:
                              </span>
                              <span className="font-bold text-primary">
                                {prodPerOrder}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-green-600">
                                Efectividad:
                              </span>
                              <span className="font-bold text-green-600">
                                {data.deliveryEffectiveness || 0}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="totalSales" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardCard>
      </div>

      {/* Tabla Detallada */}
      <DashboardCard
        title="Detalle de Performance"
        isLoading={loading}
        data={activeSellers}
        className="h-auto min-h-[400px]"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th className="px-6 py-3">Vendedor</th>
                <th className="px-6 py-3">Monto Total</th>
                <th className="px-6 py-3"># Órdenes</th>
                <th className="px-6 py-3"># Productos</th>
                <th className="px-6 py-3">Ticket Prom.</th>
                <th className="px-6 py-3">Efectividad</th>
              </tr>
            </thead>
            <tbody>
              {activeSellers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center">
                    No hay datos de vendedores para mostrar
                  </td>
                </tr>
              ) : (
                activeSellers.map((s) => (
                  <tr
                    key={s.sellerId}
                    className="bg-white border-b hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {s.sellerName}
                    </td>
                    <td className="px-6 py-4">
                      S/ {s.totalSales.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">{s.orderCount}</td>
                    <td className="px-6 py-4">{s.productsCount}</td>
                    <td className="px-6 py-4">
                      S/ {s.averageTicket.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          (s.deliveryEffectiveness || 0) >= 80
                            ? "bg-green-100 text-green-700"
                            : (s.deliveryEffectiveness || 0) >= 50
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {s.deliveryEffectiveness || 0}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DashboardCard>
    </div>
  );
};
