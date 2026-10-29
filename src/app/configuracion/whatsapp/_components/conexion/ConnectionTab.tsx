"use client";

import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
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

      const isConnected = (statusRes as any).state === "connected" || statusRes.status === "CONNECTED";

      setStatusState({
        kind: "ready",
        data: {
          state: isConnected ? "CONNECTED" : "DISCONNECTED",
          quality: statusRes.quality || "GREEN",
          dailyLimit: statusRes.tier || "TIER_1K",
        },
      });

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

  useEffect(() => {
    loadConnectionData();
  }, [activeStoreId, token]);

  // Definición de mutaciones reales conectadas a los botones de la interfaz
  const mutations = {
    refresh: async () => {
      const accountData = accountState.kind === "ready" ? accountState.data : null;
      if (!accountData?.id) return;
      await refreshWhatsAppAccount(token, accountData.id);
      await loadConnectionData();
    },
    disconnect: async () => {
      const accountData = accountState.kind === "ready" ? accountState.data : null;
      if (!accountData?.id) return;
      await disconnectWhatsAppAccount(token, accountData.id);
      await loadConnectionData();
    },
    changeType: async (newType: string) => {
      const accountData = accountState.kind === "ready" ? accountState.data : null;
      if (!accountData?.id) return;
      await updateWhatsAppAccount(token, accountData.id, newType);
      await loadConnectionData();
    },
    sendTest: async (phone: string, templateId: string) => {
      console.log("Enviando prueba a:", phone, "con plantilla:", templateId);
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
      await loadConnectionData();
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
      templates={{ kind: "ready", data: [] }}
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