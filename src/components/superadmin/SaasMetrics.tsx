import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Zap, 
  UserCheck, 
  DollarSign, 
  RefreshCcw, 
  Clock, 
  ShoppingBag,
  Activity,
  UserMinus
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface MetricTarget {
  meta: number;
  alert: number;
}

interface SaasMetricsProps {
  metrics: {
    mrr: number;
    mrrNuevo: number;
    mrrPerdido: number;
    nrr: number;
    churnRate: number;
    activationRate: number;
    ttfv: number;
    dauMau: number;
    gmvTotal: number;
    totalCompanies: number;
    targets?: {
      mrr: MetricTarget;
      activation: MetricTarget;
      churn: MetricTarget;
      stickiness: MetricTarget;
    };
  };
}

export const SaasMetrics: React.FC<SaasMetricsProps> = ({ metrics }) => {
  // Guard against undefined metrics
  if (!metrics) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <div key={i} className="h-32 animate-pulse bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5" />
        ))}
      </div>
    );
  }

  const getStatusColor = (value: number, target?: MetricTarget, inverse = false) => {
    if (!target) return "text-blue-500 bg-blue-500/10";
    
    if (inverse) {
      if (value <= target.meta) return "text-emerald-500 bg-emerald-500/10";
      if (value <= target.alert) return "text-amber-500 bg-amber-500/10";
      return "text-red-500 bg-red-500/10";
    }

    if (value >= target.meta) return "text-emerald-500 bg-emerald-500/10";
    if (value >= target.alert) return "text-amber-500 bg-amber-500/10";
    return "text-red-500 bg-red-500/10";
  };

  const cards = [
    {
      title: "MRR Total",
      value: `S/ ${metrics.mrr.toLocaleString()}`,
      label: "Ingresos Recurrentes",
      icon: DollarSign,
      status: getStatusColor(metrics.mrr, metrics.targets?.mrr),
      progress: metrics.targets?.mrr ? (metrics.mrr / metrics.targets.mrr.meta) * 100 : null,
      metaLabel: metrics.targets?.mrr ? `Meta: S/ ${metrics.targets.mrr.meta.toLocaleString()}` : null
    },
    {
      title: "MRR Nuevo",
      value: `S/ ${metrics.mrrNuevo.toLocaleString()}`,
      label: "Mes Actual",
      icon: TrendingUp,
      status: "text-emerald-500 bg-emerald-500/10",
    },
    {
      title: "MRR Perdido",
      value: `S/ ${metrics.mrrPerdido.toLocaleString()}`,
      label: "Churn / Downgrades",
      icon: TrendingDown,
      status: metrics.mrrPerdido > 0 ? "text-red-500 bg-red-500/10" : "text-slate-400 bg-slate-400/10",
    },
    {
      title: "NRR",
      value: `${metrics.nrr.toFixed(1)}%`,
      label: "Retención Neta",
      icon: RefreshCcw,
      status: metrics.nrr >= 100 ? "text-emerald-500 bg-emerald-500/10" : "text-amber-500 bg-amber-500/10",
    },
    {
      title: "Churn Rate",
      value: `${metrics.churnRate.toFixed(2)}%`,
      label: "Fuga Mensual",
      icon: UserMinus,
      status: getStatusColor(metrics.churnRate, metrics.targets?.churn, true),
      progress: metrics.targets?.churn ? (metrics.churnRate / metrics.targets.churn.alert) * 100 : null,
      metaLabel: metrics.targets?.churn ? `Máx: ${metrics.targets.churn.meta}%` : null
    },
    {
      title: "Activación",
      value: `${metrics.activationRate.toFixed(1)}%`,
      label: "Onboarding (7 días)",
      icon: Zap,
      status: getStatusColor(metrics.activationRate, metrics.targets?.activation),
      progress: metrics.targets?.activation ? (metrics.activationRate / metrics.targets.activation.meta) * 100 : null,
      metaLabel: metrics.targets?.activation ? `Meta: ${metrics.targets.activation.meta}%` : null
    },
    {
      title: "TTFV",
      value: `${metrics.ttfv.toFixed(1)} d`,
      label: "Time to First Value",
      icon: Clock,
      status: getStatusColor(metrics.ttfv, metrics.targets?.ttfv, true),
      progress: metrics.targets?.ttfv ? (metrics.ttfv / metrics.targets.ttfv.alert) * 100 : null,
      metaLabel: metrics.targets?.ttfv ? `Meta: <${metrics.targets.ttfv.meta} d` : null
    },
    {
      title: "Stickiness",
      value: `${metrics.dauMau.toFixed(1)}%`,
      label: "Uso DAU / MAU",
      icon: Activity,
      status: getStatusColor(metrics.dauMau, metrics.targets?.stickiness),
      progress: metrics.targets?.stickiness ? (metrics.dauMau / metrics.targets.stickiness.meta) * 100 : null,
      metaLabel: metrics.targets?.stickiness ? `Meta: ${metrics.targets.stickiness.meta}%` : null
    },
    {
      title: "GMV Total",
      value: `S/ ${metrics.gmvTotal.toLocaleString()}`,
      label: "Ventas Plataforma",
      icon: ShoppingBag,
      status: "text-blue-500 bg-blue-500/10",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.title} className="overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm bg-white dark:bg-[#1a1f2e] transition-all hover:shadow-md rounded-2xl group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black text-slate-500 dark:text-gray-400 uppercase tracking-widest group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
              {card.title}
            </CardTitle>
            <div className={`p-2 rounded-xl ${card.status.split(' ')[1]} group-hover:scale-110 transition-transform`}>
              <card.icon className={`h-4 w-4 ${card.status.split(' ')[0]}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight -mb-1">
              {card.value}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-2 font-bold uppercase tracking-tight flex justify-between items-center">
              <span>{card.label}</span>
              {card.metaLabel && <span className="text-[10px] opacity-60 font-medium lowercase italic">{card.metaLabel}</span>}
            </p>
            
            {card.progress !== null && (
              <div className="mt-3 space-y-1">
                <Progress 
                  value={Math.min(100, Math.max(0, card.progress || 0))} 
                  className={`h-1.5 bg-slate-100 dark:bg-white/5 [&>div]:${card.status.split(' ')[0].replace('text-', 'bg-')}`}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
