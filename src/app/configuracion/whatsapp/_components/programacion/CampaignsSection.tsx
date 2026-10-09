"use client";

import { CalendarClock, Pause, Pencil, Play, Repeat } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import {
  WHATSAPP_CAMPAIGN_DESTINATION_OPTIONS,
  WHATSAPP_CAMPAIGN_RECURRENCE_OPTIONS,
  WHATSAPP_CAMPAIGN_STAGE_OPTIONS,
  WHATSAPP_CAMPAIGN_STATUS_LABELS,
} from "@/features/whatsapp/constants/whatsapp-scheduling-catalog";
import {
  WHATSAPP_CAMPAIGN_SCHEDULE_TYPES,
  WHATSAPP_CAMPAIGN_STATUSES,
  type WhatsAppCampaignStatus,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type {
  WhatsAppCampaign,
  WhatsAppSegmentCount,
} from "@/features/whatsapp/models/campaign.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppScopeCatalogs } from "@/features/whatsapp/models/scope-catalog.model";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import type { CampaignValues } from "@/features/whatsapp/schemas/campaign.schema";
import { formatDateKey } from "@/features/whatsapp/utils/lima-time.util";
import { cn } from "@/lib/utils";
import { CampaignDialog, type CampaignDialogMode } from "./CampaignDialog";
import { CampaignResultsDialog } from "./CampaignResultsDialog";
import { buildScopeLabels } from "./scope-labels";

const CAMPAIGNS_NOTE_ID = "campaigns-persistence-note";

const STATUS_CLASSNAMES: Record<WhatsAppCampaignStatus, string> = {
  [WHATSAPP_CAMPAIGN_STATUSES.SCHEDULED]:
    "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
  [WHATSAPP_CAMPAIGN_STATUSES.ACTIVE]:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  [WHATSAPP_CAMPAIGN_STATUSES.PAUSED]:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  [WHATSAPP_CAMPAIGN_STATUSES.COMPLETED]:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200",
};

interface CampaignsSectionProps {
  campaigns: ResourceState<WhatsAppCampaign[]>;
  templates: ResourceState<WhatsAppTemplate[]>;
  catalogs: WhatsAppScopeCatalogs;
  canManage: boolean;
  canPersist: boolean;
  getSegmentCount: (values: CampaignValues) => ResourceState<WhatsAppSegmentCount>;
  now?: () => Date;
  onRetry?: () => void;
}

function describeSegment(campaign: WhatsAppCampaign, catalogs: WhatsAppScopeCatalogs): string {
  if (campaign.segmentLabel) return campaign.segmentLabel;
  const labels = buildScopeLabels(catalogs);
  return [
    WHATSAPP_CAMPAIGN_STAGE_OPTIONS.find((option) => option.value === campaign.segment.stage)
      ?.label ?? campaign.segment.stage,
    campaign.segment.courierId
      ? (labels.couriers.get(campaign.segment.courierId) ?? "Courier no disponible")
      : "Todos los couriers",
    labels.stores.get(campaign.segment.storeId) ?? "Tienda no disponible",
    WHATSAPP_CAMPAIGN_DESTINATION_OPTIONS.find(
      (option) => option.value === campaign.segment.destination,
    )?.label,
  ]
    .filter(Boolean)
    .join(" · ");
}

function describeSchedule(campaign: WhatsAppCampaign): string {
  if (campaign.schedule.type === WHATSAPP_CAMPAIGN_SCHEDULE_TYPES.ONCE) {
    return `Una vez · ${campaign.schedule.date ? formatDateKey(campaign.schedule.date) : "—"} ${campaign.schedule.time}`;
  }
  const recurrence = WHATSAPP_CAMPAIGN_RECURRENCE_OPTIONS.find(
    (option) => option.value === campaign.schedule.recurrence,
  )?.label;
  return `${recurrence ?? "Se repite"} · ${campaign.schedule.time}`;
}

function describeVolume(campaign: WhatsAppCampaign): string {
  if (campaign.status === WHATSAPP_CAMPAIGN_STATUSES.COMPLETED) {
    if (!campaign.results) return "Resultados pendientes";
    return [
      `${campaign.results.sent.toLocaleString("es-PE")} enviados`,
      campaign.results.read === null
        ? null
        : `${campaign.results.read.toLocaleString("es-PE")} leídos`,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (campaign.matchingToday === null) return "Destinatarios: se calculan al enviar";
  return `${campaign.matchingToday.toLocaleString("es-PE")} pedidos hoy · se recalcula al enviar`;
}

export function CampaignsSection({
  campaigns,
  templates,
  catalogs,
  canManage,
  canPersist,
  getSegmentCount,
  now,
  onRetry,
}: CampaignsSectionProps) {
  const sessionCounter = useRef(0);
  const [dialog, setDialog] = useState<{ key: number; mode: CampaignDialogMode } | null>(null);
  const [resultsCampaign, setResultsCampaign] = useState<WhatsAppCampaign | null>(null);

  const openDialog = (mode: CampaignDialogMode) => {
    sessionCounter.current += 1;
    setDialog({ key: sessionCounter.current, mode });
  };

  return (
    <section
      aria-labelledby="campaigns-title"
      className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 id="campaigns-title" className="font-semibold">
            Envíos programados
          </h3>
          <p className="text-sm text-muted-foreground">
            Mensajes que tú decides cuándo mandar a un grupo de pedidos, una vez o de forma
            recurrente.
          </p>
        </div>
        {canManage && (
          <Button type="button" className="shrink-0" onClick={() => openDialog({ kind: "new" })}>
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            Programar envío
          </Button>
        )}
      </div>

      {!canPersist && campaigns.kind === "ready" && campaigns.data.length > 0 && (
        <p id={CAMPAIGNS_NOTE_ID} className="text-sm text-muted-foreground">
          Pausar, reanudar y editar envíos estarán disponibles cuando se conecte el servicio de
          envíos programados.
        </p>
      )}

      <WhatsAppResourceState
        state={campaigns}
        pendingTitle="Envíos programados pendientes de integración"
        pendingDescription="Los envíos de la tienda se mostrarán cuando el servicio esté disponible. Puedes abrir «Programar envío» para preparar uno; todavía no se guarda."
        loadingLabel="Cargando envíos programados"
        errorTitle="No se pudieron cargar los envíos programados"
        onRetry={onRetry}
        isEmpty={(data) => data.length === 0}
        empty={<p className="text-sm text-muted-foreground">No tienes envíos programados.</p>}
      >
        {(data) => (
          <ul className="divide-y" aria-label="Envíos programados">
            {data.map((campaign) => {
              const completed = campaign.status === WHATSAPP_CAMPAIGN_STATUSES.COMPLETED;
              const paused = campaign.status === WHATSAPP_CAMPAIGN_STATUSES.PAUSED;
              return (
                <li key={campaign.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span
                    aria-hidden="true"
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border bg-muted/40"
                  >
                    {campaign.schedule.type === WHATSAPP_CAMPAIGN_SCHEDULE_TYPES.RECURRING ? (
                      <Repeat className="h-5 w-5" />
                    ) : (
                      <CalendarClock className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="font-semibold">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="break-all font-mono">{campaign.templateName}</span> ·{" "}
                      {describeSegment(campaign, catalogs)}
                    </p>
                    <p className="text-xs text-muted-foreground">{describeSchedule(campaign)}</p>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {describeVolume(campaign)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                      STATUS_CLASSNAMES[campaign.status],
                    )}
                  >
                    {WHATSAPP_CAMPAIGN_STATUS_LABELS[campaign.status]}
                    {campaign.pausedReason === "quality_red" && " por calidad"}
                  </span>
                  <div className="flex items-center gap-1">
                    {completed ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setResultsCampaign(campaign)}
                      >
                        Ver resultados
                      </Button>
                    ) : (
                      canManage && (
                        <>
                          <BlockedActionButton
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            blocked={!canPersist}
                            blockedReasonId={CAMPAIGNS_NOTE_ID}
                            aria-label={`${paused ? "Reanudar" : "Pausar"} ${campaign.name}`}
                            onClick={() => undefined}
                          >
                            {paused ? (
                              <Play className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <Pause className="h-4 w-4" aria-hidden="true" />
                            )}
                          </BlockedActionButton>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label={`Editar ${campaign.name}`}
                            onClick={() => openDialog({ kind: "edit", campaign })}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </>
                      )
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </WhatsAppResourceState>

      {dialog && (
        <CampaignDialog
          key={dialog.key}
          mode={dialog.mode}
          templates={templates}
          catalogs={catalogs}
          canPersist={canPersist}
          getSegmentCount={getSegmentCount}
          now={now}
          onClose={() => setDialog(null)}
        />
      )}
      <CampaignResultsDialog campaign={resultsCampaign} onClose={() => setResultsCampaign(null)} />
    </section>
  );
}
