"use client";

import { type UseQueryResult, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  OrderDetailModalProvider,
  useOrderDetailModal,
} from "@/components/orders/OrderDetailModal";
import { useAuth } from "@/contexts/AuthContext";
import { createWhatsAppOptOut } from "@/features/whatsapp/api/optouts.api";
import { getWhatsAppSettings, updateWhatsAppSettings } from "@/features/whatsapp/api/settings.api";
import { getMyWhatsAppPermissions, grantedCodes } from "@/features/whatsapp/api/settings-ops.api";
import { listWhatsAppTemplates } from "@/features/whatsapp/api/templates.api";
import {
  addWhatsAppConversationNote,
  assignWhatsAppConversation,
  getWhatsAppConversation,
  getWhatsAppConversationBoard,
  getWhatsAppConversationColumnPage,
  getWhatsAppConversationList,
  listWhatsAppQuickReplies,
  markWhatsAppConversationAttended,
  replyWhatsAppConversation,
  retryWhatsAppConversationMessage,
  sendWhatsAppConversationTemplate,
  toWhatsAppApiError,
} from "@/features/whatsapp/api/threads.api";
import {
  CONVERSATION_COLUMN_PAGE_SIZE,
  CONVERSATION_LIST_PAGE_SIZE,
  WHATSAPP_QUICK_REPLIES,
} from "@/features/whatsapp/constants/whatsapp-conversation-catalog";
import { isWhatsAppContractAvailable } from "@/features/whatsapp/constants/whatsapp-contracts";
import {
  WHATSAPP_CONVERSATION_VIEWS,
  type WhatsAppConversationView,
  type WhatsAppThreadColumn,
} from "@/features/whatsapp/enums/whatsapp.enums";
import { useWhatsAppStoreAgents } from "@/features/whatsapp/hooks/use-whatsapp-store-agents";
import { whatsappKeys } from "@/features/whatsapp/keys/whatsapp.keys";
import { toWhatsAppTemplate } from "@/features/whatsapp/mappers/to-whatsapp-template.mapper";
import type {
  WhatsAppAgentOption,
  WhatsAppAutoReplySettings,
  WhatsAppConversationBoard,
  WhatsAppConversationColumnPage,
  WhatsAppConversationDetail,
  WhatsAppConversationFilters,
  WhatsAppConversationListPage,
} from "@/features/whatsapp/models/conversation.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import type { AutoReplyValues } from "@/features/whatsapp/schemas/auto-reply.schema";
import { resolveConversationCapabilities } from "@/features/whatsapp/utils/conversation-access.util";
import {
  EMPTY_CONVERSATION_FILTERS,
  toConversationQuery,
} from "@/features/whatsapp/utils/conversation-filters.util";
import {
  DEFAULT_CONVERSATION_VIEW,
  readStoredConversationView,
  writeStoredConversationView,
} from "@/features/whatsapp/utils/conversation-preferences.util";
import type { WhatsAppNavigate } from "@/features/whatsapp/utils/whatsapp-tab.util";
import type { ConversationMutations } from "./conversation-types";
import { ConversationsView } from "./ConversationsView";
import { QuickRepliesProvider } from "./quick-replies-context";

const PENDING = { kind: "pending-integration" } as const;

export const CONVERSATION_THREAD_PARAM = "thread";

interface ConversationsTabProps {
  canManage: boolean;
  businessName: string;
  search: string;
  onNavigate: WhatsAppNavigate;
}

function toResource<T>(query: UseQueryResult<T>, errorMessage: string): ResourceState<T> {
  if (query.data !== undefined) return { kind: "ready", data: query.data };
  if (query.isError) {
    const status = (query.error as { response?: { status?: number } } | null)?.response?.status;
    if (status === 403) return { kind: "forbidden" };
    return { kind: "error", message: errorMessage };
  }
  return { kind: "loading" };
}

type ColumnExtra = Partial<Record<WhatsAppThreadColumn, { page: number; data: WhatsAppConversationColumnPage }>>;

/** Junta la primera página del tablero con las páginas extra de «Ver más», sin repetir hilos. */
function mergeBoard(board: WhatsAppConversationBoard, extra: ColumnExtra): WhatsAppConversationBoard {
  const merged = { ...board };
  for (const [column, more] of Object.entries(extra) as [
    WhatsAppThreadColumn,
    { page: number; data: WhatsAppConversationColumnPage },
  ][]) {
    const seen = new Set(board[column].items.map((item) => item.id));
    merged[column] = {
      items: [...board[column].items, ...more.data.items.filter((item) => !seen.has(item.id))],
      total: more.data.total ?? board[column].total,
      hasMore: more.data.hasMore,
    };
  }
  return merged;
}

function ConversationsTabContent({
  canManage,
  businessName,
  search,
  onNavigate,
}: ConversationsTabProps) {
  const { auth, selectedStoreId } = useAuth();
  const queryClient = useQueryClient();
  const { openOrderDetail } = useOrderDetailModal();
  const companyId = auth?.company?.id ?? auth?.user?.companyId ?? "none";
  const storesSource = auth?.company?.stores;
  const stores = useMemo(
    () => (storesSource ?? []).map((store) => ({ id: store.id, name: store.name })),
    [storesSource],
  );
  const storeNames = useMemo(() => new Map(stores.map((s) => [s.id, s.name])), [stores]);
  const currentUserId = auth?.user?.id ?? null;
  const [filters, setFilters] = useState<WhatsAppConversationFilters>(EMPTY_CONVERSATION_FILTERS);
  const [view, setView] = useState<WhatsAppConversationView>(DEFAULT_CONVERSATION_VIEW);
  const [listPage, setListPage] = useState(1);
  const [columnExtra, setColumnExtra] = useState<ColumnExtra>({});
  const selectedConversationId = new URLSearchParams(search).get(CONVERSATION_THREAD_PARAM);
  const available = isWhatsAppContractAvailable("threads");
  const query = useMemo(() => toConversationQuery(filters, currentUserId), [filters, currentUserId]);

  useEffect(() => {
    const stored = readStoredConversationView();
    if (stored) setView(stored);
  }, []);

  // Cambiar filtros vuelve a la primera página y descarta las páginas extra del tablero.
  // biome-ignore lint/correctness/useExhaustiveDependencies: se reinicia al cambiar la consulta.
  useEffect(() => {
    setListPage(1);
    setColumnExtra({});
  }, [query.q, query.storeId, query.assignedTo]);

  // ---------- C-28 · permisos del usuario ----------
  const myPermissionsQuery = useQuery({
    queryKey: ["whatsapp", "permissions", "me"],
    queryFn: getMyWhatsAppPermissions,
  });
  const capabilities = useMemo(
    () => resolveConversationCapabilities(grantedCodes(myPermissionsQuery.data)),
    [myPermissionsQuery.data],
  );

  // ---------- C-22.1 · tablero y lista ----------
  const boardQuery = useQuery({
    queryKey: whatsappKeys.conversations(companyId, "board", { ...query }),
    queryFn: () => getWhatsAppConversationBoard(query, storeNames, CONVERSATION_COLUMN_PAGE_SIZE),
    enabled: available && view === WHATSAPP_CONVERSATION_VIEWS.BOARD,
    placeholderData: (previous) => previous,
  });
  const listQuery = useQuery({
    queryKey: whatsappKeys.conversations(companyId, "list", { ...query, page: listPage }),
    queryFn: () =>
      getWhatsAppConversationList(query, listPage, CONVERSATION_LIST_PAGE_SIZE, storeNames),
    enabled: available && view === WHATSAPP_CONVERSATION_VIEWS.LIST,
    placeholderData: (previous) => previous,
  });

  const board: ResourceState<WhatsAppConversationBoard> = useMemo(() => {
    if (!available) return PENDING;
    const state = toResource(boardQuery, "No se pudieron cargar las conversaciones.");
    return state.kind === "ready" ? { kind: "ready", data: mergeBoard(state.data, columnExtra) } : state;
  }, [available, boardQuery, columnExtra]);
  const list: ResourceState<WhatsAppConversationListPage> = available
    ? toResource(listQuery, "No se pudieron cargar las conversaciones.")
    : PENDING;

  const loadMoreColumn = useCallback(
    async (column: WhatsAppThreadColumn) => {
      const nextPage = (columnExtra[column]?.page ?? 1) + 1;
      try {
        const more = await getWhatsAppConversationColumnPage(
          query,
          column,
          nextPage,
          CONVERSATION_COLUMN_PAGE_SIZE,
          storeNames,
        );
        setColumnExtra((current) => {
          const previous = current[column]?.data.items ?? [];
          return {
            ...current,
            [column]: { page: nextPage, data: { ...more, items: [...previous, ...more.items] } },
          };
        });
      } catch (error) {
        toast.error(toWhatsAppApiError(error, "No se pudieron cargar más conversaciones.").message);
      }
    },
    [columnExtra, query, storeNames],
  );

  // ---------- C-22.2 · detalle del hilo abierto ----------
  const threadKey = whatsappKeys.thread(companyId, selectedConversationId ?? "none");
  const threadQuery = useQuery({
    queryKey: threadKey,
    queryFn: () => getWhatsAppConversation(selectedConversationId as string, storeNames),
    enabled: available && !!selectedConversationId,
  });
  const detail = available
    ? toResource(threadQuery, "No se pudo abrir la conversación.")
    : PENDING;

  // ---------- C-12 · plantillas aprobadas para fuera de la ventana ----------
  const templatesAvailable = isWhatsAppContractAvailable("templates");
  const templatesQuery = useQuery({
    queryKey: ["whatsapp", "templates"],
    queryFn: listWhatsAppTemplates,
    enabled: templatesAvailable,
  });
  const templates: ResourceState<WhatsAppTemplate[]> = useMemo(() => {
    if (!templatesAvailable) return PENDING;
    if (templatesQuery.data) return { kind: "ready", data: templatesQuery.data.map(toWhatsAppTemplate) };
    if (templatesQuery.isError) return { kind: "error", message: "No se pudieron cargar las plantillas." };
    return { kind: "loading" };
  }, [templatesAvailable, templatesQuery.data, templatesQuery.isError]);

  // ---------- C-23 · respuestas rápidas de la tienda del hilo ----------
  const threadStoreId = threadQuery.data?.storeId || null;
  const quickRepliesQuery = useQuery({
    queryKey: ["whatsapp", "quick-replies", threadStoreId ?? "company"],
    queryFn: () => listWhatsAppQuickReplies(threadStoreId),
    enabled: isWhatsAppContractAvailable("quickReplies") && !!selectedConversationId,
    staleTime: 5 * 60 * 1000,
  });
  const quickReplies = quickRepliesQuery.data ?? WHATSAPP_QUICK_REPLIES;

  // ---------- C-18 · respuesta automática (tienda activa, D-68) ----------
  const settingsStoreId =
    stores.find((store) => store.id === selectedStoreId)?.id ?? stores[0]?.id ?? null;
  const settingsKey = ["whatsapp", "settings", settingsStoreId ?? "none"] as const;
  const settingsAvailable = isWhatsAppContractAvailable("settings");
  const settingsQuery = useQuery({
    queryKey: settingsKey,
    queryFn: () => getWhatsAppSettings(settingsStoreId as string),
    enabled: settingsAvailable && !!settingsStoreId,
  });
  const autoReply: ResourceState<WhatsAppAutoReplySettings | null> = useMemo(() => {
    if (!settingsAvailable || !settingsStoreId) return PENDING;
    if (settingsQuery.data) {
      const { autoReply: value, version } = settingsQuery.data;
      return { kind: "ready", data: value ? { ...value, version } : null };
    }
    if (settingsQuery.isError) {
      return { kind: "error", message: "No se pudo cargar la respuesta automática." };
    }
    return { kind: "loading" };
  }, [settingsAvailable, settingsStoreId, settingsQuery.data, settingsQuery.isError]);

  const saveAutoReply = async (values: AutoReplyValues) => {
    const current = settingsQuery.data;
    if (!settingsStoreId || !current) return;
    const { version, ...rest } = current;
    try {
      const saved = await updateWhatsAppSettings(settingsStoreId, version, {
        ...rest,
        autoReply: values,
      });
      queryClient.setQueryData(settingsKey, saved);
      toast.success("Respuesta automática guardada");
    } catch (error) {
      const apiError = toWhatsAppApiError(error, "No se pudo guardar la respuesta automática.");
      if ((apiError as { code?: string }).code === "WA_VERSION_CONFLICT") {
        toast.error("Alguien más cambió la configuración. Cargamos la versión actual.");
        await queryClient.invalidateQueries({ queryKey: settingsKey });
        return;
      }
      toast.error(apiError.message);
    }
  };

  // ---------- C-22.3..C-22.8 · acciones del hilo ----------
  const afterThreadChange = useCallback(
    (updated: WhatsAppConversationDetail) => {
      queryClient.setQueryData(whatsappKeys.thread(companyId, updated.id), updated);
      void queryClient.invalidateQueries({
        queryKey: [...whatsappKeys.company(companyId), "conversations"],
      });
    },
    [companyId, queryClient],
  );

  const agentsForThread = useWhatsAppStoreAgents(threadStoreId, capabilities.reassign);
  const agentName = useCallback(
    (agentId: string) => {
      const agents: WhatsAppAgentOption[] = agentsForThread.kind === "ready" ? agentsForThread.data : [];
      return agents.find((agent) => agent.id === agentId)?.name ?? "Asesora";
    },
    [agentsForThread],
  );

  const mutations: ConversationMutations = useMemo(() => {
    if (!available) return {};
    return {
      sendReply: async ({ conversationId, text }) =>
        afterThreadChange(await replyWhatsAppConversation(conversationId, text, storeNames)),
      sendTemplate: async ({ conversationId, templateId }) =>
        afterThreadChange(
          await sendWhatsAppConversationTemplate(conversationId, templateId, storeNames),
        ),
      addNote: async ({ conversationId, text }) =>
        afterThreadChange(await addWhatsAppConversationNote(conversationId, text, storeNames)),
      reassign: async ({ conversationId, assigneeId, version }) =>
        afterThreadChange(
          await assignWhatsAppConversation(
            conversationId,
            { id: assigneeId, name: agentName(assigneeId) },
            version,
            storeNames,
          ),
        ),
      retry: async ({ messageId }) =>
        afterThreadChange(await retryWhatsAppConversationMessage(messageId, storeNames)),
      markAttended: async ({ conversationId, version }) =>
        afterThreadChange(
          await markWhatsAppConversationAttended(conversationId, version, storeNames),
        ),
      optOut: isWhatsAppContractAvailable("optOuts")
        ? async ({ conversationId, phone, storeId, reason }) => {
            try {
              await createWhatsAppOptOut({
                phone,
                storeId: storeId || null,
                origin: "agent",
                note: reason,
              });
            } catch (error) {
              throw toWhatsAppApiError(error, "No se pudo registrar la baja.");
            }
            await queryClient.invalidateQueries({
              queryKey: whatsappKeys.thread(companyId, conversationId),
            });
            await queryClient.invalidateQueries({
              queryKey: [...whatsappKeys.company(companyId), "conversations"],
            });
            await queryClient.invalidateQueries({ queryKey: ["whatsapp", "optouts"] });
          }
        : undefined,
    };
  }, [afterThreadChange, agentName, available, companyId, queryClient, storeNames]);

  const changeView = (next: WhatsAppConversationView) => {
    setView(next);
    writeStoredConversationView(next);
  };

  const selectConversation = (conversationId: string | null) => {
    const params = new URLSearchParams(search);
    if (conversationId) params.set(CONVERSATION_THREAD_PARAM, conversationId);
    else params.delete(CONVERSATION_THREAD_PARAM);
    onNavigate(params.toString(), { replace: conversationId === null });
  };

  const retryList = () => {
    setColumnExtra({});
    void (view === WHATSAPP_CONVERSATION_VIEWS.BOARD ? boardQuery.refetch() : listQuery.refetch());
  };

  return (
    <QuickRepliesProvider value={quickReplies}>
      <ConversationsView
        stores={stores}
        currentUserId={currentUserId}
        businessName={businessName}
        filters={filters}
        onFiltersChange={setFilters}
        view={view}
        onViewChange={changeView}
        board={board}
        list={list}
        onLoadMoreColumn={(column) => void loadMoreColumn(column)}
        onListPageChange={setListPage}
        onRetryList={retryList}
        selectedConversationId={selectedConversationId}
        onSelectConversation={selectConversation}
        getConversation={(id) => (id === selectedConversationId ? detail : { kind: "loading" })}
        onRetryConversation={() => void threadQuery.refetch()}
        templates={templates}
        capabilities={capabilities}
        mutations={mutations}
        useStoreAgents={useWhatsAppStoreAgents}
        autoReply={autoReply}
        canConfigureAutoReply={canManage}
        canPersistAutoReply={settingsAvailable && !!settingsQuery.data}
        onSaveAutoReply={(values) => void saveAutoReply(values)}
        onOpenOrder={(orderId) => openOrderDetail(orderId, { initialTab: "seguimiento" })}
      />
    </QuickRepliesProvider>
  );
}

export function ConversationsTab(props: ConversationsTabProps) {
  return (
    <OrderDetailModalProvider>
      <ConversationsTabContent {...props} />
    </OrderDetailModalProvider>
  );
}
