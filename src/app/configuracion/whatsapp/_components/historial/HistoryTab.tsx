"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  OrderDetailModalProvider,
  useOrderDetailModal,
} from "@/components/orders/OrderDetailModal";
import { useAuth } from "@/contexts/AuthContext";
import {
  downloadWhatsAppHistory,
  getWhatsAppHistory,
  getWhatsAppHistoryMetrics,
  resendWhatsAppHistoryMessage,
} from "@/features/whatsapp/api/history.api";
import { getMyWhatsAppPermissions, grantedCodes } from "@/features/whatsapp/api/settings-ops.api";
import { isWhatsAppContractAvailable } from "@/features/whatsapp/constants/whatsapp-contracts";
import { DEFAULT_HISTORY_PERIOD } from "@/features/whatsapp/constants/whatsapp-settings-catalog";
import { WHATSAPP_HISTORY_STATUS_FILTERS } from "@/features/whatsapp/enums/whatsapp.enums";
import type {
  WhatsAppHistoryFilters,
  WhatsAppHistoryMetrics,
  WhatsAppHistoryPage,
} from "@/features/whatsapp/models/history.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import { toHistoryQuery } from "@/features/whatsapp/utils/history.util";
import { resolveEffectivePermissions } from "@/features/whatsapp/utils/whatsapp-permissions.util";
import { HistoryView } from "./HistoryView";

const PENDING = { kind: "pending-integration" } as const;
const PAGE_SIZE = 20;

const INITIAL_FILTERS: WhatsAppHistoryFilters = {
  period: DEFAULT_HISTORY_PERIOD,
  status: WHATSAPP_HISTORY_STATUS_FILTERS.ALL,
  search: "",
  storeId: null,
};

function HistoryTabContent() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const { openOrderDetail } = useOrderDetailModal();
  const storesSource = auth?.company?.stores;
  const stores = useMemo(
    () => (storesSource ?? []).map((store) => ({ id: store.id, name: store.name })),
    [storesSource],
  );
  const storeNames = useMemo(() => new Map(stores.map((s) => [s.id, s.name])), [stores]);
  const [filters, setFilters] = useState<WhatsAppHistoryFilters>(INITIAL_FILTERS);
  const [now, setNow] = useState(() => new Date());
  const [pageNumber, setPageNumber] = useState(1);
  const available = isWhatsAppContractAvailable("messages");

  // C-28: permisos reales del usuario (reenviar exige WA_REPLY; exportar, WA_VIEW).
  const myPermissionsQuery = useQuery({
    queryKey: ["whatsapp", "permissions", "me"],
    queryFn: getMyWhatsAppPermissions,
  });
  const codes = grantedCodes(myPermissionsQuery.data);
  const effectivePermissions = useMemo(() => resolveEffectivePermissions(codes), [codes]);
  const exportPermission = codes ? codes.includes("WA_VIEW") : null;

  const query = toHistoryQuery(filters, now);

  const changeFilters = useCallback((next: WhatsAppHistoryFilters) => {
    setFilters(next);
    setPageNumber(1);
    setNow(new Date());
  }, []);

  const pageQuery = useQuery({
    queryKey: [
      "whatsapp",
      "history",
      "page",
      query.storeId ?? "all",
      filters.status,
      query.q ?? "",
      query.from,
      query.to,
      pageNumber,
    ],
    queryFn: () => getWhatsAppHistory(query, filters.status, pageNumber, PAGE_SIZE, storeNames),
    enabled: available,
    placeholderData: (previous) => previous,
  });

  // D-67: los indicadores no dependen del filtro de estado.
  const metricsQuery = useQuery({
    queryKey: ["whatsapp", "history", "metrics", query.storeId ?? "all", query.q ?? "", query.from, query.to],
    queryFn: () => getWhatsAppHistoryMetrics(query),
    enabled: available,
  });

  const page: ResourceState<WhatsAppHistoryPage> = useMemo(() => {
    if (!available) return PENDING;
    if (pageQuery.data) return { kind: "ready", data: pageQuery.data };
    if (pageQuery.isError) return { kind: "error", message: "No se pudieron cargar los mensajes." };
    return { kind: "loading" };
  }, [available, pageQuery.data, pageQuery.isError]);

  const metrics: ResourceState<WhatsAppHistoryMetrics> = useMemo(() => {
    if (!available) return PENDING;
    if (metricsQuery.data) return { kind: "ready", data: metricsQuery.data };
    if (metricsQuery.isError) {
      return { kind: "error", message: "No se pudieron cargar los indicadores." };
    }
    return { kind: "loading" };
  }, [available, metricsQuery.data, metricsQuery.isError]);

  const retry = () => {
    void pageQuery.refetch();
    void metricsQuery.refetch();
  };

  const resend = async (messageId: string) => {
    await resendWhatsAppHistoryMessage(messageId);
    toast.success("Aviso puesto en cola para reenviarse");
    await queryClient.invalidateQueries({ queryKey: ["whatsapp", "history"] });
  };

  return (
    <HistoryView
      stores={stores}
      filters={filters}
      onFiltersChange={changeFilters}
      now={now}
      metrics={metrics}
      page={page}
      onPageChange={setPageNumber}
      onRetry={retry}
      effectivePermissions={effectivePermissions}
      exportPermission={exportPermission}
      onResend={available ? resend : undefined}
      onExport={available ? (exportQuery, status) => downloadWhatsAppHistory(exportQuery, status) : undefined}
      onOpenOrder={(orderId) => openOrderDetail(orderId, { initialTab: "seguimiento" })}
    />
  );
}

export function HistoryTab() {
  return (
    <OrderDetailModalProvider>
      <HistoryTabContent />
    </OrderDetailModalProvider>
  );
}
