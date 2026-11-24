"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useCallback, useMemo } from "react";
import {
  countWhatsAppCampaignSegment,
  createWhatsAppCampaign,
  listWhatsAppCampaigns,
  pauseWhatsAppCampaign,
  previewWhatsAppRule,
  resumeWhatsAppCampaign,
  updateWhatsAppCampaign,
} from "@/features/whatsapp/api/campaigns.api";
import { toast } from "sonner";
import {
  OrderDetailModalProvider,
  useOrderDetailModal,
} from "@/components/orders/OrderDetailModal";
import { useAuth } from "@/contexts/AuthContext";
import {
  getWhatsAppUpcomingQueue,
  limaTodayStartIso,
  listWhatsAppMessages,
} from "@/features/whatsapp/api/queue.api";
import {
  activateWhatsAppRule,
  deactivateWhatsAppRule,
  getWhatsAppRules,
  updateWhatsAppRule,
} from "@/features/whatsapp/api/rules.api";
import {
  getWhatsAppSettings,
  updateWhatsAppSettings,
  type WhatsAppSettingsDto,
} from "@/features/whatsapp/api/settings.api";
import { listWhatsAppTemplates } from "@/features/whatsapp/api/templates.api";
import { isWhatsAppContractAvailable } from "@/features/whatsapp/constants/whatsapp-contracts";
import { useOnDemandResource } from "@/features/whatsapp/hooks/use-on-demand-resource";
import { useWhatsAppScopeCatalogs } from "@/features/whatsapp/hooks/use-whatsapp-scope-catalogs";
import { toWhatsAppSendingSettings } from "@/features/whatsapp/mappers/to-sending-settings.mapper";
import {
  toWhatsAppSkippedNotices,
  toWhatsAppUpcomingQueue,
} from "@/features/whatsapp/mappers/to-whatsapp-queue.mapper";
import { toWhatsAppRulesData } from "@/features/whatsapp/mappers/to-whatsapp-rules.mapper";
import { toWhatsAppTemplate } from "@/features/whatsapp/mappers/to-whatsapp-template.mapper";
import type {
  WhatsAppSkippedNotice,
  WhatsAppUpcomingQueue,
} from "@/features/whatsapp/models/queue.model";
import type { WhatsAppCampaign } from "@/features/whatsapp/models/campaign.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type {
  WhatsAppActivateRule,
  WhatsAppDeactivateRule,
  WhatsAppRule,
  WhatsAppRulesData,
  WhatsAppSaveRule,
} from "@/features/whatsapp/models/rule.model";
import type {
  WhatsAppSaveSettings,
  WhatsAppSendingSettings,
} from "@/features/whatsapp/models/sending-settings.model";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import type { CampaignValues } from "@/features/whatsapp/schemas/campaign.schema";
import { RULE_LINK_PARAMS, resolveRuleLink } from "@/features/whatsapp/utils/rule-link.util";
import type { WhatsAppNavigate } from "@/features/whatsapp/utils/whatsapp-tab.util";
import { SchedulingView } from "./SchedulingView";

const PENDING = { kind: "pending-integration" } as const;

/** C-20: el contrato pide polling de 60 s para la cola. */
const QUEUE_REFRESH_MS = 60_000;

interface SchedulingTabProps {
  canManage: boolean;
  businessName: string;
  search: string;
  onNavigate: WhatsAppNavigate;
}

interface WhatsAppApiError {
  code?: string;
  message?: string;
  details?: { fields?: Record<string, string> };
}

/** Lee el error con el formato de C-00.4. */
function readApiError(error: unknown) {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  const body = (isAxiosError(error) ? error.response?.data : null) as WhatsAppApiError | null;
  return {
    status,
    code: body?.code,
    message: body?.message,
    fields: body?.details?.fields ?? null,
  };
}

function SchedulingTabContent({ canManage, businessName, search, onNavigate }: SchedulingTabProps) {
  const catalogs = useWhatsAppScopeCatalogs();
  const { openOrderDetail } = useOrderDetailModal();
  const queryClient = useQueryClient();
  const link = useMemo(() => resolveRuleLink(new URLSearchParams(search)), [search]);

  // D-68: la configuración es de la tienda activa de POWIP.
  const { auth, selectedStoreId } = useAuth();
  const stores = auth?.company?.stores ?? [];
  const storeId =
    stores.find((store) => store.id === selectedStoreId)?.id ?? stores[0]?.id ?? null;

  // ---------- C-18 · Ajustes de envío ----------
  const settingsAvailable = isWhatsAppContractAvailable("settings");
  const settingsKey = useMemo(() => ["whatsapp", "settings", storeId] as const, [storeId]);

  const settingsQuery = useQuery({
    queryKey: settingsKey,
    queryFn: () => getWhatsAppSettings(storeId as string),
    enabled: settingsAvailable && !!storeId,
  });

  const settings: ResourceState<WhatsAppSendingSettings> = useMemo(() => {
    if (!settingsAvailable || !storeId) return PENDING;
    if (settingsQuery.data) {
      return { kind: "ready", data: toWhatsAppSendingSettings(settingsQuery.data) };
    }
    if (settingsQuery.isError) {
      return { kind: "error", message: "No se pudo cargar la configuración de envío." };
    }
    return { kind: "loading" };
  }, [settingsAvailable, storeId, settingsQuery.data, settingsQuery.isError]);

  const saveSettings: WhatsAppSaveSettings = useCallback(
    async (patch) => {
      const current = queryClient.getQueryData<WhatsAppSettingsDto>(settingsKey);
      if (!storeId || !current) {
        toast.error("La configuración todavía no se cargó. Intenta de nuevo.");
        return { ok: false, fieldErrors: null };
      }

      // Se mezcla con la respuesta completa: autoReply, bajas y números extranjeros se conservan.
      const { version, ...currentValues } = current;
      try {
        const saved = await updateWhatsAppSettings(storeId, version, {
          ...currentValues,
          ...patch,
        });
        queryClient.setQueryData(settingsKey, saved);
        toast.success("Configuración guardada");
        return { ok: true };
      } catch (error) {
        const apiError = readApiError(error);
        if (apiError.status === 409 && apiError.code === "WA_VERSION_CONFLICT") {
          toast.error(
            "Alguien más cambió esta configuración. Cargamos la versión actual; tus cambios siguen en el formulario.",
          );
          await queryClient.invalidateQueries({ queryKey: settingsKey });
          return { ok: false, fieldErrors: null };
        }
        if (apiError.status === 422 && apiError.code === "WA_VALIDATION") {
          toast.error("Revisa los campos marcados.");
          return { ok: false, fieldErrors: apiError.fields };
        }
        toast.error(apiError.message ?? "No se pudo guardar la configuración. Intenta de nuevo.");
        return { ok: false, fieldErrors: null };
      }
    },
    [queryClient, settingsKey, storeId],
  );

  // ---------- C-16 · Avisos automáticos ----------
  const rulesAvailable = isWhatsAppContractAvailable("rules");
  const rulesKey = useMemo(() => ["whatsapp", "rules", storeId] as const, [storeId]);

  const rulesQuery = useQuery({
    queryKey: rulesKey,
    queryFn: () => getWhatsAppRules(storeId as string),
    enabled: rulesAvailable && !!storeId,
    refetchInterval: QUEUE_REFRESH_MS,
    refetchOnWindowFocus: true,
  });

  const rules: ResourceState<WhatsAppRulesData> = useMemo(() => {
    if (!rulesAvailable || !storeId) return PENDING;
    if (rulesQuery.data) return { kind: "ready", data: toWhatsAppRulesData(rulesQuery.data) };
    if (rulesQuery.isError) {
      return { kind: "error", message: "No se pudieron cargar los avisos automáticos." };
    }
    return { kind: "loading" };
  }, [rulesAvailable, storeId, rulesQuery.data, rulesQuery.isError]);

  const refreshRules = useCallback(
    () => queryClient.invalidateQueries({ queryKey: rulesKey }),
    [queryClient, rulesKey],
  );

  const saveRule: WhatsAppSaveRule = useCallback(
    async (rule, update) => {
      try {
        await updateWhatsAppRule(rule.id, rule.version, update);
        await refreshRules();
        toast.success(`Aviso «${rule.label}» guardado`);
        return { ok: true };
      } catch (error) {
        const apiError = readApiError(error);
        if (apiError.code === "WA_VERSION_CONFLICT") {
          toast.error(
            "Alguien más cambió este aviso. Cargamos la versión actual; tus cambios siguen en la tarjeta.",
          );
          await refreshRules();
          return { ok: false, fieldErrors: null };
        }
        if (apiError.code === "WA_VALIDATION") {
          toast.error("Revisa los campos marcados.");
          return { ok: false, fieldErrors: apiError.fields };
        }
        toast.error(apiError.message ?? "No se pudo guardar el aviso. Intenta de nuevo.");
        return { ok: false, fieldErrors: null };
      }
    },
    [refreshRules],
  );

  const activateRule: WhatsAppActivateRule = useCallback(
    async (rule, includeExisting) => {
      try {
        await activateWhatsAppRule(rule.id, rule.version, includeExisting);
        toast.success(`Aviso «${rule.label}» activado`);
        return true;
      } catch (error) {
        const apiError = readApiError(error);
        toast.error(apiError.message ?? "No se pudo activar el aviso. Intenta de nuevo.");
        return false;
      } finally {
        await refreshRules();
      }
    },
    [refreshRules],
  );

  const deactivateRule: WhatsAppDeactivateRule = useCallback(
    async (rule) => {
      try {
        await deactivateWhatsAppRule(rule.id, rule.version);
        toast.success(`Aviso «${rule.label}» desactivado`);
        return true;
      } catch (error) {
        const apiError = readApiError(error);
        toast.error(apiError.message ?? "No se pudo desactivar el aviso. Intenta de nuevo.");
        return false;
      } finally {
        await refreshRules();
      }
    },
    [refreshRules],
  );

  // ---------- C-12 · Plantillas (para el selector de cada aviso) ----------
  const templatesAvailable = isWhatsAppContractAvailable("templates");

  const templatesQuery = useQuery({
    queryKey: ["whatsapp", "templates"],
    queryFn: listWhatsAppTemplates,
    enabled: templatesAvailable,
  });

  const templates: ResourceState<WhatsAppTemplate[]> = useMemo(() => {
    if (!templatesAvailable) return PENDING;
    if (templatesQuery.data) {
      return { kind: "ready", data: templatesQuery.data.map(toWhatsAppTemplate) };
    }
    if (templatesQuery.isError) {
      return { kind: "error", message: "No se pudieron cargar las plantillas." };
    }
    return { kind: "loading" };
  }, [templatesAvailable, templatesQuery.data, templatesQuery.isError]);

  // ---------- C-19 · Hoy no se enviaron (GET /wa/messages?status=skipped) ----------
  const messagesAvailable = isWhatsAppContractAvailable("messages");
  const todayStart = limaTodayStartIso();

  const skippedQuery = useQuery({
    queryKey: ["whatsapp", "messages", "skipped", storeId, todayStart],
    queryFn: () =>
      listWhatsAppMessages({
        storeId: storeId as string,
        status: "skipped",
        from: todayStart,
        pageSize: 20,
      }),
    enabled: messagesAvailable && !!storeId,
    refetchInterval: QUEUE_REFRESH_MS,
    refetchOnWindowFocus: true,
  });

  const skipped: ResourceState<WhatsAppSkippedNotice[]> = useMemo(() => {
    if (!messagesAvailable || !storeId) return PENDING;
    if (skippedQuery.data) return { kind: "ready", data: toWhatsAppSkippedNotices(skippedQuery.data) };
    if (skippedQuery.isError) {
      return { kind: "error", message: "No se pudo cargar el listado de avisos no enviados." };
    }
    return { kind: "loading" };
  }, [messagesAvailable, storeId, skippedQuery.data, skippedQuery.isError]);

  // ---------- C-20 · Próximas 24 horas ----------
  const queueAvailable = isWhatsAppContractAvailable("upcomingQueue");

  const queueQuery = useQuery({
    queryKey: ["whatsapp", "queue", "upcoming", storeId],
    queryFn: () => getWhatsAppUpcomingQueue(storeId as string, 24),
    enabled: queueAvailable && !!storeId,
    refetchInterval: QUEUE_REFRESH_MS,
     refetchOnWindowFocus: true,
  });

  const queue: ResourceState<WhatsAppUpcomingQueue> = useMemo(() => {
    if (!queueAvailable || !storeId) return PENDING;
    if (queueQuery.data) return { kind: "ready", data: toWhatsAppUpcomingQueue(queueQuery.data) };
    if (queueQuery.isError) return { kind: "error", message: "No se pudo cargar la cola de avisos." };
    return { kind: "loading" };
  }, [queueAvailable, storeId, queueQuery.data, queueQuery.isError]);

  // ---------- C-21 · Envíos programados ----------
  const campaignsAvailable = isWhatsAppContractAvailable("campaigns");
  const campaignsKey = useMemo(() => ["whatsapp", "campaigns", storeId] as const, [storeId]);

  const campaignsQuery = useQuery({
    queryKey: campaignsKey,
    queryFn: () => listWhatsAppCampaigns(storeId),
    enabled: campaignsAvailable && !!storeId,
  });

  const campaigns: ResourceState<WhatsAppCampaign[]> = useMemo(() => {
    if (!campaignsAvailable || !storeId) return PENDING;
    if (campaignsQuery.data) return { kind: "ready", data: campaignsQuery.data };
    if (campaignsQuery.isError) {
      return readApiError(campaignsQuery.error).status === 403
        ? { kind: "forbidden" }
        : { kind: "error", message: "No se pudieron cargar los envíos programados." };
    }
    return { kind: "loading" };
  }, [campaignsAvailable, storeId, campaignsQuery.data, campaignsQuery.isError, campaignsQuery.error]);

  const refreshCampaigns = useCallback(
    () => queryClient.invalidateQueries({ queryKey: campaignsKey }),
    [queryClient, campaignsKey],
  );

  const saveCampaign = useCallback(
    async (campaign: WhatsAppCampaign | null, values: CampaignValues): Promise<boolean> => {
      try {
        if (campaign) await updateWhatsAppCampaign(campaign.id, campaign.version, values);
        else await createWhatsAppCampaign(values);
        toast.success(campaign ? "Cambios guardados." : "Envío programado.");
        return true;
      } catch (error) {
        const apiError = readApiError(error);
        const fallback = (error as Error | null)?.message;
        toast.error(
          apiError.code === "WA_VERSION_CONFLICT"
            ? "Otra persona cambió este envío. Recargamos los datos; revisa y guarda otra vez."
            : (apiError.message ?? fallback ?? "No se pudo guardar el envío."),
        );
        return false;
      } finally {
        await refreshCampaigns();
      }
    },
    [refreshCampaigns],
  );

  const toggleCampaign = useCallback(
    async (campaign: WhatsAppCampaign, pause: boolean) => {
      try {
        await (pause ? pauseWhatsAppCampaign(campaign.id) : resumeWhatsAppCampaign(campaign.id));
        toast.success(pause ? "Envío pausado." : "Envío reanudado.");
      } catch (error) {
        toast.error(
          readApiError(error).message ??
            (error as Error | null)?.message ??
            (pause ? "No se pudo pausar el envío." : "No se pudo reanudar el envío."),
        );
      } finally {
        await refreshCampaigns();
      }
    },
    [refreshCampaigns],
  );

  // C-21.2: conteo del segmento (informativo) y C-16: alcance de la regla. Se piden bajo demanda.
  const segmentCount = useOnDemandResource(
    useCallback(
      (values: CampaignValues) =>
        [values.storeId, values.stage, values.courierId, values.destination].join("|"),
      [],
    ),
    countWhatsAppCampaignSegment,
    "No se pudo calcular cuántos pedidos cumplen hoy.",
  );
  const rulePreview = useOnDemandResource(
    useCallback((rule: WhatsAppRule) => `${storeId}|${rule.id}|${rule.key}`, [storeId]),
    useCallback(
      (rule: WhatsAppRule) => previewWhatsAppRule(rule, storeId, rule.triggerLabel),
      [storeId],
    ),
    "No se pudo calcular el alcance del aviso.",
  );

  const dismissLink = () => {
    const params = new URLSearchParams(search);
    params.delete(RULE_LINK_PARAMS.rule);
    params.delete(RULE_LINK_PARAMS.template);
    onNavigate(params.toString(), { replace: true });
  };

  return (
    <SchedulingView
      rules={rules}
      templates={templates}
      settings={settings}
      skipped={skipped}
      queue={queue}
      campaigns={campaigns}
      catalogs={catalogs}
      canManage={canManage}
      canPersist={{
        rules: rulesAvailable,
        settings: settingsAvailable,
        campaigns: campaignsAvailable,
      }}
      businessName={businessName}
      link={link}
      onDismissLink={dismissLink}
      getRulePreview={rulesAvailable && storeId ? rulePreview.read : () => PENDING}
      getSegmentCount={campaignsAvailable ? segmentCount.read : () => PENDING}
      onCorrectOrder={(orderId) => openOrderDetail(orderId, { initialTab: "seguimiento" })}
      onSaveSettings={settingsAvailable ? saveSettings : undefined}
      onSaveRule={rulesAvailable ? saveRule : undefined}
      onActivateRule={rulesAvailable ? activateRule : undefined}
      onDeactivateRule={rulesAvailable ? deactivateRule : undefined}
      onRetryRules={rulesAvailable ? () => void refreshRules() : undefined}
      onSaveCampaign={campaignsAvailable ? saveCampaign : undefined}
      onPauseCampaign={campaignsAvailable ? (c) => void toggleCampaign(c, true) : undefined}
      onResumeCampaign={campaignsAvailable ? (c) => void toggleCampaign(c, false) : undefined}
      onRetryCampaigns={campaignsAvailable ? () => void refreshCampaigns() : undefined}
    />
  );
}

export function SchedulingTab(props: SchedulingTabProps) {
  return (
    <OrderDetailModalProvider>
      <SchedulingTabContent {...props} />
    </OrderDetailModalProvider>
  );
}