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
  Cell,
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
  loading?: boolean;
}> = ({ title, value, subValue, loading }) => (
  <Card className="bg-white border border-slate-200 shadow-sm hover:ring-1 hover:ring-primary/20 transition-all duration-300 overflow-hidden">
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



  const fetchSellers = async (from?: string, to?: string) => {
    if (!companyId) {

      return;
    }
    setLoading(true);

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


      setSellers(enrichedSellers);
    } catch (error) {
      console.error("Error fetching sellers:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
    <div className="flex flex-col h-full w-full overflow-auto bg-slate-50/50">
      {/* Header */}
      <div className="px-8 py-6 flex items-center justify-between border-b border-slate-200 bg-white shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Gestión de Equipo
          </h2>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">
            Rendimiento de vendedores y colaboradores
          </p>
        </div>
        <PeriodSelector onPeriodChange={handlePeriodChange} />
      </div>

      <div className="p-8 space-y-8">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Vendedor Estrella"
          value={topSeller?.sellerName || "N/A"}
          subValue={
            topSeller
              ? `S/ ${topSeller.totalSales.toLocaleString()}`
              : undefined
          }
          loading={loading}
        />
        <StatCard
          title="Colaboradores Activos"
          value={realCollaborators.length}
          subValue="Con ventas en el periodo"
          loading={loading}
        />
        <StatCard
          title="Promedio por Vendedor"
          value={
            realCollaborators.length > 0
              ? `S/ ${Math.round(totalSalesOverall / realCollaborators.length).toLocaleString()}`
              : "-"
          }
          subValue="Venta media"
          loading={loading}
        />
        <StatCard
          title="Efectividad Entrega"
          value={`${overallEffectiveness}%`}
          subValue={`${overallDelivered}/${overallCreated} entregados`}
          loading={loading}
        />
      </div>

      {/* Current User Stats Card */}
      {currentUserStats && (
        <Card className="bg-white border border-green-200 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-black text-green-600 uppercase tracking-widest mb-4">
              Tus Ventas — {currentUserStats.sellerName}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Facturación</p>
                <p className="text-lg font-bold text-green-600">
                  S/ {currentUserStats.totalSales.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Órdenes</p>
                <p className="text-lg font-bold text-green-600">
                  {currentUserStats.orderCount}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Productos</p>
                <p className="text-lg font-bold text-green-600">
                  {currentUserStats.productsCount}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Ticket Promedio</p>
                <p className="text-lg font-bold text-green-600">
                  S/ {currentUserStats.averageTicket.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Efectividad</p>
                <p className="text-lg font-bold text-green-600">
                  {currentUserStats.deliveryEffectiveness || 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ventas por Colaborador - full width */}
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
        className="h-auto"
      >
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={activeSellers.map((s, i) => ({
                ...s,
                fill: CHART_COLORS[i % CHART_COLORS.length],
              }))}
              margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f1f5f9"
              />
              <XAxis
                dataKey="sellerName"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#64748b", fontWeight: 700 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }}
                tickFormatter={(v) => `S/${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-xl text-xs">
                        <p className="font-bold mb-2 text-slate-800 border-b border-slate-100 pb-1">
                          {label}
                        </p>
                        <div className="space-y-1">
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-500 font-medium">Ventas:</span>
                            <span className="font-bold text-slate-800">S/ {data.totalSales.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-500">Órdenes:</span>
                            <span className="font-bold text-slate-800">{data.orderCount}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-500">Productos:</span>
                            <span className="font-bold text-slate-800">{data.productsCount}</span>
                          </div>
                          <div className="mt-1 pt-1 border-t border-slate-100 flex justify-between gap-4">
                            <span className="text-green-600">Efectividad:</span>
                            <span className="font-bold text-green-600">{data.deliveryEffectiveness || 0}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="totalSales" radius={[4, 4, 0, 0]} barSize={60}>
                {activeSellers.map((_, i) => (
                  <Cell
                    key={`cell-${i}`}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </DashboardCard>

      </div>
    </div>
  );
};
