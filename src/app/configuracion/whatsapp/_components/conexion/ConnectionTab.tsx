"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { listWhatsAppTemplates } from "@/features/whatsapp/api/templates.api";
import { sendWhatsAppTestTemplate } from "@/features/whatsapp/api/test-message.api";
import { isWhatsAppContractAvailable } from "@/features/whatsapp/constants/whatsapp-contracts";
import {
  WHATSAPP_CONNECTION_STATES,
  WHATSAPP_CONNECTION_TYPES,
  WHATSAPP_MESSAGE_STATUSES,
  type WhatsAppConnectionState,
  type WhatsAppConnectionType,
} from "@/features/whatsapp/enums/whatsapp.enums";
import { toWhatsAppTemplate } from "@/features/whatsapp/mappers/to-whatsapp-template.mapper";
import type {
  WhatsAppConnectionStatus,
  WhatsAppTestRun,
} from "@/features/whatsapp/models/connection.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import { resolveEffectivePermissions } from "@/features/whatsapp/utils/whatsapp-permissions.util";
import { ConnectionView } from "./ConnectionView";
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

  const effectivePermissions = useMemo(
    () => resolveEffectivePermissions([WHATSAPP_PERMISSION_CODES.CONNECTION]),
    [],
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
      setStatusState({ kind: "pending-integration" });
      setAccountState({ kind: "ready", data: null });
      setAccountsState({ kind: "ready", data: [] });
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

  // Definición de mutaciones reales conectadas a los botones de la interfaz
  const mutations = {
    refresh: async () => {
      const accountData = accountState.kind === "ready" ? accountState.data : null;
      if (!accountData?.id) return;
      await refreshWhatsAppAccount(token, accountData.id);
      await reloadAfterChange();
    },
    disconnect: async () => {
      const accountData = accountState.kind === "ready" ? accountState.data : null;
      if (!accountData?.id) return;
      await disconnectWhatsAppAccount(token, accountData.id);
      await reloadAfterChange();
    },
    changeType: async (newType: string) => {
      const accountData = accountState.kind === "ready" ? accountState.data : null;
      if (!accountData?.id) return;
      await updateWhatsAppAccount(token, accountData.id, newType);
      await reloadAfterChange();
    },
    sendTest: async ({
      phone,
      templateId,
    }: {
      accountId: string;
      phone: string;
      templateId: string;
    }): Promise<WhatsAppTestRun> => {
      const dto = templatesQuery.data?.find((template) => template.id === templateId);
      if (!dto) throw new Error("Plantilla no encontrada. Recarga la página.");
      const startedAt = new Date();
      const { messageId } = await sendWhatsAppTestTemplate({
        to: phone.replace(/\D/g, ""),
        templateName: dto.name,
        languageCode: dto.language,
      });
      // POWIP no devuelve todavía entregado/leído de esta prueba: queda como enviado.
      return {
        messageId,
        phone,
        templateName: dto.name,
        status: WHATSAPP_MESSAGE_STATUSES.SENT,
        startedAt,
        sentAt: new Date(),
        deliveredAt: null,
        readAt: null,
        failedAt: null,
        errorMessage: null,
      };
    },
    saveContingency: async (settings: any) => {
      console.log("Guardando contingencia:", settings);
    },
    markAssistedSent: async () => {},
    startSignup: async (_payload: any) => {
      // PENDIENTE (C-06): reemplazar por el Embedded Signup de Meta (FB.login con code).
      // Mientras tanto, solo en desarrollo local se conecta con la WABA de prueba de .env.local.
      const hasLocalTestWaba =
        !!LOCAL_TEST_WABA.wabaId && !!LOCAL_TEST_WABA.phoneNumberId && !!LOCAL_TEST_WABA.accessToken;

      if (process.env.NODE_ENV === "production" || !hasLocalTestWaba) {
        window.alert(
          "La conexión con Meta (Embedded Signup) todavía no está disponible. Configura la WABA de prueba en .env.local para desarrollo.",
        );
        return;
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
      contingency={{ kind: "ready", data: null }}
      agents={{ kind: "ready", data: [] }}
      assistedQueue={{ kind: "pending-integration" } as any}
      pricing={{ kind: "pending-integration" } as any}
      usage={{ kind: "pending-integration" } as any}
      signupAvailable={true}
      mutations={mutations as any}
      onRetry={loadConnectionData}
    />
  );
}