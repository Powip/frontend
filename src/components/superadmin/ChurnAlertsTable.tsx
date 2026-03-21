import React, { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, MessageSquare, Loader2 } from "lucide-react";
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import axios from 'axios';
import { toast } from 'sonner';

interface ChurnAlert {
  id: string;
  business_id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high';
  details: string;
  created_at: string;
  company: { name: string };
}

interface ChurnAlertsTableProps {
  alerts: ChurnAlert[];
  onResolve: () => void;
  token?: string;
}

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

const SEVERITY_COLORS: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-blue-500",
};

const SEVERITY_LABELS: Record<string, string> = {
  high: "CRÍTICA",
  medium: "ALTO",
  low: "MEDIO",
};

export const ChurnAlertsTable: React.FC<ChurnAlertsTableProps> = ({ alerts, onResolve, token }) => {
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const handleResolve = async (id: string) => {
    const note = window.prompt("Ingrese una nota de resolución:");
    if (note === null) return;

    setResolvingId(id);
    try {
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      await axios.patch(`/api/superadmin/churn-alerts/${id}/resolve`, { note }, config);
      toast.success("Alerta marcada como atendida");
      onResolve();
    } catch (error) {
      toast.error("Error al procesar la resolución");
    } finally {
      setResolvingId(null);
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-xl border-2 border-dashed">
        <CheckCircle2 className="h-8 w-8 mb-2 text-emerald-500 opacity-40" />
        <p className="text-sm font-medium">No hay alertas de riesgo pendientes</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="font-bold py-3">Negocio</TableHead>
            <TableHead className="font-bold">Prioridad</TableHead>
            <TableHead className="font-bold">Tipo de Alerta</TableHead>
            <TableHead className="font-bold">Detalle</TableHead>
            <TableHead className="font-bold">Detección</TableHead>
            <TableHead className="text-right font-bold">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((alert) => (
            <TableRow key={alert.id} className="group hover:bg-muted/30 transition-colors">
              <TableCell className="font-bold text-sm">
                {alert.company?.name || "Empresa Desconocida"}
              </TableCell>
              <TableCell>
                <Badge className={`${SEVERITY_COLORS[alert.severity]} text-[10px] uppercase font-bold tracking-tighter h-5`}>
                  {SEVERITY_LABELS[alert.severity] || alert.severity}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`h-4 w-4 ${alert.severity === 'high' ? 'text-red-500' : 'text-amber-500'}`} />
                  <span className="text-xs font-semibold">{ALERT_LABELS[alert.alert_type] || alert.alert_type}</span>
                </div>
              </TableCell>
              <TableCell className="max-w-[300px]">
                <p className="text-xs text-muted-foreground truncate group-hover:whitespace-normal group-hover:text-foreground transition-all">
                  {alert.details}
                </p>
              </TableCell>
              <TableCell className="text-[10px] font-medium text-muted-foreground uppercase">
                {formatDistanceToNow(parseISO(alert.created_at), { addSuffix: true, locale: es })}
              </TableCell>
              <TableCell className="text-right">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 gap-1.5 font-bold text-xs"
                  onClick={() => handleResolve(alert.id)}
                  disabled={resolvingId === alert.id}
                >
                  {resolvingId === alert.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  )}
                  Atender
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
