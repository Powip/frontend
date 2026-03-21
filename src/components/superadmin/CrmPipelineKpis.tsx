import React from 'react';
import { 
  Users, 
  Target, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  AlertTriangle, 
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePipelineSummary } from '@/hooks/usePipelineSummary';

interface CrmPipelineKpisProps {
  leads: any[];
  token?: string;
}

export const CrmPipelineKpis: React.FC<CrmPipelineKpisProps> = ({ leads, token }) => {
  const { data: summary, isLoading } = usePipelineSummary(token);

  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-32 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5" />
        ))}
      </div>
    );
  }

  const kpis = [
    {
      label: "Leads Captados",
      value: summary.leads_this_month.toString(),
      sub: "En el periodo actual",
      icon: <Users className="h-4 w-4" />,
      color: "text-blue-500",
    },
    {
      label: "Tasa de Contacto",
      value: `${summary.contact_rate.toFixed(1)}%`,
      sub: `${summary.contact_count} contactados`,
      icon: <CheckCircle2 className="h-4 w-4" />,
      target: summary.targets.contact,
      suffix: "%",
    },
    {
      label: "Tasa de Demo",
      value: `${summary.demo_rate.toFixed(1)}%`,
      sub: `${summary.demo_count} con demo`,
      icon: <Calendar className="h-4 w-4" />,
      target: summary.targets.demo,
      suffix: "%",
    },
    {
      label: "Tasa de Cierre",
      value: `${summary.close_rate.toFixed(1)}%`,
      sub: "Conversión final",
      icon: <Target className="h-4 w-4" />,
      target: summary.targets.close,
      suffix: "%",
    },
    {
      label: "Tiempo Ciclo Prom.",
      value: `${summary.avg_cycle_time_days}d`,
      sub: "Lead → Empresa",
      icon: <Clock className="h-4 w-4" />,
      target: summary.targets.cycle,
      inverse: true,
    },
    {
      label: "Sin Contactar >24h",
      value: summary.uncontacted_24h.toString(),
      sub: "Leads nuevos estancados",
      icon: <AlertTriangle className="h-4 w-4" />,
      target: summary.targets.uncontacted,
      inverse: true,
    },
    {
      label: "Leads en Riesgo",
      value: summary.at_risk_7d.toString(),
      sub: ">7d en etapa actual",
      icon: <AlertTriangle className="h-4 w-4" />,
      target: summary.targets.risk,
      inverse: true,
    },
    {
      label: "MRR Generado",
      value: `S/ ${summary.mrr_generated.toLocaleString()}`,
      sub: "Cierres del mes",
      icon: <DollarSign className="h-4 w-4" />,
      highlight: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {kpis.map((kpi, index) => (
        <KpiCard key={index} {...kpi} />
      ))}
    </div>
  );
};

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  target?: { meta: number; alert: number };
  highlight?: boolean;
  inverse?: boolean;
  color?: string;
}

function KpiCard({ label, value, sub, icon, target, highlight, inverse, color }: KpiCardProps) {
  const numericValue = parseFloat(value.replace(/[^0-9.]/g, ''));
  
  const getStatus = () => {
    if (!target) return 'neutral';
    
    if (inverse) {
      if (numericValue <= target.meta) return 'success';
      if (numericValue >= target.alert) return 'danger';
      return 'warning';
    } else {
      if (numericValue >= target.meta) return 'success';
      if (numericValue <= target.alert) return 'danger';
      return 'warning';
    }
  };

  const status = getStatus();

  return (
    <div className={cn(
      "relative rounded-2xl p-4 flex flex-col gap-3 overflow-hidden transition-all hover:shadow-lg group",
      "bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/5",
      highlight && "border-primary/20 dark:border-primary/30 shadow-primary/5",
      status === 'success' && "hover:border-emerald-500/30",
      status === 'danger' && "hover:border-rose-500/30",
      status === 'warning' && "hover:border-amber-500/30"
    )}>
      {/* Background Accent */}
      {status === 'success' && <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />}
      {status === 'danger' && <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />}
      {status === 'warning' && <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />}
      {highlight && <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />}

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-gray-500">
          {label}
        </span>
        <div className={cn(
          "p-2 rounded-xl transition-all",
          status === 'success' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
          status === 'danger' ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" :
          status === 'warning' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
          "bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-gray-500"
        )}>
          {icon}
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className={cn(
            "text-2xl font-black tracking-tight",
            highlight ? "text-primary" : "text-slate-900 dark:text-white"
          )}>
            {value}
          </div>
          <div className="text-[11px] font-medium text-slate-500 dark:text-gray-400 mt-0.5">
            {sub}
          </div>
        </div>

        {target && (
          <div className="flex flex-col items-end gap-1">
            <span className={cn(
              "text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider",
              status === 'success' ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" :
              status === 'danger' ? "bg-rose-500/20 text-rose-700 dark:text-rose-300" :
              status === 'warning' ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" :
              "bg-slate-200 dark:bg-white/10 text-slate-500"
            )}>
              {status === 'success' ? 'Meta OK' : status === 'danger' ? 'Alerta' : 'En proceso'}
            </span>
          </div>
        )}
      </div>

      {/* Goal Indicator Bar */}
      {target && (
        <div className="mt-1 h-1 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full transition-all duration-1000",
              status === 'success' ? "bg-emerald-500" :
              status === 'danger' ? "bg-rose-500" :
              "bg-amber-500"
            )}
            style={{ 
              width: highlight 
                ? '100%' 
                : `${Math.min(100, Math.max(10, (numericValue / (target.meta * 1.5)) * 100))}%` 
            }}
          />
        </div>
      )}
    </div>
  );
}
