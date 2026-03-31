"use client";

import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ComposedChart,
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
import { isSuperadmin, hasAdminAccess } from "@/config/permissions.config";
import { DashboardCard } from "./DashboardCard";

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
  <Card className="bg-card border border-border shadow-sm hover:ring-1 hover:ring-primary/20 transition-all duration-300 overflow-hidden">
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

const CHART_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#6366f1",
];

const PIE_COLORS = [
  "#10b981", 
  "#f59e0b", 
  "#ef4444", 
  "#3b82f6", 
  "#6366f1", 
  "#8b5cf6"
];

interface TeamManagementProps {
  fromDate: string;
  toDate: string;
}

export const TeamManagement: React.FC<TeamManagementProps> = ({ fromDate, toDate }) => {
  const { auth, selectedStoreId } = useAuth();
  const companyId = auth?.company?.id;
  const currentUserId = auth?.user?.id;
  const currentUserRole = auth?.user?.role;
  const isAdmin = isSuperadmin(auth?.user?.email) || hasAdminAccess(currentUserRole);

  const [loading, setLoading] = useState(true);
  
  // States for Admin View
  const [sellers, setSellers] = useState<SellerStats[]>([]);
  const [deliveryStats, setDeliveryStats] = useState<
    Record<string, { delivered: number; created: number }>
  >({});

  // State for Ventas View
  const [sellerSummary, setSellerSummary] = useState<any>(null);

  const fetchStats = useCallback(
    async (from?: string, to?: string) => {
      if (!companyId || !selectedStoreId) return;
      setLoading(true);

      try {
        const params: Record<string, string> = {};
        if (from) params.fromDate = from;
        if (to) params.toDate = to;

        if (isAdmin) {
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
              .catch(() => ({ data: [] })),
          ]);

          const delStats: Record<
            string,
            { delivered: number; created: number }
          > = {};
          (deliveryRes.data || []).forEach((d: any) => {
            delStats[d.sellerId] = {
              delivered: d.deliveredCount || 0,
              created: d.createdCount || 0,
            };
          });
          setDeliveryStats(delStats);

          const enrichedSellers = (sellerRes.data || []).map(
            (s: SellerStats) => {
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
            },
          );
          setSellers(enrichedSellers);
        } else {
          // Fetch personalized stats using backend sellerId filter
          const res = await axios.get(
            `${process.env.NEXT_PUBLIC_API_VENTAS}/stats/summary`,
            {
              params: {
                ...params,
                storeId: selectedStoreId,
                sellerId: currentUserId,
              },
            },
          );
          setSellerSummary(res.data);
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    },
    [companyId, selectedStoreId, isAdmin, currentUserId],
  );

  useEffect(() => {
    if (companyId && selectedStoreId && fromDate && toDate) {
      fetchStats(fromDate, toDate);
    }
  }, [companyId, selectedStoreId, fromDate, toDate, fetchStats]);

  // Calculations for ADMIN
  const activeSellers = (sellers || []).filter((s) => s && s.sellerId && s.sellerId !== "unknown");
  const realCollaborators = activeSellers.filter((s) => s.sellerId !== "unassigned");
  const topSeller = realCollaborators.length > 0
      ? [...realCollaborators].sort((a, b) => b.totalSales - a.totalSales)[0]
      : null;
  const totalSalesOverall = (sellers || []).reduce((sum, s) => sum + (s?.totalSales || 0), 0);
  const overallDelivered = (sellers || []).reduce((sum, s) => sum + (s?.deliveredCount || 0), 0);
  const overallCreated = (sellers || []).reduce((sum, s) => sum + (s?.createdCount || s?.orderCount || 0), 0);
  const overallEffectiveness = overallCreated > 0 ? Math.round((overallDelivered / overallCreated) * 100) : 0;
  const currentUserAdminStats = sellers.find((s) => s.sellerId === currentUserId);

  // Calculations for VENTAS
  const sellerDailySales = sellerSummary?.dailySales || [];
  const sellerByStatusArray = sellerSummary?.byStatus 
    ? Object.entries(sellerSummary.byStatus).map(([status, data]: [string, any]) => ({
        name: status,
        value: data.count,
      })).filter(s => s.value > 0).sort((a, b) => b.value - a.value)
    : [];
  
  const sellerEffectiveness = sellerSummary?.funnelMetrics?.ingresados > 0 
    ? Math.round((sellerSummary?.funnelMetrics?.entregados / sellerSummary?.funnelMetrics?.ingresados) * 100) 
    : 0;

  return (
    <div className="flex flex-col h-full w-full overflow-auto bg-background">
      {/* Header */}
      <div className="px-8 py-6 flex items-center justify-between border-b border-border bg-card shadow-sm">
        <div>
          <h2 className="text-xl font-black text-foreground tracking-tight">
            Gestión de Equipo
          </h2>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1">
            {isAdmin ? "Rendimiento de vendedores y colaboradores" : "Tus gráficas y métricas de desempeño individual"}
          </p>
        </div>
      </div>

      <div className="p-8 space-y-8">
        {isAdmin ? (
          <>
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
            {currentUserAdminStats && (
              <Card className="bg-card border border-border shadow-sm">
                <CardContent className="p-5">
                  <p className="text-xs font-black text-green-500 uppercase tracking-widest mb-4">
                    Tus Ventas — {currentUserAdminStats.sellerName}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Facturación</p>
                      <p className="text-lg font-bold text-green-500">
                        S/ {currentUserAdminStats.totalSales.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Órdenes</p>
                      <p className="text-lg font-bold text-green-500">
                        {currentUserAdminStats.orderCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Productos</p>
                      <p className="text-lg font-bold text-green-500">
                        {currentUserAdminStats.productsCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Ticket Promedio</p>
                      <p className="text-lg font-bold text-green-500">
                        S/ {currentUserAdminStats.averageTicket.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Efectividad</p>
                      <p className="text-lg font-bold text-green-500">
                        {currentUserAdminStats.deliveryEffectiveness || 0}%
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
                      cursor={{ fill: "var(--foreground)", opacity: 0.05 }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-card p-3 border border-border shadow-lg rounded-xl text-xs">
                              <p className="font-bold mb-2 text-foreground border-b border-border pb-1">
                                {label}
                              </p>
                              <div className="space-y-1">
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground font-medium">Ventas:</span>
                                  <span className="font-bold text-foreground">S/ {data.totalSales.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Órdenes:</span>
                                  <span className="font-bold text-foreground">{data.orderCount}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Productos:</span>
                                  <span className="font-bold text-foreground">{data.productsCount}</span>
                                </div>
                                <div className="mt-1 pt-1 border-t border-border flex justify-between gap-4">
                                  <span className="text-green-500">Efectividad:</span>
                                  <span className="font-bold text-green-500">{data.deliveryEffectiveness || 0}%</span>
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
          </>
        ) : (
          <>
            {/* VENTAS VIEW (Personalized Stats) */}
            <Card className="bg-card border border-border shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-black text-primary uppercase tracking-widest mb-4">
                  Tus Resultados Globales
                </p>
                {loading ? (
                  <div className="h-16 w-full animate-pulse bg-muted rounded"></div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Facturación</p>
                      <p className="text-xl font-black text-foreground">
                        S/ {sellerSummary?.totalSales?.toLocaleString() || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Órdenes</p>
                      <p className="text-xl font-black text-foreground">
                        {sellerSummary?.totalOrders || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Productos</p>
                      <p className="text-xl font-black text-foreground">
                        {sellerSummary?.totalProducts || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Ticket Promedio</p>
                      <p className="text-xl font-black text-foreground">
                        S/ {sellerSummary?.averageTicket?.toLocaleString() || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Efectividad Global</p>
                      <p className="text-xl font-black text-green-500">
                        {sellerEffectiveness}%
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Daily Sales Chart */}
              <DashboardCard
                title="Ventas Diarias"
                isLoading={loading}
                data={sellerDailySales}
                summaryStats={[{ label: "Total Facturado", value: `S/ ${sellerSummary?.totalSales?.toLocaleString() || 0}` }]}
              >
                <div className="flex flex-col h-full w-full">
                  <div className="flex items-center justify-end mb-4 pr-4">
                    <div className="flex items-center gap-4 text-[10px] font-bold">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm bg-[#3b82f6]" />
                        <span className="text-muted-foreground">Ventas</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#a78bfa]" />
                        <span className="text-muted-foreground">Órdenes</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={(sellerDailySales || []).map((d: any) => {
                          const dateStr = typeof d.date === "string" && d.date.length === 10 ? `${d.date}T12:00:00` : d.date;
                          const dateObj = new Date(dateStr);
                          const formattedDate = dateObj.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
                          
                          return {
                            dayLabel: formattedDate,
                            amount: d.amount,
                            orders: d.orders || 0,
                          };
                        })}
                        margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="dayLabel"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }}
                        />
                        <YAxis
                          yAxisId="left"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }}
                          tickFormatter={(v) => `S/${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }}
                        />
                        <Tooltip
                          cursor={{ fill: "var(--foreground)", opacity: 0.05 }}
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
                          formatter={(value: number, name: string) => [
                            name === "amount" ? `S/ ${value.toLocaleString("es-PE")}` : value,
                            name === "amount" ? "Ventas" : "Órdenes",
                          ]}
                          labelFormatter={(label) => `${label}`}
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="amount"
                          fill="#3b82f6"
                          radius={[3, 3, 0, 0]}
                          barSize={12}
                          opacity={0.85}
                        />
                        <Line
                          yAxisId="right"
                          dataKey="orders"
                          type="monotone"
                          stroke="#a78bfa"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 3, fill: "#a78bfa" }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </DashboardCard>

              {/* Status Distribution Pie Chart */}
              <DashboardCard
                title="Distribución de Estados"
                isLoading={loading}
                data={sellerByStatusArray}
              >
                <div className="h-[300px] w-full flex items-center justify-center">
                  {sellerByStatusArray.length > 0 ? (
                    <>
                      <ResponsiveContainer width="60%" height="100%">
                        <PieChart>
                          <Pie
                            data={sellerByStatusArray}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {sellerByStatusArray.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: "var(--card)", borderRadius: "8px", border: "1px solid var(--border)" }}
                            formatter={(value: number) => [`${value} órdenes`, "Cantidad"]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Custom Legend */}
                      <div className="w-[40%] space-y-3 max-h-[280px] overflow-auto pr-2">
                        {sellerByStatusArray.map((entry, index) => (
                          <div key={entry.name} className="flex flex-col text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></div>
                              <span className="font-bold text-foreground">{entry.name}</span>
                            </div>
                            <span className="text-muted-foreground ml-5">{entry.value} órdenes</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground w-full h-full">
                      <p className="text-sm italic font-medium">Sin datos para mostrar</p>
                    </div>
                  )}
                </div>
              </DashboardCard>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
