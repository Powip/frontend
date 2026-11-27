"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  actOnWhatsAppAssistedItem,
  assignWhatsAppNumber,
  connectAppOnlyWhatsAppNumber,
  getWhatsAppContingency,
  getWhatsAppPricing,
  getWhatsAppTestRunStatus,
  getWhatsAppUsage,
  listWhatsAppAssistedQueue,
  listWhatsAppCoexistence,
  sendWhatsAppAccountTest,
  setPrimaryWhatsAppNumber,
  switchWhatsAppNumberToAppOnly,
  syncWhatsAppAppData,
  updateWhatsAppContingency,
} from "@/features/whatsapp/api/connection-ops.api";
import { getMyWhatsAppPermissions, grantedCodes } from "@/features/whatsapp/api/settings-ops.api";
import { listWhatsAppTemplates } from "@/features/whatsapp/api/templates.api";
import { isWhatsAppContractAvailable } from "@/features/whatsapp/constants/whatsapp-contracts";
import {
  WHATSAPP_CONNECTION_STATES,
  WHATSAPP_CONNECTION_TYPES,
  type WhatsAppConnectionState,
  type WhatsAppConnectionType,
} from "@/features/whatsapp/enums/whatsapp.enums";
import { useWhatsAppStoreAgents } from "@/features/whatsapp/hooks/use-whatsapp-store-agents";
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
import type { ContingencyValues } from "@/features/whatsapp/schemas/connection.schema";
import { resolveEffectivePermissions } from "@/features/whatsapp/utils/whatsapp-permissions.util";
import {
  connectCustomWaba,
  disconnectWhatsAppAccount,
  getWhatsAppAccounts,
  getWhatsAppStatus,
  refreshWhatsAppAccount,
} from "@/services/whatsappService";
import { useViewedStore } from "../viewed-store-context";
import { ConnectionView } from "./ConnectionView";
import type { ConnectionMutations } from "./connection-types";
import { useSignupMutations } from "./use-signup-mutations";

interface ConnectionTabProps {
  canManage: boolean;
}

import { WHATSAPP_PERMISSION_CODES } from "@/features/whatsapp/enums/whatsapp.enums";

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

  // La insignia de la cabecera sigue la tienda de este selector mientras la pestaña está abierta.
  const [, setViewedStoreId] = useViewedStore();
  useEffect(() => {
    setViewedStoreId(activeStoreId);
    return () => setViewedStoreId(null);
  }, [activeStoreId, setViewedStoreId]);

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
  // Coexistencia: números que siguen en la app del celular (historial una vez, en 24 h).
  const coexistenceQuery = useQuery({
    queryKey: ["whatsapp", "coexistence"],
    queryFn: listWhatsAppCoexistence,
    retry: false,
  });

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
        : ((accountsRes as any)?.items ?? []);
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
    await queryClient.invalidateQueries({ queryKey: ["whatsapp", "coexistence"] });
  };

  useEffect(() => {
    loadConnectionData();
  }, [activeStoreId, token]);

  const currentAccountId = (): string | null =>
    accountState.kind === "ready" ? (accountState.data?.id ?? null) : null;

  // Mutaciones reales conectadas a los botones de la interfaz.
  // «Conectar con Facebook» es el mismo hook que usa CRM > Ajustes.
  const {
    signupAvailable,
    signupUnavailableReason,
    applyNumberRole,
    startSignup,
    selectSignupPhone,
  } = useSignupMutations({ onChanged: reloadAfterChange });

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
    connectAppOnly: async ({ role, seller, ...input }) => {
      const saved = await connectAppOnlyWhatsAppNumber({
        ...input,
        ...(role === "seller" && seller
          ? { assignedUserId: seller.id, assignedUserName: seller.name }
          : {}),
      });
      // «Número principal de la tienda»: envía (a mano) los avisos de la tienda.
      if (role === "store") await setPrimaryWhatsAppNumber(saved.id);
      await reloadAfterChange();
      await queryClient.invalidateQueries({ queryKey: ["whatsapp", "assisted-queue"] });
    },
    switchToApp: async (accountId) => {
      await switchWhatsAppNumberToAppOnly(accountId);
      await reloadAfterChange();
      await queryClient.invalidateQueries({ queryKey: ["whatsapp", "assisted-queue"] });
    },
    assignNumber: async ({ accountId, userId, userName }) => {
      await assignWhatsAppNumber(accountId, { userId, userName });
      await reloadAfterChange();
    },
    setPrimary: async (accountId) => {
      await setPrimaryWhatsAppNumber(accountId);
      await reloadAfterChange();
    },
    syncAppData: async (accountId) => {
      await syncWhatsAppAppData(accountId);
      await queryClient.invalidateQueries({ queryKey: ["whatsapp", "coexistence"] });
    },
    connectManual: async ({
      role,
      seller,
      confirmNoCoexistence,
      confirmPhoneFromMeta,
      ...input
    }) => {
      const saved = await connectCustomWaba(token, {
        ...input,
        ...(role === "company" ? { asCompanyDefault: true } : {}),
        ...(confirmNoCoexistence ? { confirmNoCoexistence: true } : {}),
        ...(confirmPhoneFromMeta ? { confirmPhoneFromMeta: true } : {}),
      });
      await applyNumberRole(saved?.data?.id, { role, seller });
      await reloadAfterChange();
    },
    startSignup,
    selectSignupPhone,
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
      signupUnavailableReason={signupUnavailableReason}
      mutations={mutations}
      coexistence={coexistenceQuery.data ?? []}
      onRetry={retryAll}
    />
  );
}
