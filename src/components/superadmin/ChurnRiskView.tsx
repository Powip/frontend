"use client";

import React, { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  TrendingDown, 
  Users, 
  DollarSign, 
  Phone, 
  MessageSquare, 
  LifeBuoy, 
  Zap, 
  ExternalLink,
  ChevronRight,
  Clock,
  History
} from "lucide-react";
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface ChurnAlert {
  id: string;
  business_id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high';
  details: string;
  created_at: string;
  company?: { name: string; plan?: string; price?: number };
}

interface ChurnRiskViewProps {
  alerts: ChurnAlert[];
  metrics: {
    churnRate: number;
    mrr: number;
  };
  companies: any[];
  onResolve: (id: string) => void;
}

const SEVERITY_CONFIG = {
  high: {
    label: 'CRÍTICO',
    color: 'border-red-500/50 bg-red-500/5 dark:bg-red-500/10',
    badge: 'bg-red-500 text-white',
    iconColor: 'text-red-500',
    indicator: 'bg-red-500',
    action: { label: 'Llamar CS', icon: Phone }
  },
  medium: {
    label: 'ALTO',
    color: 'border-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10',
    badge: 'bg-amber-500 text-black font-extrabold',
    iconColor: 'text-amber-500',
    indicator: 'bg-amber-500',
    action: { label: 'Intervenir', icon: Zap }
  },
  low: {
    label: 'MEDIO',
    color: 'border-blue-500/50 bg-blue-500/5 dark:bg-blue-500/10',
    badge: 'bg-blue-500 text-white',
    iconColor: 'text-blue-500',
    indicator: 'bg-blue-500',
    action: { label: 'Guía PDF', icon: ExternalLink }
  }
};

const ALERT_LABELS: Record<string, string> = {
  no_login: "Sin login 7+ días",
  order_drop: "Caída pedidos >40% semanal",
  disconnected_channel: "Canal desconectado >48h",
  low_onboarding: "Onboarding <30% (d14)",
  no_activation_3d: "Sin activar (d3)",
  high_tickets: "3+ tickets mismo tipo (7d)",
  downgrade_requested: "Downgrade solicitado",
  feature_unused_14d: "Features clave sin uso (14d)",
  negative_feedback: "NPS Negativo o CSAT <3"
};

export const ChurnRiskView: React.FC<ChurnRiskViewProps> = ({ 
  alerts, 
  metrics, 
  companies,
  onResolve 
}) => {
  // ── Calculation ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const high = alerts.filter(a => a.severity === 'high').length;
    const medium = alerts.filter(a => a.severity === 'medium').length;
    
    // Calculate MRR at risk (companies with high severity alerts)
    const highRiskBusinessIds = new Set(alerts.filter(a => a.severity === 'high').map(a => a.business_id));
    const mrrAtRisk = companies
      .filter(c => highRiskBusinessIds.has(c.id))
      .reduce((sum, c) => sum + (c.price || 0), 0);

    return { high, medium, mrrAtRisk };
  }, [alerts, companies]);

  const sortedAlerts = useMemo(() => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return [...alerts].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }, [alerts]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5 px-1">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-red-500" />
          Riesgo de Churn
        </h2>
        <p className="text-slate-500 dark:text-gray-400 text-sm font-medium">
          Señales automáticas ordenadas por severidad
        </p>
      </div>

      {/* ── KPI Grid ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiItem 
          title="RIESGO ALTO" 
          value={stats.high} 
          subtitle="Intervención urgente" 
          color="text-red-500"
          valueColor="text-red-500"
        />
        <KpiItem 
          title="RIESGO MEDIO" 
          value={stats.medium} 
          subtitle="Monitoreo activo" 
          color="text-amber-500"
          valueColor="text-amber-500"
        />
        <KpiItem 
          title="CHURN RATE" 
          value={`${metrics.churnRate}%`} 
          subtitle="Meta: <3% — límite" 
          color="text-amber-400"
          valueColor="text-amber-400"
        />
        <KpiItem 
          title="MRR EN RIESGO" 
          value={`S/ ${stats.mrrAtRisk.toLocaleString()}`} 
          subtitle="Si todos churnan" 
          color="text-pink-500"
          valueColor="text-pink-500"
        />
      </div>

      {/* ── Alerts List ────────────────────────────────────────── */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-slate-500 dark:text-gray-500 uppercase tracking-widest">
            Alertas activas — ordenadas por severidad
          </h3>
          <span className="text-[10px] text-slate-400 dark:text-gray-600 font-bold bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded uppercase">
            Actualizado hoy
          </span>
        </div>

        <div className="grid gap-3">
          {sortedAlerts.map((alert) => (
            <AlertCard 
              key={alert.id} 
              alert={alert} 
              onResolve={onResolve}
            />
          ))}
          
          {alerts.length === 0 && (
            <div className="py-20 text-center flex flex-col items-center gap-4 bg-white dark:bg-white/[0.01] border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
              <div className="p-4 bg-green-500/10 rounded-full">
                <Users className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Sin alarmas de churn</h4>
                <p className="text-slate-500 dark:text-gray-500 text-sm">Tu cartera de clientes está saludable actualmente.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Subcomponents ──────────────────────────────────────────────

const KpiItem = ({ title, value, subtitle, color, valueColor }: any) => (
  <Card className="bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/5 overflow-hidden group hover:shadow-md hover:border-primary/20 transition-all">
    <CardContent className="p-6 space-y-2">
      <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${color} opacity-80`}>
        {title}
      </p>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-black ${valueColor} tracking-tighter`}>{value}</span>
      </div>
      <p className="text-xs text-slate-500 dark:text-gray-400 font-semibold">{subtitle}</p>
    </CardContent>
  </Card>
);

const AlertCard = ({ alert, onResolve }: { alert: ChurnAlert; onResolve: (id: string) => void }) => {
  const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low;
  const label = ALERT_LABELS[alert.alert_type] || alert.alert_type;

  return (
    <div className={`relative flex flex-col md:flex-row md:items-center justify-between p-4 md:p-6 rounded-xl border border-slate-200 dark:border-white/5 ${config.color} transition-all hover:shadow-md dark:hover:border-white/20 group`}>
      {/* Severity Indicator Line */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${config.indicator}`} />
      
      <div className="flex-1 space-y-1.5 pl-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-lg font-bold text-slate-900 dark:text-white/90">
            {alert.company?.name || "Negocio"} <span className="text-slate-400 dark:text-gray-500 font-medium mx-1">—</span> <span className="text-slate-900 dark:text-white">{label}</span>
          </h4>
        </div>
        
        <div className="flex flex-col gap-1">
          <p className="text-xs text-slate-600 dark:text-gray-400 font-medium leading-relaxed max-w-3xl line-clamp-2 italic text-balance">
            {alert.details}
          </p>
          <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Detectado {formatDistanceToNow(parseISO(alert.created_at), { addSuffix: true, locale: es })}
            </span>
            {alert.company?.plan && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                MRR: S/ {alert.company?.price} ({alert.company?.plan})
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-row md:flex-col items-center md:items-end gap-3 mt-4 md:mt-0">
        <Badge className={`${config.badge} px-3 py-1 text-[10px] tracking-widest font-black rounded-md border-none`}>
          {config.label}
        </Badge>
        
        <div className="flex gap-2">
           <Button 
            variant="secondary" 
            size="sm" 
            className="h-9 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-900 dark:text-white border-slate-200 dark:border-white/10 font-bold text-xs gap-2"
            onClick={() => onResolve(alert.id)}
          >
            <config.action.icon className="h-4 w-4" />
            {config.action.label}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 text-slate-400 hover:text-slate-900 dark:text-gray-500 dark:hover:text-white"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
