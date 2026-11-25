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
import { AjustesMapa, PorQuePowip } from "./AjustesMapa";
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
    <div className="w-full space-y-4">
      <h1 className="text-lg font-semibold">Ajustes</h1>
      {/* J1: mapa arriba; J15: todo el ancho, en secciones. */}
      <AjustesMapa />
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <div id="aj-plan" className="scroll-mt-4 space-y-4">
          <PlanCard />
          <PorQuePowip />
        </div>
        <div id="aj-canales" className="scroll-mt-4 space-y-4">
          <AjustesWhatsAppCard />
          <AjustesMetaCard />
          <AjustesTikTokCard />
          <ChannelAccountsCard />
        </div>
      </div>
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
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <div id="aj-atencion" className="scroll-mt-4 space-y-4">
            <SlaCard settings={data} />
            <HoursCard settings={data} />
            <WelcomeCard settings={data} />
            <AssignCard settings={data} />
          </div>
          <div className="space-y-4">
            <div id="aj-privacidad" className="scroll-mt-4 space-y-4">
              <MaskPhoneCard settings={data} />
              <CommentsCard settings={data} />
            </div>
            <div id="aj-llamadas" className="scroll-mt-4">
              <CallsCard settings={data} />
            </div>
          </div>
        </div>
      )}
      <div id="aj-datos" className="grid scroll-mt-4 items-start gap-4 xl:grid-cols-2">
        <AjustesExportCard />
        <MetaCapiCard />
        <MetaAudienceCard />
        <AdResultsCard />
      </div>
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
