'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ─── Color mapping for all pipeline states ───
const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  // CRM Comercial
  nuevo:              { bg: 'bg-slate-100 dark:bg-slate-800',          text: 'text-slate-600 dark:text-slate-300',     dot: 'bg-slate-400',    label: 'Lead nuevo' },
  contactado:         { bg: 'bg-blue-100 dark:bg-blue-500/20',        text: 'text-blue-700 dark:text-blue-400',       dot: 'bg-blue-500',     label: 'Contactado' },
  respondio:          { bg: 'bg-blue-100 dark:bg-blue-500/20',        text: 'text-blue-700 dark:text-blue-400',       dot: 'bg-blue-500',     label: 'Respondió' },
  demo_pendiente:     { bg: 'bg-amber-100 dark:bg-amber-500/20',      text: 'text-amber-700 dark:text-amber-400',     dot: 'bg-amber-500',    label: 'Demo pendiente' },
  demo_agendada:      { bg: 'bg-indigo-100 dark:bg-indigo-500/20',    text: 'text-indigo-700 dark:text-indigo-400',   dot: 'bg-indigo-500',   label: 'Demo agendada' },
  demo_realizada:     { bg: 'bg-purple-100 dark:bg-purple-500/20',    text: 'text-purple-700 dark:text-purple-400',   dot: 'bg-purple-500',   label: 'Demo realizada' },
  evaluacion:         { bg: 'bg-amber-100 dark:bg-amber-500/20',      text: 'text-amber-700 dark:text-amber-400',     dot: 'bg-amber-500',    label: 'Evaluación' },
  pendiente_decision: { bg: 'bg-amber-100 dark:bg-amber-500/20',      text: 'text-amber-700 dark:text-amber-400',     dot: 'bg-amber-500',    label: 'Pendiente decisión' },
  pendiente_pago:     { bg: 'bg-amber-100 dark:bg-amber-500/20',      text: 'text-amber-700 dark:text-amber-400',     dot: 'bg-amber-500',    label: 'Pendiente pago' },
  pago_recibido:      { bg: 'bg-emerald-100 dark:bg-emerald-500/20',  text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500',  label: 'Pago recibido' },
  cerrado:            { bg: 'bg-emerald-100 dark:bg-emerald-500/20',  text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500',  label: 'Cerrado' },
  ganado:             { bg: 'bg-emerald-100 dark:bg-emerald-500/20',  text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500',  label: 'Ganado' },
  perdido:            { bg: 'bg-rose-100 dark:bg-rose-500/20',        text: 'text-rose-700 dark:text-rose-400',       dot: 'bg-rose-500',     label: 'Perdido' },

  // Activación
  pendiente_alta:         { bg: 'bg-amber-100 dark:bg-amber-500/20',      text: 'text-amber-700 dark:text-amber-400',     dot: 'bg-amber-500',    label: 'Pendiente alta' },
  datos_recibidos:        { bg: 'bg-blue-100 dark:bg-blue-500/20',        text: 'text-blue-700 dark:text-blue-400',       dot: 'bg-blue-500',     label: 'Datos recibidos' },
  cuenta_creada:          { bg: 'bg-cyan-100 dark:bg-cyan-500/20',        text: 'text-cyan-700 dark:text-cyan-400',       dot: 'bg-cyan-500',     label: 'Cuenta creada' },
  integracion_pendiente:  { bg: 'bg-amber-100 dark:bg-amber-500/20',      text: 'text-amber-700 dark:text-amber-400',     dot: 'bg-amber-500',    label: 'Integración pendiente' },
  capacitacion_pendiente: { bg: 'bg-amber-100 dark:bg-amber-500/20',      text: 'text-amber-700 dark:text-amber-400',     dot: 'bg-amber-500',    label: 'Capacitación pendiente' },
  alta_completa:          { bg: 'bg-emerald-100 dark:bg-emerald-500/20',  text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500',  label: 'Alta completa' },
  activo:                 { bg: 'bg-emerald-100 dark:bg-emerald-500/20',  text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500',  label: 'Activo' },

  // Postventa
  onboarding:  { bg: 'bg-slate-100 dark:bg-slate-800',         text: 'text-slate-600 dark:text-slate-300',     dot: 'bg-slate-400',    label: 'Onboarding' },
  con_dudas:   { bg: 'bg-amber-100 dark:bg-amber-500/20',      text: 'text-amber-700 dark:text-amber-400',     dot: 'bg-amber-500',    label: 'Con dudas' },
  en_riesgo:   { bg: 'bg-rose-100 dark:bg-rose-500/20',        text: 'text-rose-700 dark:text-rose-400',       dot: 'bg-rose-500',     label: 'En riesgo' },
  cancelado:   { bg: 'bg-rose-100 dark:bg-rose-500/20',        text: 'text-rose-700 dark:text-rose-400',       dot: 'bg-rose-500',     label: 'Cancelado' },
  upsell:      { bg: 'bg-violet-100 dark:bg-violet-500/20',    text: 'text-violet-700 dark:text-violet-400',   dot: 'bg-violet-500',   label: 'Upsell' },
};

const DEFAULT_STYLE = { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300', dot: 'bg-slate-400', label: '' };

interface StatusBadgeProps {
  status: string;
  showDot?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, showDot = true, className }) => {
  const style = STATUS_STYLES[status] || DEFAULT_STYLE;
  const label = style.label || status?.replace(/_/g, ' ') || 'Desconocido';

  return (
    <Badge
      variant="outline"
      className={cn(
        'capitalize text-[10px] font-black px-2.5 py-0.5 border-none gap-1.5 whitespace-nowrap',
        style.bg,
        style.text,
        className
      )}
    >
      {showDot && (
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', style.dot)} />
      )}
      {label}
    </Badge>
  );
};

// Export the status configs for sub-tab rendering
export const CRM_COMERCIAL_STATES = [
  'nuevo', 'contactado', 'respondio', 'demo_pendiente', 'demo_agendada',
  'demo_realizada', 'pendiente_decision', 'pendiente_pago', 'pago_recibido',
  'ganado', 'perdido',
];

export const ACTIVACION_STATES = [
  'pendiente_alta', 'datos_recibidos', 'cuenta_creada',
  'integracion_pendiente', 'capacitacion_pendiente', 'alta_completa', 'activo',
];

export const POSTVENTA_STATES = [
  'onboarding', 'activo', 'con_dudas', 'en_riesgo', 'cancelado', 'upsell',
];

export const getStatusLabel = (status: string): string => {
  return STATUS_STYLES[status]?.label || status?.replace(/_/g, ' ') || 'Desconocido';
};

export { STATUS_STYLES };
