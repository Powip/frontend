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
  WHATSAPP_OPT_OUT_ORIGINS,
  WHATSAPP_PERMISSION_CODES,
  type WhatsAppOptOutOrigin,
  type WhatsAppTab,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type {
  WhatsAppAuditFilters,
  WhatsAppOptOut,
  WhatsAppOptOutPage,
  WhatsAppProtectionSettings,
} from "@/features/whatsapp/models/settings-tab.model";
import type { ProtectionSettingsValues } from "@/features/whatsapp/schemas/settings-tab.schema";
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
  // La pestaña solo la gestionan administradores (el backend también lo exige):
  // con acceso de gestión se habilitan bajas y números extranjeros.
  const effectivePermissions = useMemo(
    () =>
      resolveEffectivePermissions(
        canManage ? [WHATSAPP_PERMISSION_CODES.OPT_OUTS, WHATSAPP_PERMISSION_CODES.RULES] : [],
      ),
    [canManage],
  );
  const [optOutSearch, setOptOutSearch] = useState("");
  const [optOutsPage, setOptOutsPage] = useState(1);
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
      reactivateOptOut: async ({ optOutId, note }) => {
        const version = optOutVersions.get(optOutId);
        if (version === undefined) throw new Error("Baja no encontrada. Recarga la lista.");
        await reactivateWhatsAppOptOut(optOutId, version, note);
        await queryClient.invalidateQueries({ queryKey: optOutsKey });
      },
    };
    // optOutsKey y settingsKey se derivan de storeId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, settingsQuery.data, optOutVersions, queryClient]);

  const openTab = (tab: WhatsAppTab) => {
    const params = new URLSearchParams(search);
    params.set("tab", tab);
    onNavigate(params.toString());
  };

  const retry = () => {
    void optOutsQuery.refetch();
    void settingsQuery.refetch();
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
      alertSettings={PENDING}
      recentAlerts={PENDING}
      audit={PENDING}
      auditFilters={auditFilters}
      onAuditFiltersChange={setAuditFilters}
      permissionMatrix={PENDING}
      mutations={mutations}
      onOpenTab={openTab}
      onRetry={retry}
    />
  );
}
