"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { listWhatsAppTemplates } from "@/features/whatsapp/api/templates.api";
import {
  actOnWhatsAppAssistedItem,
  getWhatsAppContingency,
  getWhatsAppPricing,
  getWhatsAppTestRunStatus,
  getWhatsAppUsage,
  listWhatsAppAssistedQueue,
  sendWhatsAppAccountTest,
  updateWhatsAppContingency,
} from "@/features/whatsapp/api/connection-ops.api";
import { getMyWhatsAppPermissions, grantedCodes } from "@/features/whatsapp/api/settings-ops.api";
import { useWhatsAppStoreAgents } from "@/features/whatsapp/hooks/use-whatsapp-store-agents";
import type { ContingencyValues } from "@/features/whatsapp/schemas/connection.schema";
import { isWhatsAppContractAvailable } from "@/features/whatsapp/constants/whatsapp-contracts";
import {
  WHATSAPP_CONNECTION_STATES,
  WHATSAPP_CONNECTION_TYPES,
  type WhatsAppConnectionState,
  type WhatsAppConnectionType,
} from "@/features/whatsapp/enums/whatsapp.enums";
import { toWhatsAppTemplate } from "@/features/whatsapp/mappers/to-whatsapp-template.mapper";
import type {
  WhatsAppAssistedQueue,
  WhatsAppConnectionStatus,
  WhatsAppContingencySettings,
  WhatsAppPricing,
  WhatsAppTestRun,
  WhatsAppUsageSummary,
} from "@/features/whatsapp/models/connection.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import { resolveEffectivePermissions } from "@/features/whatsapp/utils/whatsapp-permissions.util";
import { ConnectionView } from "./ConnectionView";
import { signupUnavailableReason, type ConnectionMutations } from "./connection-types";
import { launchEmbeddedSignup } from "@/lib/metaEmbeddedSignup";
import { completeEmbeddedSignup, getEmbeddedSignupConfig } from "@/services/crmTeamService";
import {
  getWhatsAppStatus,
  getWhatsAppAccounts,
  refreshWhatsAppAccount,
  disconnectWhatsAppAccount,
  updateWhatsAppAccount,
  connectCustomWaba,
} from "@/services/whatsappService";

interface ConnectionTabProps {
  canManage: boolean;
}
import { WHATSAPP_PERMISSION_CODES } from "@/features/whatsapp/enums/whatsapp.enums";

/**
 * SOLO DESARROLLO LOCAL: datos de una WABA de prueba para el botón "Conectar"
 * mientras no exista el Embedded Signup de Meta (C-06). Se leen de .env.local
 * (no se sube a GitHub). Nunca configurar estas variables en producción:
 * todo lo que empieza con NEXT_PUBLIC_ queda visible en el navegador.
 */
const LOCAL_TEST_WABA = {
  wabaId: process.env.NEXT_PUBLIC_WA_TEST_WABA_ID ?? "",
  phoneNumberId: process.env.NEXT_PUBLIC_WA_TEST_PHONE_NUMBER_ID ?? "",
  accessToken: process.env.NEXT_PUBLIC_WA_TEST_ACCESS_TOKEN ?? "",
  businessPhoneNumber: process.env.NEXT_PUBLIC_WA_TEST_BUSINESS_PHONE ?? "",
};

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

/** Resultado de react-query → estado de recurso de la vista (sin datos inventados). */
function toResource<T>(
  query: { data: T | undefined; isError: boolean; error: unknown },
  fallback: string,
): ResourceState<T> {
  if (query.data !== undefined) return { kind: "ready", data: query.data };
  if (query.isError) {
    const status = (query.error as { response?: { status?: number } } | null)?.response?.status;
    if (status === 403) return { kind: "forbidden" } as ResourceState<T>;
    return { kind: "error", message: fallback };
  }
  return { kind: "loading" };
}

const KNOWN_STATES = new Set<string>(Object.values(WHATSAPP_CONNECTION_STATES));
const KNOWN_TYPES = new Set<string>(Object.values(WHATSAPP_CONNECTION_TYPES));

/** GET /wa/status → modelo de pantalla. Sin campo `state` la respuesta no es válida. */
function toConnectionStatus(raw: any, storeId: string): WhatsAppConnectionStatus | null {
  if (!raw || typeof raw.state !== "string") return null;
  return {
    storeId,
    connectionType: KNOWN_TYPES.has(raw.connectionType)
      ? (raw.connectionType as WhatsAppConnectionType)
      : null,
    state: KNOWN_STATES.has(raw.state) ? (raw.state as WhatsAppConnectionState) : null,
    contingencyActive: typeof raw.contingencyActive === "boolean" ? raw.contingencyActive : null,
  };
}

function normalizeAccount(raw: any) {
  if (!raw) return raw;
  return {
    ...raw,
    messagesThisMonth: raw.messagesThisMonth ?? null,
    connectedAt: toDate(raw.connectedAt),
    lastSyncedAt: toDate(raw.lastSyncedAt),
    webhook: raw.webhook
      ? { ...raw.webhook, lastEventAt: toDate(raw.webhook.lastEventAt) }
      : raw.webhook,
    usageToday: raw.usageToday
      ? { ...raw.usageToday, resetsAt: toDate(raw.usageToday.resetsAt) }
      : raw.usageToday,
  };
}

export function ConnectionTab({ canManage }: ConnectionTabProps) {
  const { auth, selectedStoreId } = useAuth();
  const token = auth?.accessToken || "";
  const queryClient = useQueryClient();
  const storesSource = auth?.company?.stores;

  const stores = useMemo(
    () => (storesSource ?? []).map((store) => ({ id: store.id, name: store.name })),
    [storesSource],
  );

  const [storeId, setStoreId] = useState<string | null>(null);
  const activeStoreId =
    storeId ?? stores.find((store) => store.id === selectedStoreId)?.id ?? stores[0]?.id ?? null;

  // Estados dinámicos para alimentar la vista
  const [statusState, setStatusState] = useState<any>({ kind: "loading" });
  const [accountState, setAccountState] = useState<any>({ kind: "loading" });
  const [accountsState, setAccountsState] = useState<any>({ kind: "loading" });

  // Permisos reales del usuario (C-28 · /wa/permissions/me). Mientras cargan, se usa
  // el rol de la pantalla: quien puede gestionar ve la conexión (el backend también lo exige).
  const myPermissionsQuery = useQuery({
    queryKey: ["whatsapp", "permissions", "me"],
    queryFn: getMyWhatsAppPermissions,
  });
  const effectivePermissions = useMemo(() => {
    const granted = grantedCodes(myPermissionsQuery.data);
    if (granted) return resolveEffectivePermissions(granted);
    return resolveEffectivePermissions(canManage ? [WHATSAPP_PERMISSION_CODES.CONNECTION] : []);
  }, [canManage, myPermissionsQuery.data]);

  // C-08/C-09 · uso del mes y tarifas de Meta
  const usageQuery = useQuery({
    queryKey: ["whatsapp", "usage", activeStoreId ?? "none"],
    queryFn: () => getWhatsAppUsage(activeStoreId as string),
    enabled: !!activeStoreId,
  });
  const pricingQuery = useQuery({
    queryKey: ["whatsapp", "pricing"],
    queryFn: getWhatsAppPricing,
    staleTime: 10 * 60 * 1000,
  });
  // C-10 · contingencia; C-11 · bandeja de envío asistido
  const contingencyKey = ["whatsapp", "contingency", activeStoreId ?? "none"] as const;
  const contingencyQuery = useQuery({
    queryKey: contingencyKey,
    queryFn: () => getWhatsAppContingency(activeStoreId as string),
    enabled: !!activeStoreId,
  });
  const assistedKey = ["whatsapp", "assisted-queue", activeStoreId ?? "none"] as const;
  const assistedQuery = useQuery({
    queryKey: assistedKey,
    queryFn: () => listWhatsAppAssistedQueue(activeStoreId as string),
    enabled: !!activeStoreId,
    refetchInterval: 30_000,
  });
  const agents = useWhatsAppStoreAgents(activeStoreId, !!activeStoreId);

  const usage = toResource<WhatsAppUsageSummary>(usageQuery, "No se pudo cargar el uso del mes.");
  const pricing = toResource<WhatsAppPricing>(pricingQuery, "No se pudieron cargar las tarifas.");
  const contingency = toResource<WhatsAppContingencySettings | null>(
    contingencyQuery,
    "No se pudo cargar la contingencia.",
  );
  const assistedQueue = toResource<WhatsAppAssistedQueue>(
    assistedQuery,
    "No se pudo cargar la bandeja de envío asistido.",
  );

  // Plantillas de la empresa (C-12): el envío de prueba solo ofrece las aprobadas.
  const templatesAvailable = isWhatsAppContractAvailable("templates");
  const templatesQuery = useQuery({
    queryKey: ["whatsapp", "templates"],
    queryFn: listWhatsAppTemplates,
    enabled: templatesAvailable,
  });
  const templates: ResourceState<WhatsAppTemplate[]> = useMemo(() => {
    if (!templatesAvailable) return { kind: "pending-integration" };
    if (templatesQuery.data) {
      return { kind: "ready", data: templatesQuery.data.map(toWhatsAppTemplate) };
    }
    if (templatesQuery.isError) {
      return { kind: "error", message: "No se pudieron cargar las plantillas." };
    }
    return { kind: "loading" };
  }, [templatesAvailable, templatesQuery.data, templatesQuery.isError]);

  // Función para recargar la información de la tienda activa
  const loadConnectionData = async () => {
    if (!activeStoreId || !token) {
      setStatusState({ kind: "pending-integration" });
      setAccountState({ kind: "ready", data: null });
      setAccountsState({ kind: "ready", data: [] });
      return;
    }

    try {
      setStatusState({ kind: "loading" });
      setAccountState({ kind: "loading" });

      const statusRes = await getWhatsAppStatus(token, activeStoreId);
      const accountsRes = await getWhatsAppAccounts(token, activeStoreId);

      // Estado tal cual lo guarda POWIP; la calidad y el límite vienen en la cuenta (null si Meta no los dio).
      const connectionStatus = toConnectionStatus(statusRes, activeStoreId);
      setStatusState(
        connectionStatus
          ? { kind: "ready", data: connectionStatus }
          : { kind: "error", message: "No se pudo leer el estado de la conexión." },
      );

      const rawList: any[] = Array.isArray(accountsRes)
        ? accountsRes
        : (accountsRes as any)?.items ?? [];
      const accountsArray = rawList.map(normalizeAccount);
      const currentAccount = accountsArray[0] ?? null;

      setAccountState({ kind: "ready", data: currentAccount });
      setAccountsState({ kind: "ready", data: accountsArray });
    } catch (error) {
      console.error("Error cargando datos de conexión:", error);
      // Un fallo no es «pendiente de integración»: se muestra el error y se puede reintentar.
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setStatusState({ kind: "forbidden" });
        setAccountState({ kind: "forbidden" });
        setAccountsState({ kind: "forbidden" });
      } else {
        const message = "No se pudo cargar la conexión de WhatsApp. Intenta de nuevo.";
        setStatusState({ kind: "error", message });
        setAccountState({ kind: "error", message });
        setAccountsState({ kind: "error", message });
      }
    }
  };

  /** Recarga la tienda y también la insignia del encabezado tras un cambio en la conexión. */
  const reloadAfterChange = async () => {
    await loadConnectionData();
    await queryClient.invalidateQueries({ queryKey: ["whatsapp", "status"] });
  };

  useEffect(() => {
    loadConnectionData();
  }, [activeStoreId, token]);

  const currentAccountId = (): string | null =>
    accountState.kind === "ready" ? (accountState.data?.id ?? null) : null;

  // Mutaciones reales conectadas a los botones de la interfaz
  const signupConfigQuery = useQuery({
    queryKey: ["whatsapp", "embedded-signup-config"],
    queryFn: getEmbeddedSignupConfig,
    retry: false,
    staleTime: 60_000,
  });
  const hasLocalTestWaba =
    process.env.NODE_ENV !== "production" &&
    !!LOCAL_TEST_WABA.wabaId &&
    !!LOCAL_TEST_WABA.phoneNumberId &&
    !!LOCAL_TEST_WABA.accessToken;
  const signupAvailable = Boolean(signupConfigQuery.data?.enabled) || hasLocalTestWaba;
  const mutations: ConnectionMutations = {
    refresh: async (accountId) => {
      const id = accountId || currentAccountId();
      if (!id) return;
      await refreshWhatsAppAccount(token, id);
      await reloadAfterChange();
    },
    disconnect: async (accountId) => {
      const id = accountId || currentAccountId();
      if (!id) return;
      await disconnectWhatsAppAccount(token, id);
      await reloadAfterChange();
    },
    changeType: async ({ accountId, connectionType }) => {
      const id = accountId || currentAccountId();
      if (!id) return;
      await updateWhatsAppAccount(token, id, connectionType);
      await reloadAfterChange();
    },
    // C-07 · envío de prueba por la cuenta conectada; luego se consulta su estado.
    sendTest: async ({ accountId, phone, templateId }): Promise<WhatsAppTestRun> => {
      if (!activeStoreId) throw new Error("Elige una tienda.");
      return sendWhatsAppAccountTest(accountId, {
        to: phone.replace(/\D/g, ""),
        templateId,
        storeId: activeStoreId,
      });
    },
    refreshTest: getWhatsAppTestRunStatus,
    saveContingency: async (values: ContingencyValues) => {
      if (!activeStoreId) return;
      const current = contingencyQuery.data ?? null;
      await updateWhatsAppContingency(activeStoreId, current?.version ?? 0, {
        enabled: values.enabled,
        backupAccountId: current?.backupAccount?.id ?? null,
        triggers: {
          onRestrictedOrRed: values.onRestrictedOrRed,
          onDailyLimit: values.onDailyLimit,
          onConsecutiveFailures: {
            enabled: values.failuresEnabled,
            count: Number(values.failuresCount),
            minutes: Number(values.failuresMinutes),
          },
          manualOnly: values.manualOnly,
        },
        sender: {
          type: values.senderType,
          userId: values.senderType === "user" ? values.senderUserId || null : null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: contingencyKey });
      await queryClient.invalidateQueries({ queryKey: ["whatsapp", "status"] });
    },
    markAssistedOpened: async (itemId) => {
      await actOnWhatsAppAssistedItem(itemId, "opened");
      await queryClient.invalidateQueries({ queryKey: assistedKey });
    },
    // D-72: «Marcar enviado» es el único camino a enviado.
    markAssistedSent: async (itemId) => {
      await actOnWhatsAppAssistedItem(itemId, "mark-sent");
      await queryClient.invalidateQueries({ queryKey: assistedKey });
    },
    discardAssisted: async ({ itemId, reason }) => {
      await actOnWhatsAppAssistedItem(itemId, "discard", reason);
      await queryClient.invalidateQueries({ queryKey: assistedKey });
    },
    startSignup: async () => {
      // Embedded Signup de Meta (FB.login con config_id y code), el mismo que usa Ventas por chat.
      const config = signupConfigQuery.data;
      if (config?.enabled) {
        if (!activeStoreId) throw new Error("Elige una tienda antes de conectar.");
        const shared = await launchEmbeddedSignup(config);
        await completeEmbeddedSignup({
          storeId: activeStoreId,
          code: shared.code,
          ...(shared.wabaId ? { wabaId: shared.wabaId } : {}),
          ...(shared.phoneNumberId ? { phoneNumberId: shared.phoneNumberId } : {}),
        });
        await reloadAfterChange();
        return;
      }
      // Sin app de Meta configurada: solo en desarrollo local se conecta con la WABA de prueba de .env.local.
      const hasLocalTestWaba =
        !!LOCAL_TEST_WABA.wabaId && !!LOCAL_TEST_WABA.phoneNumberId && !!LOCAL_TEST_WABA.accessToken;

      if (process.env.NODE_ENV === "production" || !hasLocalTestWaba) {
        throw new Error(
          "La conexión con Meta (Embedded Signup) todavía no está disponible. Configura la WABA de prueba en .env.local para desarrollo.",
        );
      }

      await connectCustomWaba(token, {
        storeId: activeStoreId,
        wabaId: LOCAL_TEST_WABA.wabaId,
        phoneNumberId: LOCAL_TEST_WABA.phoneNumberId,
        accessToken: LOCAL_TEST_WABA.accessToken,
        businessPhoneNumber: LOCAL_TEST_WABA.businessPhoneNumber,
      });
      await reloadAfterChange();
    },
  };

  const retryAll = () => {
    void loadConnectionData();
    void queryClient.invalidateQueries({ queryKey: ["whatsapp"] });
  };

  return (
    <ConnectionView
      stores={stores}
      storeId={activeStoreId}
      onStoreChange={setStoreId}
      now={new Date()}
      canManage={canManage}
      effectivePermissions={effectivePermissions}
      status={statusState}
      account={accountState}
      accounts={accountsState}
      templates={templates}
      testRun={null}
      contingency={contingency}
      agents={agents}
      assistedQueue={assistedQueue}
      pricing={pricing}
      usage={usage}
      signupAvailable={signupAvailable}
      signupUnavailableReason={signupUnavailableReason(signupConfigQuery.data?.missing)}
      mutations={mutations}
      onRetry={retryAll}
    />
  );
}