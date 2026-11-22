"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
  OrderDetailModalProvider,
  useOrderDetailModal,
} from "@/components/orders/OrderDetailModal";
import { useAuth } from "@/contexts/AuthContext";
import {
  listWhatsAppMessages,
  type WhatsAppMessageDto,
} from "@/features/whatsapp/api/queue.api";
import { isWhatsAppContractAvailable } from "@/features/whatsapp/constants/whatsapp-contracts";
import { DEFAULT_HISTORY_PERIOD } from "@/features/whatsapp/constants/whatsapp-settings-catalog";
import {
  WHATSAPP_HISTORY_STATUS_FILTERS,
  WHATSAPP_MESSAGE_STATUSES,
  type WhatsAppHistoryStatusFilter,
  type WhatsAppMessageStatus,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type {
  WhatsAppHistoryFilters,
  WhatsAppHistoryMessage,
  WhatsAppHistoryMetrics,
  WhatsAppHistoryPage,
} from "@/features/whatsapp/models/history.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import { toHistoryQuery } from "@/features/whatsapp/utils/history.util";
import { resolveEffectivePermissions } from "@/features/whatsapp/utils/whatsapp-permissions.util";
import { HistoryView } from "./HistoryView";

const PENDING = { kind: "pending-integration" } as const;
const PAGE_SIZE = 20;
// El backend no busca por texto: con búsqueda se trae un bloque grande y se filtra aquí.
const SEARCH_PAGE_SIZE = 100;

const INITIAL_FILTERS: WhatsAppHistoryFilters = {
  period: DEFAULT_HISTORY_PERIOD,
  status: WHATSAPP_HISTORY_STATUS_FILTERS.ALL,
  search: "",
  storeId: null,
};

// Estados públicos de GET /wa/messages que cubre cada filtro de la pantalla.
const STATUS_FILTER_TO_QUERY: Record<WhatsAppHistoryStatusFilter, string | null> = {
  [WHATSAPP_HISTORY_STATUS_FILTERS.ALL]: null,
  [WHATSAPP_HISTORY_STATUS_FILTERS.SENT]: "sent,delivered,read",
  [WHATSAPP_HISTORY_STATUS_FILTERS.DELIVERED]: "delivered,read",
  [WHATSAPP_HISTORY_STATUS_FILTERS.READ]: "read",
  [WHATSAPP_HISTORY_STATUS_FILTERS.NOT_SENT]: "skipped,failed,cancelled",
  // POWIP todavía no guarda avisos marcados como enviados a mano.
  [WHATSAPP_HISTORY_STATUS_FILTERS.ASSISTED]: null,
};

const METRIC_QUERIES = {
  sent: "sent,delivered,read",
  delivered: "delivered,read",
  read: "read",
  notSent: "skipped,failed,cancelled",
} as const;

const KNOWN_STATUSES = new Set<string>(Object.values(WHATSAPP_MESSAGE_STATUSES));

function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function toStatus(status: string): WhatsAppMessageStatus {
  if (status === "cancelled") return WHATSAPP_MESSAGE_STATUSES.SKIPPED;
  return KNOWN_STATUSES.has(status)
    ? (status as WhatsAppMessageStatus)
    : WHATSAPP_MESSAGE_STATUSES.QUEUED;
}

function toHistoryMessage(
  dto: WhatsAppMessageDto,
  storeNames: Map<string, string>,
): WhatsAppHistoryMessage {
  const storeId = dto.storeId ?? "";
  return {
    id: dto.id,
    createdAt: new Date(dto.createdAt),
    orderId: dto.orderId,
    orderNumber: dto.orderNumber || null,
    storeId,
    storeName: storeNames.get(storeId) ?? "Tienda sin nombre",
    customerName: dto.customerName,
    phone: dto.phone ?? "",
    templateName: dto.templateName,
    courierName: dto.courier,
    status: toStatus(dto.status),
    reason: dto.reason,
    timeline: {
      queuedAt: toDate(dto.timeline.queuedAt),
      sentAt: toDate(dto.timeline.sentAt),
      deliveredAt: toDate(dto.timeline.deliveredAt),
      readAt: toDate(dto.timeline.readAt),
      failedAt: toDate(dto.timeline.failedAt),
      clickedAt: null,
    },
    assistedBy: null,
    canResend: false,
    resendBlockedReason: "Reenviar todavía no está disponible en POWIP.",
  };
}

function matchesSearch(dto: WhatsAppMessageDto, search: string): boolean {
  const digits = search.replace(/\D/g, "");
  const text = [dto.orderNumber, dto.customerName ?? "", dto.phone ?? ""]
    .join(" ")
    .toLowerCase();
  if (text.includes(search)) return true;
  return digits.length >= 3 && (dto.phone ?? "").replace(/\D/g, "").includes(digits);
}

function HistoryTabContent() {
  const { auth } = useAuth();
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
  const effectivePermissions = useMemo(() => resolveEffectivePermissions(null), []);
  const available = isWhatsAppContractAvailable("messages");

  const query = toHistoryQuery(filters, now);
  const storeId = query.storeId ?? undefined;
  const search = query.q?.toLowerCase() ?? null;
  const statusQuery = STATUS_FILTER_TO_QUERY[filters.status];
  const assistedOnly = filters.status === WHATSAPP_HISTORY_STATUS_FILTERS.ASSISTED;

  const changeFilters = useCallback((next: WhatsAppHistoryFilters) => {
    setFilters(next);
    setPageNumber(1);
    setNow(new Date());
  }, []);

  const pageQuery = useQuery({
    queryKey: [
      "whatsapp",
      "history",
      storeId ?? "all",
      statusQuery ?? "all",
      query.from,
      query.to,
      search ? "search" : pageNumber,
    ],
    queryFn: () =>
      listWhatsAppMessages({
        storeId,
        status: statusQuery ?? undefined,
        from: query.from,
        to: query.to,
        page: search ? 1 : pageNumber,
        pageSize: search ? SEARCH_PAGE_SIZE : PAGE_SIZE,
      }),
    enabled: available && !assistedOnly,
  });

  const metricsQuery = useQuery({
    queryKey: ["whatsapp", "history", "metrics", storeId ?? "all", query.from, query.to],
    queryFn: async () => {
      const entries = await Promise.all(
        Object.entries(METRIC_QUERIES).map(async ([key, status]) => {
          const result = await listWhatsAppMessages({
            storeId,
            status,
            from: query.from,
            to: query.to,
            page: 1,
            pageSize: 1,
          });
          return [key, result.total] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<keyof typeof METRIC_QUERIES, number>;
    },
    enabled: available,
  });

  const page: ResourceState<WhatsAppHistoryPage> = useMemo(() => {
    if (!available) return PENDING;
    if (assistedOnly) {
      return { kind: "ready", data: { items: [], page: 1, pageSize: PAGE_SIZE, total: 0, hasMore: false } };
    }
    if (pageQuery.data) {
      const source = search
        ? pageQuery.data.items.filter((item) => matchesSearch(item, search))
        : pageQuery.data.items;
      return {
        kind: "ready",
        data: {
          items: source.map((item) => toHistoryMessage(item, storeNames)),
          page: search ? 1 : pageQuery.data.page,
          pageSize: search ? source.length || PAGE_SIZE : pageQuery.data.pageSize,
          total: search ? source.length : pageQuery.data.total,
          hasMore: search ? false : pageQuery.data.hasMore,
        },
      };
    }
    if (pageQuery.isError) return { kind: "error", message: "No se pudieron cargar los mensajes." };
    return { kind: "loading" };
  }, [available, assistedOnly, pageQuery.data, pageQuery.isError, search, storeNames]);

  const metrics: ResourceState<WhatsAppHistoryMetrics> = useMemo(() => {
    if (!available) return PENDING;
    if (metricsQuery.data) {
      return {
        kind: "ready",
        data: {
          ...metricsQuery.data,
          trackingOpened: null,
          notSentBreakdown: null,
          assisted: null,
          computedAt: new Date(metricsQuery.dataUpdatedAt),
        },
      };
    }
    if (metricsQuery.isError) {
      return { kind: "error", message: "No se pudieron cargar los indicadores." };
    }
    return { kind: "loading" };
  }, [available, metricsQuery.data, metricsQuery.dataUpdatedAt, metricsQuery.isError]);

  const retry = () => {
    void pageQuery.refetch();
    void metricsQuery.refetch();
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
      exportPermission={null}
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
