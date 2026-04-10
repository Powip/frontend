"use client";

import React from 'react';
import {
  Building2,
  Users,
  CreditCard,
  TrendingUp,
  BarChart3,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SaasMetrics } from "@/components/superadmin/SaasMetrics";
import { ConversionFunnel } from "@/components/superadmin/ConversionFunnel";
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Label } from "@/components/ui/label";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { EmptyState } from "@/components/ui/empty-state";
import StatsChart from "./StatsChart";
import { SaasDistributionCharts } from "./SaasDistributionCharts";
import { type DateRange } from "react-day-picker";

interface KpiCardProps {
  label: string;
  value: string;
  sub: string;
  icon: any;
  trend?: string;
  trendUp?: boolean;
}

function KpiCard({ label, value, sub, icon: Icon, trend, trendUp }: KpiCardProps) {
  return (
    <div className="relative bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/5 rounded-2xl p-4 flex flex-col gap-2 overflow-hidden transition-all hover:shadow-md hover:border-primary/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/5 dark:bg-primary/10">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-gray-500">{label}</span>
        </div>
        {trend && (
          <span className={cn(
            'text-[10px] font-black px-2 py-0.5 rounded-full',
            trendUp ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
          )}>
            {trend}
          </span>
        )}
      </div>
      <div className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">{value}</div>
      <div className="text-xs text-slate-500 dark:text-gray-400 font-medium">{sub}</div>
    </div>
  );
}

interface OverviewViewProps {
  metrics: {
    totalCompanies: number;
    totalUsers: number;
    totalSales: number;
    orderCount: number;
    outOfStockCount: number;
  };
  saasMetrics: any;
  isLoadingMetrics: boolean;
  funnelData: any;
  isLoadingFunnel: boolean;
  globalBilling: any[];
  refetchAlerts: () => void;
  date?: DateRange;
  onDateChange?: (date: DateRange | undefined) => void;
  companies?: any[];
  allUsers?: any[];
  accessToken?: string;
  fromDate?: string;
  toDate?: string;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  metrics,
  saasMetrics,
  isLoadingMetrics,
  funnelData,
  isLoadingFunnel,
  globalBilling,
  refetchAlerts,
  date,
  onDateChange = () => {},
  companies = [],
  allUsers = [],
  accessToken,
  fromDate,
  toDate
}) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Principal KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Compañías"
          value={metrics.totalCompanies.toString()}
          sub="Empresas registradas"
          icon={Building2}
          trend="+12%"
          trendUp={true}
        />
        <KpiCard
          label="Usuarios Totales"
          value={metrics.totalUsers.toString()}
          sub="En toda la plataforma"
          icon={Users}
          trend="+5%"
          trendUp={true}
        />
        <KpiCard
          label="Ventas Globales"
          value={`S/ ${metrics.totalSales.toLocaleString()}`}
          sub={`${metrics.orderCount} órdenes totales`}
          icon={CreditCard}
        />
        <KpiCard
          label="Sin Stock"
          value={metrics.outOfStockCount.toString()}
          sub="Variantes críticas"
          icon={AlertTriangle}
          trend={metrics.outOfStockCount > 0 ? "Atención" : "Limpio"}
          trendUp={metrics.outOfStockCount === 0}
        />
      </div>

      {/* SaaS Health Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Salud del Ecosistema SaaS</h3>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <Label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Filtrar histórico</Label>
            <DateRangePicker date={date} onDateChange={onDateChange} className="w-full max-w-[300px]" />
          </div>

          <div className="flex justify-start md:justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-10 gap-2 text-slate-500 hover:text-primary transition-colors hover:bg-primary/5 px-4 rounded-xl border border-dashed border-slate-200 dark:border-white/10"
              onClick={refetchAlerts}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="text-xs font-bold">Refrescar</span>
            </Button>
          </div>
        </div>

        {/* Dynamic Business Table (Financial & Session Metrics) */}
        {!isLoadingMetrics && companies.length > 0 && (
          <div className="bg-[#1a1f2e] border border-white/5 rounded-2xl overflow-hidden shadow-xl animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    {['Negocio', 'Plan base', 'Facturación Total', 'Facturación Diaria', 'Estado', 'Última Sesión'].map(h => (
                      <th key={h} className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {companies.slice(0, 10).map((c: any) => (
                    <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-bold text-slate-200 group-hover:text-white transition-colors">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-violet-500/30 bg-violet-500/20 text-violet-300">
                          {c.plan}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-cyan-400 font-mono text-xs">
                        S/ {(c.totalSales || 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-emerald-400 font-mono text-xs">
                        S/ {(c.dailySales || 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded",
                          c.status === 'ACTIVE' ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                        )}>
                          {c.status === 'ACTIVE' ? 'Activo' : 'Vencido'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-400 font-medium">
                        {c.userId ? (
                          allUsers.find((u: any) => u.id === c.userId)?.lastSignInAt
                            ? formatDistanceToNow(parseISO(allUsers.find((u: any) => u.id === c.userId).lastSignInAt), { addSuffix: true, locale: es })
                            : "Nunca"
                        ) : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {companies.length > 10 && (
                <div className="px-5 py-3 text-center border-t border-white/5 bg-white/[0.01]">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic">
                    Mostrando los 10 negocios más recientes... ver todos en la pestaña de Empresas
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-6 w-1 bg-primary rounded-full" />
            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Métricas Detalladas de Salud SaaS</h4>
          </div>

          {isLoadingMetrics ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <div key={i} className="h-32 animate-pulse bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5" />
              ))}
            </div>
          ) : saasMetrics ? (
            <SaasMetrics metrics={saasMetrics} />
          ) : (
            <EmptyState
              icon={AlertTriangle}
              title="Sin métricas en tiempo real"
              description="No se han detectado datos de facturación recurrentes suficientes para calcular los KPIs de salud."
              actionLabel="Actualizar Datos"
              onAction={refetchAlerts}
              className="py-12 bg-white/50 dark:bg-white/5 border-dashed"
            />
          )}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-12">
        <div className="md:col-span-4 transition-all flex flex-col">
          {isLoadingFunnel ? (
            <div className="h-[400px] w-full bg-slate-100 dark:bg-white/5 animate-pulse rounded-2xl border border-slate-200 dark:border-white/5" />
          ) : funnelData ? (
            <div className="flex-1 p-6 bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/5 rounded-2xl h-full flex flex-col">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Embudo de Conversión</h4>
              </div>
              <div className="flex-1 min-h-[300px]">
                <ConversionFunnel data={funnelData} />
              </div>
            </div>
          ) : null}
        </div>

        <div className="md:col-span-4 transition-all flex flex-col">
          <SaasDistributionCharts 
            data={saasMetrics?.paymentDistribution} 
            isLoading={isLoadingMetrics} 
          />
        </div>

        <div className="md:col-span-4 transition-all flex flex-col">
          <div className="flex-1 bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow min-h-[300px]">
            <StatsChart
              title="Rendimiento de Ventas Globales (S/)"
              data={globalBilling}
              xKey="month"
              lines={[
                { key: String(new Date().getFullYear()), name: "Año Actual", color: "var(--primary)" },
                { key: String(new Date().getFullYear() - 1), name: "Año Previo", color: "#94a3b8" },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
