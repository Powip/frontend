"use client";

import { CalendarClock, Pause, Pencil, Play, Repeat } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";
import { WaCard, WaCardHeader } from "@/components/whatsapp/ui/WaCard";
import { WaPill, type WaTone } from "@/components/whatsapp/ui/WaPill";
import { waButton } from "@/components/whatsapp/ui/wa-classes";
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
import { CampaignDialog, type CampaignDialogMode } from "./CampaignDialog";
import { CampaignResultsDialog } from "./CampaignResultsDialog";
import { buildScopeLabels } from "./scope-labels";

const CAMPAIGNS_NOTE_ID = "campaigns-persistence-note";

const STATUS_TONES: Record<WhatsAppCampaignStatus, WaTone> = {
  [WHATSAPP_CAMPAIGN_STATUSES.SCHEDULED]: "info",
  [WHATSAPP_CAMPAIGN_STATUSES.ACTIVE]: "ok",
  [WHATSAPP_CAMPAIGN_STATUSES.PAUSED]: "warn",
  [WHATSAPP_CAMPAIGN_STATUSES.COMPLETED]: "neutral",
};

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];

function WhenBox({ campaign }: { campaign: WhatsAppCampaign }) {
  const recurring = campaign.schedule.type === WHATSAPP_CAMPAIGN_SCHEDULE_TYPES.RECURRING;
  const [, month, day] = campaign.schedule.date?.split("-") ?? [];
  const monthLabel = month ? MONTHS[Number(month) - 1] : null;
  return (
    <span
      aria-hidden="true"
      className="w-[58px] shrink-0 overflow-hidden rounded-[10px] border border-wa-border text-center"
    >
      <b className="block bg-wa-primary-soft py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-wa-primary">
        {recurring ? "Repite" : (monthLabel ?? "—")}
      </b>
      <span className="wa-num flex h-[33px] items-center justify-center text-lg font-bold">
        {recurring ? (
          <Repeat className="size-[18px]" />
        ) : (
          (day ?? <CalendarClock className="size-[18px]" />)
        )}
      </span>
    </span>
  );
}

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
    <WaCard aria-labelledby="campaigns-title">
      <WaCardHeader
        titleId="campaigns-title"
        title="Envíos programados"
        description="Mensajes que tú decides cuándo mandar a un grupo de pedidos, una vez o de forma recurrente."
        actions={
          canManage && (
            <Button
              type="button"
              className={waButton({ variant: "primary" })}
              onClick={() => openDialog({ kind: "new" })}
            >
              <CalendarClock aria-hidden="true" />
              Programar envío
            </Button>
          )
        }
      />

      {!canPersist && campaigns.kind === "ready" && campaigns.data.length > 0 && (
        <p id={CAMPAIGNS_NOTE_ID} className="m-0 mb-3 text-xs text-wa-muted">
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
        empty={<p className="m-0 text-[13px] text-wa-muted">No tienes envíos programados.</p>}
      >
        {(data) => (
          <ul className="m-0 list-none p-0" aria-label="Envíos programados">
            {data.map((campaign) => {
              const completed = campaign.status === WHATSAPP_CAMPAIGN_STATUSES.COMPLETED;
              const paused = campaign.status === WHATSAPP_CAMPAIGN_STATUSES.PAUSED;
              return (
                <li
                  key={campaign.id}
                  className="flex flex-wrap items-center gap-3.5 border-t border-wa-border py-3.5 first:border-t-0 first:pt-0 last:pb-0"
                >
                  <WhenBox campaign={campaign} />
                  <div className="min-w-[200px] flex-1">
                    <p className="m-0 font-semibold">{campaign.name}</p>
                    <p className="m-0 text-xs text-wa-muted [overflow-wrap:anywhere]">
                      {campaign.templateName} · {describeSegment(campaign, catalogs)}
                    </p>
                    <p className="wa-num m-0 text-xs text-wa-muted">{describeSchedule(campaign)}</p>
                  </div>
                  <span className="wa-num min-w-[120px] text-xs">{describeVolume(campaign)}</span>
                  <WaPill tone={STATUS_TONES[campaign.status]}>
                    {WHATSAPP_CAMPAIGN_STATUS_LABELS[campaign.status]}
                    {campaign.pausedReason === "quality_red" && " por calidad"}
                  </WaPill>
                  <div className="flex items-center gap-1">
                    {completed ? (
                      <Button
                        type="button"
                        className={waButton({ size: "sm" })}
                        onClick={() => setResultsCampaign(campaign)}
                      >
                        Ver resultados
                      </Button>
                    ) : (
                      canManage && (
                        <>
                          <BlockedActionButton
                            className={waButton({ variant: "ghost", size: "icon" })}
                            blocked={!canPersist}
                            blockedReasonId={CAMPAIGNS_NOTE_ID}
                            aria-label={`${paused ? "Reanudar" : "Pausar"} ${campaign.name}`}
                            onClick={() => undefined}
                          >
                            {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                          </BlockedActionButton>
                          <Button
                            type="button"
                            className={waButton({ variant: "ghost", size: "icon" })}
                            aria-label={`Editar ${campaign.name}`}
                            onClick={() => openDialog({ kind: "edit", campaign })}
                          >
                            <Pencil aria-hidden="true" />
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
    </WaCard>
  );
}
