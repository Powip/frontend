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
import StatsChart from "@/components/superadmin/StatsChart";
import { EmptyState } from "@/components/ui/empty-state";

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
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  metrics,
  saasMetrics,
  isLoadingMetrics,
  funnelData,
  isLoadingFunnel,
  globalBilling,
  refetchAlerts
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Salud del Ecosistema SaaS</h3>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 gap-2 text-slate-500 hover:text-primary transition-colors hover:bg-primary/5"
            onClick={refetchAlerts}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">Sincronizar</span>
          </Button>
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

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-7">
        <div className="md:col-span-4 transition-all">
          {isLoadingFunnel ? (
            <div className="h-[400px] w-full bg-slate-100 dark:bg-white/5 animate-pulse rounded-2xl border border-slate-200 dark:border-white/5" />
          ) : funnelData ? (
            <div className="p-6 bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/5 rounded-2xl h-full flex flex-col">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Embudo de Conversión</h4>
              </div>
              <div className="flex-1">
                <ConversionFunnel data={funnelData} />
              </div>
            </div>
          ) : null}
        </div>
        
        <div className="md:col-span-3">
          <div className="h-full bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <StatsChart
              title="Rendimiento de Ventas Globales (S/)"
              data={globalBilling}
              xKey="month"
              lines={[
                { key: "2025", name: "Año Actual", color: "var(--primary)" },
                { key: "2024", name: "Año Previo", color: "#94a3b8" },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
