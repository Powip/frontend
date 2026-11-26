"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  createWhatsAppOptOut,
  listWhatsAppOptOuts,
  reactivateWhatsAppOptOut,
  type WhatsAppOptOutDto,
} from "@/features/whatsapp/api/optouts.api";
import { getWhatsAppSettings, updateWhatsAppSettings } from "@/features/whatsapp/api/settings.api";
import {
  getMyWhatsAppPermissions,
  getWhatsAppAlertSettings,
  getWhatsAppPermissionSettings,
  grantedCodes,
  listWhatsAppAudit,
  listWhatsAppRecentAlerts,
  updateWhatsAppAlertSettings,
  updateWhatsAppPermissionSettings,
} from "@/features/whatsapp/api/settings-ops.api";
import {
  WHATSAPP_OPT_OUT_ORIGINS,
  WHATSAPP_PERMISSION_CODES,
  type WhatsAppOptOutOrigin,
  type WhatsAppTab,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type {
  WhatsAppAlertSettings,
  WhatsAppAuditFilters,
  WhatsAppAuditPage,
  WhatsAppPermissionMatrix,
  WhatsAppPermissionSettings,
  WhatsAppRecentAlert,
  WhatsAppOptOut,
  WhatsAppOptOutPage,
  WhatsAppProtectionSettings,
} from "@/features/whatsapp/models/settings-tab.model";
import type {
  AlertSettingsValues,
  ProtectionSettingsValues,
} from "@/features/whatsapp/schemas/settings-tab.schema";
import { resolveEffectivePermissions } from "@/features/whatsapp/utils/whatsapp-permissions.util";
import type { WhatsAppNavigate } from "@/features/whatsapp/utils/whatsapp-tab.util";
import { SettingsView } from "./SettingsView";
import type { SettingsMutations } from "./settings-types";

const PENDING = { kind: "pending-integration" } as const;
const OPT_OUTS_PAGE_SIZE = 20;
const KNOWN_ORIGINS = new Set<string>(Object.values(WHATSAPP_OPT_OUT_ORIGINS));

interface SettingsTabProps {
  canManage: boolean;
  search: string;
  onNavigate: WhatsAppNavigate;
}

function toOptOut(dto: WhatsAppOptOutDto, storeNames: Map<string, string>): WhatsAppOptOut {
  return {
    id: dto.id,
    customerName: dto.customerName,
    phone: dto.phone,
    storeId: dto.storeId,
    storeName: dto.storeId ? (storeNames.get(dto.storeId) ?? dto.storeName) : null,
    origin:
      dto.origin && KNOWN_ORIGINS.has(dto.origin) ? (dto.origin as WhatsAppOptOutOrigin) : null,
    createdAt: new Date(dto.createdAt),
    createdBy: dto.createdBy,
  };
}

export function SettingsTab({ canManage, search, onNavigate }: SettingsTabProps) {
  const { auth, selectedStoreId } = useAuth();
  const queryClient = useQueryClient();
  const storesSource = auth?.company?.stores;
  const stores = useMemo(
    () => (storesSource ?? []).map((store) => ({ id: store.id, name: store.name })),
    [storesSource],
  );
  const storeNames = useMemo(() => new Map(stores.map((s) => [s.id, s.name])), [stores]);
  const storeContext = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;
  const storeId = storeContext?.id ?? null;
  // Permisos reales del usuario (C-28 · /wa/permissions/me). Mientras cargan, la
  // pestaña solo la gestionan administradores (el backend también lo exige).
  const myPermissionsQuery = useQuery({
    queryKey: ["whatsapp", "permissions", "me"],
    queryFn: getMyWhatsAppPermissions,
  });
  const effectivePermissions = useMemo(() => {
    const granted = grantedCodes(myPermissionsQuery.data);
    if (granted) return resolveEffectivePermissions(granted);
    return resolveEffectivePermissions(
      canManage ? [WHATSAPP_PERMISSION_CODES.OPT_OUTS, WHATSAPP_PERMISSION_CODES.RULES] : [],
    );
  }, [canManage, myPermissionsQuery.data]);
  const [optOutSearch, setOptOutSearch] = useState("");
  const [optOutsPage, setOptOutsPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [auditFilters, setAuditFilters] = useState<WhatsAppAuditFilters>({
    entity: null,
    userId: null,
  });

  const searchTerm = optOutSearch.trim();
  const optOutsKey = ["whatsapp", "optouts", storeId ?? "none"] as const;
  const settingsKey = ["whatsapp", "settings", storeId ?? "none"] as const;

  const optOutsQuery = useQuery({
    queryKey: [...optOutsKey, searchTerm, optOutsPage],
    queryFn: () =>
      listWhatsAppOptOuts({
        storeId: storeId as string,
        q: searchTerm || undefined,
        page: optOutsPage,
        pageSize: OPT_OUTS_PAGE_SIZE,
      }),
    enabled: !!storeId,
  });

  const alertsKey = ["whatsapp", "alerts", storeId ?? "none"] as const;
  const permissionsKey = ["whatsapp", "permissions", "matrix"] as const;

  const alertSettingsQuery = useQuery({
    queryKey: [...alertsKey, "rules"],
    queryFn: () => getWhatsAppAlertSettings(storeId as string),
    enabled: !!storeId,
  });
  const recentAlertsQuery = useQuery({
    queryKey: [...alertsKey, "recent"],
    queryFn: () => listWhatsAppRecentAlerts(storeId as string),
    enabled: !!storeId,
  });
  const auditQuery = useQuery({
    queryKey: ["whatsapp", "audit", storeId ?? "none", auditFilters.entity, auditFilters.userId, auditPage],
    queryFn: () => listWhatsAppAudit({ storeId, filters: auditFilters, page: auditPage, pageSize: 20 }),
  });
  const permissionsQuery = useQuery({
    queryKey: permissionsKey,
    queryFn: getWhatsAppPermissionSettings,
  });

  const settingsQuery = useQuery({
    queryKey: settingsKey,
    queryFn: () => getWhatsAppSettings(storeId as string),
    enabled: !!storeId,
  });

  // El modelo de pantalla no lleva versión: se guarda aparte para el If-Match de reactivar.
  const optOutVersions = useMemo(
    () => new Map((optOutsQuery.data?.items ?? []).map((item) => [item.id, item.version])),
    [optOutsQuery.data],
  );

  const optOuts: ResourceState<WhatsAppOptOutPage> = useMemo(() => {
    if (!storeId) return PENDING;
    if (optOutsQuery.data) {
      return {
        kind: "ready",
        data: {
          items: optOutsQuery.data.items.map((item) => toOptOut(item, storeNames)),
          page: optOutsQuery.data.page,
          pageSize: optOutsQuery.data.pageSize,
          total: optOutsQuery.data.total,
          hasMore: optOutsQuery.data.hasMore,
        },
      };
    }
    if (optOutsQuery.isError) return { kind: "error", message: "No se pudo cargar la lista de bajas." };
    return { kind: "loading" };
  }, [storeId, optOutsQuery.data, optOutsQuery.isError, storeNames]);

  const protection: ResourceState<WhatsAppProtectionSettings | null> = useMemo(() => {
    if (!storeId) return PENDING;
    if (settingsQuery.data) {
      return {
        kind: "ready",
        data: {
          optOutByKeyword: settingsQuery.data.optOutByKeyword,
          foreignInbound: settingsQuery.data.foreignNumbers.inbound,
          allowForeignOutbound: settingsQuery.data.foreignNumbers.allowOutbound,
          version: settingsQuery.data.version,
        },
      };
    }
    if (settingsQuery.isError) return { kind: "error", message: "No se pudo cargar la configuración." };
    return { kind: "loading" };
  }, [storeId, settingsQuery.data, settingsQuery.isError]);

  const alertSettings: ResourceState<WhatsAppAlertSettings | null> = useMemo(() => {
    if (!storeId) return PENDING;
    if (alertSettingsQuery.data) return { kind: "ready", data: alertSettingsQuery.data };
    if (alertSettingsQuery.isError) return { kind: "error", message: "No se pudieron cargar las alertas." };
    return { kind: "loading" };
  }, [storeId, alertSettingsQuery.data, alertSettingsQuery.isError]);

  const recentAlerts: ResourceState<WhatsAppRecentAlert[]> = useMemo(() => {
    if (!storeId) return PENDING;
    if (recentAlertsQuery.data) return { kind: "ready", data: recentAlertsQuery.data };
    if (recentAlertsQuery.isError) return { kind: "error", message: "No se pudieron cargar las alertas recientes." };
    return { kind: "loading" };
  }, [storeId, recentAlertsQuery.data, recentAlertsQuery.isError]);

  const audit: ResourceState<WhatsAppAuditPage> = useMemo(() => {
    if (auditQuery.data) return { kind: "ready", data: auditQuery.data };
    if (auditQuery.isError) return { kind: "error", message: "No se pudo cargar la auditoría." };
    return { kind: "loading" };
  }, [auditQuery.data, auditQuery.isError]);

  const permissionMatrix: ResourceState<WhatsAppPermissionSettings> = useMemo(() => {
    if (permissionsQuery.data) return { kind: "ready", data: permissionsQuery.data };
    if (permissionsQuery.isError) return { kind: "error", message: "No se pudieron cargar los permisos." };
    return { kind: "loading" };
  }, [permissionsQuery.data, permissionsQuery.isError]);

  const changeOptOutSearch = (value: string) => {
    setOptOutSearch(value);
    setOptOutsPage(1);
  };

  const mutations: SettingsMutations = useMemo(() => {
    if (!storeId) return {};
    return {
      saveProtection: async (values: ProtectionSettingsValues) => {
        const current = settingsQuery.data ?? (await getWhatsAppSettings(storeId));
        const { version, ...body } = current;
        await updateWhatsAppSettings(storeId, version, {
          ...body,
          optOutByKeyword: values.optOutByKeyword,
          foreignNumbers: {
            inbound: values.foreignInbound,
            allowOutbound: values.allowForeignOutbound,
          },
        });
        await queryClient.invalidateQueries({ queryKey: settingsKey });
      },
      addOptOut: async (input) => {
        await createWhatsAppOptOut({
          phone: input.phone,
          storeId: input.storeId,
          customerName: input.customerName,
          origin: "manual",
          note: input.note,
        });
        await queryClient.invalidateQueries({ queryKey: optOutsKey });
      },
      saveAlerts: async (values: AlertSettingsValues) => {
        const current = alertSettingsQuery.data ?? (await getWhatsAppAlertSettings(storeId));
        await updateWhatsAppAlertSettings(storeId, current.version, {
          rules: values.rules.map((rule) => ({
            type: rule.type,
            enabled: rule.enabled,
            threshold: rule.threshold.trim() === "" ? null : Number.parseInt(rule.threshold, 10),
          })),
          recipients: values.recipients,
          pauseCampaignsOnRed: values.pauseCampaignsOnRed,
        });
        await queryClient.invalidateQueries({ queryKey: alertsKey });
        await queryClient.invalidateQueries({ queryKey: ["whatsapp", "audit"] });
      },
      savePermissions: async (matrix: WhatsAppPermissionMatrix) => {
        const current = permissionsQuery.data ?? (await getWhatsAppPermissionSettings());
        await updateWhatsAppPermissionSettings(current.version, matrix);
        await queryClient.invalidateQueries({ queryKey: ["whatsapp", "permissions"] });
        await queryClient.invalidateQueries({ queryKey: ["whatsapp", "audit"] });
      },
      reactivateOptOut: async ({ optOutId, note }) => {
        const version = optOutVersions.get(optOutId);
        if (version === undefined) throw new Error("Baja no encontrada. Recarga la lista.");
        await reactivateWhatsAppOptOut(optOutId, version, note);
        await queryClient.invalidateQueries({ queryKey: optOutsKey });
      },
    };
    // optOutsKey, settingsKey y alertsKey se derivan de storeId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    storeId,
    settingsQuery.data,
    alertSettingsQuery.data,
    permissionsQuery.data,
    optOutVersions,
    queryClient,
  ]);

  const openTab = (tab: WhatsAppTab) => {
    const params = new URLSearchParams(search);
    params.set("tab", tab);
    onNavigate(params.toString());
  };

  const retry = () => {
    void optOutsQuery.refetch();
    void settingsQuery.refetch();
    void alertSettingsQuery.refetch();
    void recentAlertsQuery.refetch();
    void auditQuery.refetch();
    void permissionsQuery.refetch();
  };

  return (
    <SettingsView
      stores={stores}
      storeContext={storeContext}
      now={new Date()}
      canManage={canManage}
      effectivePermissions={effectivePermissions}
      protection={protection}
      optOuts={optOuts}
      optOutSearch={optOutSearch}
      onOptOutSearchChange={changeOptOutSearch}
      onOptOutsPageChange={setOptOutsPage}
      alertSettings={alertSettings}
      recentAlerts={recentAlerts}
      audit={audit}
      auditFilters={auditFilters}
      onAuditFiltersChange={(filters) => {
        setAuditFilters(filters);
        setAuditPage(1);
      }}
      onAuditPageChange={setAuditPage}
      permissionMatrix={permissionMatrix}
      mutations={mutations}
      onOpenTab={openTab}
      onRetry={retry}
    />
  );
}
