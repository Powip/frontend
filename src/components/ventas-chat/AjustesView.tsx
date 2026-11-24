"use client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { crmError } from "@/services/crmService";
import { useCrmSettings } from "@/hooks/useCrmTeam";
import { CRM_UNREACHABLE } from "./ConversationList";
import EquipoAdminGate from "./EquipoAdminGate";
import AjustesWhatsAppCard from "./AjustesWhatsAppCard";
import AjustesMetaCard from "./AjustesMetaCard";
import AjustesTikTokCard from "./AjustesTikTokCard";
import AjustesExportCard from "./AjustesExportCard";
import AdResultsCard from "./AjustesAdResultsCard";
import { MetaAudienceCard, MetaCapiCard } from "./AjustesMetaAdsCards";
import { ChannelAccountsCard, PlanCard } from "./AjustesPlanCards";
import {
  AssignCard,
  CallsCard,
  CommentsCard,
  HoursCard,
  MaskPhoneCard,
  SlaCard,
  WelcomeCard,
  WhereCard,
} from "./AjustesCards";

function AjustesContent() {
  const { data, isLoading, isError, error, refetch } = useCrmSettings();
  const err = isError ? crmError(error) : null;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-lg font-semibold">Ajustes</h1>
      <PlanCard />
      <AjustesWhatsAppCard />
      <AjustesMetaCard />
      <AjustesTikTokCard />
      <ChannelAccountsCard />
      {isLoading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando ajustes…
        </p>
      )}
      {err && (
        <div role="alert" className="space-y-2 rounded-md border border-destructive/30 p-3 text-sm">
          <p className="font-medium text-destructive">
            {err.unreachable ? CRM_UNREACHABLE : err.message}
          </p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}
      {data && (
        <>
          <SlaCard settings={data} />
          <HoursCard settings={data} />
          <WelcomeCard settings={data} />
          <AssignCard settings={data} />
          <MaskPhoneCard settings={data} />
          <CommentsCard settings={data} />
          <CallsCard settings={data} />
        </>
      )}
      <AjustesExportCard />
      <MetaCapiCard />
      <MetaAudienceCard />
      <AdResultsCard />
      <WhereCard />
    </div>
  );
}

/** Pestaña Ajustes: configuración del CRM de ventas por chat (solo administrador). */
export default function AjustesView() {
  return (
    <EquipoAdminGate>
      <AjustesContent />
    </EquipoAdminGate>
  );
}
