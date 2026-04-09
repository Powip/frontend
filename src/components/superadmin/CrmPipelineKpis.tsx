'use client';

import React from 'react';
import { 
  Users, 
  Target, 
  TrendingUp, 
  TrendingDown,
  Activity,
  HeartHandshake
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePipelineSummary } from '@/hooks/usePipelineSummary';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface CrmPipelineKpisProps {
  leads: any[];
  token?: string;
}

export const CrmPipelineKpis: React.FC<CrmPipelineKpisProps> = ({ token }) => {
  const { data: summary, isLoading } = usePipelineSummary(token);

  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5" />
        ))}
      </div>
    );
  }

  // 1. Calculate main KPIs
  const leadsTrend = summary.leads_this_month - summary.leads_previous_month;
  const isLeadsUp = leadsTrend >= 0;

  const kpis = [
    {
      label: "Leads del Mes",
      value: summary.leads_this_month.toString(),
      sub: `vs ${summary.leads_previous_month} el mes anterior`,
      icon: <Users className="h-4 w-4" />,
      highlight: true,
      trend: {
        value: Math.abs(leadsTrend),
        isUp: isLeadsUp,
        text: isLeadsUp ? `+${leadsTrend} este mes` : `${leadsTrend} este mes`
      }
    },
    {
      label: "Tasa de Efectividad",
      value: `${summary.effectiveness}%`,
      sub: "Cierres vs Leads Contactados",
      icon: <Target className="h-4 w-4" />,
      highlight: summary.effectiveness > 15, // Just visual highlight if > 15%
    },
    {
      label: "Total Contactados",
      value: summary.contact_count.toString(),
      sub: "Excluye estado Nuevo",
      icon: <Activity className="h-4 w-4" />,
    },
    {
      label: "Altas / Conversiones",
      value: summary.closed_count.toString(),
      sub: "Total de Cierres histórico",
      icon: <HeartHandshake className="h-4 w-4" />,
    },
  ];

  // 2. Prepare Month-over-Month Chart Data
  const chartData = [
    {
      name: 'Mes Anterior',
      Leads: summary.leads_previous_month,
      Altas: summary.closed_previous_month || 0,
    },
    {
      name: 'Mes Actual',
      Leads: summary.leads_this_month,
      Altas: summary.closed_this_month || 0,
    },
  ];

  // 3. Prepare Salesperson Breakdown
  const salespersonData = summary.salesperson_breakdown || [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Top 4 main KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <KpiCard key={index} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Month over Month Chart */}
        <div className="bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex flex-col mb-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">
              Crecimiento Month-over-Month
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Comparativa de captación y cierres vs. periodo anterior
            </p>
          </div>
          <div className="flex-1 w-full min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <Tooltip
                  cursor={{ fill: '#f1f5f9', opacity: 0.1 }}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    color: '#0f172a',
                    fontWeight: 600,
                    fontSize: '12px'
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                <Bar dataKey="Leads" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                <Bar dataKey="Altas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Salesperson Breakdown */}
        <div className="bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex flex-col mb-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">
              Rendimiento por Vendedor
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Desglose de leads contactados y cerrados por asignación
            </p>
          </div>
          <div className="flex-1 overflow-auto rounded-xl border border-slate-100 dark:border-slate-800">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                <TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-slate-800">
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Vendedor</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Contactados</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Cierres</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Efectividad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salespersonData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-sm text-slate-500">
                      No hay datos de vendedores asignados aún.
                    </TableCell>
                  </TableRow>
                ) : (
                  salespersonData.map((row: any, i: number) => {
                    const eff = row.managed_leads > 0 
                      ? ((row.closed_leads / row.managed_leads) * 100).toFixed(1) 
                      : '0.0';
                    return (
                      <TableRow key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 border-b border-slate-50 dark:border-slate-800">
                        <TableCell className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                          {row.salesperson}
                        </TableCell>
                        <TableCell className="text-center text-xs text-slate-600 dark:text-slate-400">
                          {row.managed_leads}
                        </TableCell>
                        <TableCell className="text-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {row.closed_leads}
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                          {eff}%
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
};

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  highlight?: boolean;
  trend?: {
    value: number;
    isUp: boolean;
    text: string;
  }
}

function KpiCard({ label, value, sub, icon, highlight, trend }: KpiCardProps) {
  return (
    <div className={cn(
      "relative rounded-2xl p-4 flex flex-col gap-3 overflow-hidden transition-all hover:shadow-lg group",
      "bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/5",
      highlight && "border-primary/20 dark:border-primary/30 shadow-primary/5",
    )}>
      {highlight && <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />}

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-gray-500">
          {label}
        </span>
        <div className={cn(
          "p-2 rounded-xl transition-all",
          highlight ? "bg-primary/10 text-primary" : "bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-gray-500"
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

        {trend && (
          <div className={cn(
            "flex items-center gap-1 text-[10px] font-black px-1.5 py-1 rounded-md",
            trend.isUp 
              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" 
              : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
          )}>
            {trend.isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend.text}
          </div>
        )}
      </div>
    </div>
  );
}
