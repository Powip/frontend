import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, Rocket } from "lucide-react";
import { differenceInHours, differenceInDays, parseISO } from 'date-fns';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LeadActivationFlow } from './LeadActivationFlow';

interface LeadCardProps {
  lead: any;
}

// Source tag colors
const SOURCE_COLORS: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-500/20 dark:text-pink-300 dark:border-pink-500/30',
  referido:  'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30',
  landing:   'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
  whatsapp:  'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30',
  ig:        'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-500/20 dark:text-pink-300 dark:border-pink-500/30',
  otro:      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/30',
};

// Plan badge
const PLAN_COLORS: Record<string, string> = {
  basic:      'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/40',
  standard:   'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/40',
  full:       'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40',
  enterprise: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40',
};

type StatusConfig = {
  label: string;
  color: string;   // tailwind bg class
  textColor: string;
};

function getStatusConfig(lead: any, hoursSinceCreation: number, daysInStage: number): StatusConfig | null {
  const stage = lead.pipeline_stage || 'nuevo';

  if (stage === 'nuevo') {
    if (daysInStage >= 3) {
      return { label: `${daysInStage}D SIN CONTACTO`, color: 'bg-red-500/20', textColor: 'text-red-400' };
    }
    if (hoursSinceCreation < 24) {
      return { label: 'NUEVO', color: 'bg-blue-500/20', textColor: 'text-blue-400' };
    }
    return { label: 'SIN CONTACTAR', color: 'bg-gray-500/20', textColor: 'text-gray-400' };
  }

  if (stage === 'contactado') {
    const lastTouch = lead.last_contact_at ? new Date(lead.last_contact_at) : null;
    const daysSinceContact = lastTouch ? differenceInDays(new Date(), lastTouch) : 99;
    if (daysSinceContact <= 1) {
      return { label: 'RESPONDIÓ', color: 'bg-emerald-500/20', textColor: 'text-emerald-400' };
    }
    return { label: 'PEND. RESP.', color: 'bg-amber-500/20', textColor: 'text-amber-400' };
  }

  if (stage === 'demo_agendada') {
    // If lead has a next_demo_date, compute label
    if (lead.next_demo_date) {
      const demo = new Date(lead.next_demo_date);
      const daysToDemo = differenceInDays(demo, new Date());
      if (daysToDemo === 0) return { label: `HOY ${demo.getHours()}HS`, color: 'bg-orange-500/20', textColor: 'text-orange-400' };
      if (daysToDemo === 1) return { label: `MAÑANA ${demo.getHours()}HS`, color: 'bg-purple-500/20', textColor: 'text-purple-400' };
      return { label: `EN ${daysToDemo}D`, color: 'bg-purple-500/20', textColor: 'text-purple-400' };
    }
    return { label: 'AGENDADA', color: 'bg-purple-500/20', textColor: 'text-purple-400' };
  }

  if (stage === 'demo_realizada') {
    return { label: 'DEMO HECHA', color: 'bg-indigo-500/20', textColor: 'text-indigo-400' };
  }

  if (stage === 'evaluacion') {
    if (daysInStage >= 7) {
      return { label: `${daysInStage}D EN ETAPA`, color: 'bg-amber-500/20', textColor: 'text-amber-400' };
    }
    return { label: 'EVALUANDO', color: 'bg-cyan-500/20', textColor: 'text-cyan-400' };
  }

  if (stage === 'cerrado') {
    return null; // Plan badge handles this
  }

  if (stage === 'perdido') {
    const reason = lead.lost_reason?.toLowerCase() || '';
    if (reason.includes('precio')) return { label: 'PRECIO', color: 'bg-rose-500/20', textColor: 'text-rose-400' };
    return { label: 'PERDIDO', color: 'bg-rose-500/20', textColor: 'text-rose-400' };
  }

  if (daysInStage >= 7) {
    return { label: `${daysInStage}D EN ETAPA`, color: 'bg-amber-500/20', textColor: 'text-amber-400' };
  }

  return null;
}

export const LeadCard: React.FC<LeadCardProps> = ({ lead }) => {
  const [isActivationOpen, setIsActivationOpen] = useState(false);

  const createdAt = parseISO(lead.created_at);
  const updatedAt = parseISO(lead.updated_at);
  const now = new Date();

  const hoursSinceCreation = differenceInHours(now, createdAt);
  const daysInStage = differenceInDays(now, updatedAt);

  const isSlaAlert = (lead.pipeline_stage === 'nuevo' && hoursSinceCreation > 24) || daysInStage > 7;
  const statusConfig = getStatusConfig(lead, hoursSinceCreation, daysInStage);

  // Normalize source label (some leads use 'ig' or 'IG')
  const sourceKey = (lead.source || '').toLowerCase().replace('ig', 'instagram');
  const sourceColor = SOURCE_COLORS[sourceKey] || SOURCE_COLORS.otro;

  // Business type + source display: "Moda / Instagram"
  const subtitle = [lead.business_type, lead.source].filter(Boolean).join(' / ');

  const planKey = (lead.plan_interest || '').toLowerCase();
  const planColor = PLAN_COLORS[planKey];

  return (
    <>
      <Card
        className={cn(
          "mb-3 cursor-grab active:cursor-grabbing transition-all duration-200",
          "bg-white dark:bg-[#1e2436] border border-slate-200 dark:border-white/5 hover:shadow-lg dark:hover:shadow-black/30",
          "group relative overflow-hidden rounded-xl shadow-sm hover:border-primary/20",
          isSlaAlert && "ring-1 ring-red-500/50 ring-offset-1 ring-offset-transparent"
        )}
      >
        {isSlaAlert && (
          <div className="absolute top-0 left-0 w-0.5 h-full bg-red-500" />
        )}

        <CardContent className="p-3.5 space-y-2.5">
          {/* Business name + SLA alert */}
          <div className="flex justify-between items-start gap-2">
            <h4 className="font-bold text-[13px] tracking-tight text-slate-900 dark:text-white/90 group-hover:text-primary dark:group-hover:text-white transition-colors line-clamp-2 leading-snug">
              {lead.business_name || lead.contact_name}
            </h4>
            {isSlaAlert && (
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shrink-0 shadow-sm">
                <AlertCircle className="h-2.5 w-2.5" />
              </div>
            )}
          </div>

          {/* Subtitle: Rubro / Fuente */}
          {subtitle && (
            <p className="text-[11px] text-slate-500 dark:text-gray-400 line-clamp-1 font-medium">
              {subtitle}
            </p>
          )}

          {/* Status badge + source badge row */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {/* Status badge */}
            {statusConfig && (
              <span className={cn(
                "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border",
                statusConfig.color,
                statusConfig.textColor,
                "border-current/20"
              )}>
                {statusConfig.label}
              </span>
            )}

            {/* Plan badge for cerrado leads */}
            {lead.pipeline_stage === 'cerrado' && planKey && planColor && (
              <span className={cn(
                "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border border-current/20",
                planColor
              )}>
                {planKey}
              </span>
            )}

            {/* Source badge */}
            <span className={cn(
              "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border border-current/20 ml-auto",
              sourceColor
            )}>
              {lead.source || 'otro'}
            </span>
          </div>

          {/* Activate CTA for cerrado leads */}
          {lead.pipeline_stage === 'cerrado' && (
            <div className="pt-2 border-t border-slate-100 dark:border-white/5">
              <Button
                size="sm"
                className="w-full h-7 gap-1.5 bg-emerald-50 dark:bg-emerald-600/20 hover:bg-emerald-600 text-emerald-600 dark:text-emerald-400 hover:text-white border border-emerald-200 dark:border-emerald-500/30 hover:border-transparent font-bold shadow-none transition-all text-[10px] uppercase tracking-widest rounded-lg"
                onClick={(e) => { e.stopPropagation(); setIsActivationOpen(true); }}
              >
                <Rocket className="h-3 w-3" />
                Dar de alta
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <LeadActivationFlow
        lead={lead}
        open={isActivationOpen}
        onClose={() => setIsActivationOpen(false)}
      />
    </>
  );
};
