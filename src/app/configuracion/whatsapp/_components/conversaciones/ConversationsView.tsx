"use client";

import { MessagesSquare, SearchX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import {
  WHATSAPP_CONVERSATION_VIEWS,
  type WhatsAppConversationView,
  type WhatsAppThreadColumn,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type {
  WhatsAppAutoReplySettings,
  WhatsAppConversationBoard,
  WhatsAppConversationCapabilities,
  WhatsAppConversationDetail,
  WhatsAppConversationFilters,
  WhatsAppConversationListPage,
} from "@/features/whatsapp/models/conversation.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import type { AutoReplyValues } from "@/features/whatsapp/schemas/auto-reply.schema";
import {
  EMPTY_CONVERSATION_FILTERS,
  hasActiveConversationFilters,
} from "@/features/whatsapp/utils/conversation-filters.util";
import { CONVERSATION_COLUMN_ORDER } from "@/features/whatsapp/utils/conversation-state.util";
import { AutoReplyDialog } from "./AutoReplyDialog";
import { ConversationDrawer } from "./ConversationDrawer";
import type { UseStoreAgents } from "./ConversationPanel";
import { ConversationsBoard } from "./ConversationsBoard";
import { ConversationsTable } from "./ConversationsTable";
import { ConversationsToolbar } from "./ConversationsToolbar";
import type { ConversationMutations } from "./conversation-types";

export interface ConversationsViewProps {
  stores: { id: string; name: string }[];
  currentUserId: string | null;
  businessName: string;
  filters: WhatsAppConversationFilters;
  onFiltersChange: (filters: WhatsAppConversationFilters) => void;
  view: WhatsAppConversationView;
  onViewChange: (view: WhatsAppConversationView) => void;
  board: ResourceState<WhatsAppConversationBoard>;
  list: ResourceState<WhatsAppConversationListPage>;
  onLoadMoreColumn?: (column: WhatsAppThreadColumn) => void;
  onListPageChange?: (page: number) => void;
  onRetryList?: () => void;
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string | null) => void;
  getConversation: (conversationId: string) => ResourceState<WhatsAppConversationDetail>;
  onRetryConversation?: () => void;
  templates: ResourceState<WhatsAppTemplate[]>;
  capabilities: WhatsAppConversationCapabilities;
  mutations: ConversationMutations;
  useStoreAgents: UseStoreAgents;
  autoReply: ResourceState<WhatsAppAutoReplySettings | null>;
  canConfigureAutoReply: boolean;
  canPersistAutoReply: boolean;
  onSaveAutoReply?: (values: AutoReplyValues) => void;
  onOpenOrder: (orderId: string) => void;
  now?: Date;
}

function EmptyState({
  filtered,
  onClearFilters,
}: {
  filtered: boolean;
  onClearFilters: () => void;
}) {
  if (filtered) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
        <SearchX className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium">No hay conversaciones con estos filtros.</p>
        <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
          Limpiar filtros
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
      <MessagesSquare className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium">Todavía no hay conversaciones.</p>
      <p className="text-sm text-muted-foreground">Aparecen cuando sale el primer aviso.</p>
    </div>
  );
}

const PENDING_ITEMS = [
  "Tablero por estado del mensaje y lista",
  "Chat por pedido con su ventana de 24 h",
  "Respuestas, plantillas, notas y asignación",
];

export function ConversationsView({
  stores,
  currentUserId,
  businessName,
  filters,
  onFiltersChange,
  view,
  onViewChange,
  board,
  list,
  onLoadMoreColumn,
  onListPageChange,
  onRetryList,
  selectedConversationId,
  onSelectConversation,
  getConversation,
  onRetryConversation,
  templates,
  capabilities,
  mutations,
  useStoreAgents,
  autoReply,
  canConfigureAutoReply,
  canPersistAutoReply,
  onSaveAutoReply,
  onOpenOrder,
  now,
}: ConversationsViewProps) {
  const [displayedId, setDisplayedId] = useState<string | null>(selectedConversationId);
  const [draftDirty, setDraftDirty] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<{ id: string | null } | null>(null);
  const [autoReplyOpen, setAutoReplyOpen] = useState(false);
  const discardingRef = useRef(false);
  const renderNow = now ?? new Date();
  const filtered = hasActiveConversationFilters(filters);

  useEffect(() => {
    if (selectedConversationId === displayedId) {
      setPendingTarget(null);
      return;
    }
    if (draftDirty) {
      setPendingTarget({ id: selectedConversationId });
      return;
    }
    setDisplayedId(selectedConversationId);
  }, [selectedConversationId, displayedId, draftDirty]);

  const handleDirtyChange = useCallback((dirty: boolean) => setDraftDirty(dirty), []);

  const keepCurrentConversation = () => {
    setPendingTarget(null);
    onSelectConversation(displayedId);
  };

  const discardAndContinue = () => {
    if (!pendingTarget) return;
    discardingRef.current = true;
    setDraftDirty(false);
    setDisplayedId(pendingTarget.id);
    setPendingTarget(null);
  };

  const clearFilters = () => onFiltersChange(EMPTY_CONVERSATION_FILTERS);
  const openConversation = (conversationId: string) => onSelectConversation(conversationId);

  return (
    <div className="space-y-4">
      <ConversationsToolbar
        stores={stores}
        filters={filters}
        onFiltersChange={onFiltersChange}
        currentUserId={currentUserId}
        view={view}
        onViewChange={onViewChange}
        canConfigureAutoReply={canConfigureAutoReply}
        onOpenAutoReply={() => setAutoReplyOpen(true)}
      />

      {view === WHATSAPP_CONVERSATION_VIEWS.BOARD ? (
        <WhatsAppResourceState
          state={board}
          pendingTitle="Conversaciones pendientes de integración"
          pendingDescription="Cuando el servicio de WhatsApp de POWIP esté disponible verás aquí lo que contestan los compradores. No se muestran conversaciones ni contadores de ejemplo."
          pendingItems={PENDING_ITEMS}
          loadingLabel="Cargando conversaciones"
          errorTitle="No se pudieron cargar las conversaciones"
          onRetry={onRetryList}
          isEmpty={(data) =>
            CONVERSATION_COLUMN_ORDER.every((column) => data[column].items.length === 0)
          }
          empty={<EmptyState filtered={filtered} onClearFilters={clearFilters} />}
        >
          {(data) => (
            <ConversationsBoard
              board={data}
              now={renderNow}
              onOpen={openConversation}
              onLoadMore={onLoadMoreColumn}
            />
          )}
        </WhatsAppResourceState>
      ) : (
        <WhatsAppResourceState
          state={list}
          pendingTitle="Conversaciones pendientes de integración"
          pendingDescription="Cuando el servicio de WhatsApp de POWIP esté disponible verás aquí lo que contestan los compradores. No se muestran conversaciones ni contadores de ejemplo."
          pendingItems={PENDING_ITEMS}
          loadingLabel="Cargando conversaciones"
          errorTitle="No se pudieron cargar las conversaciones"
          onRetry={onRetryList}
          isEmpty={(data) => data.items.length === 0 && data.page === 1}
          empty={<EmptyState filtered={filtered} onClearFilters={clearFilters} />}
        >
          {(data) => (
            <ConversationsTable
              page={data}
              now={renderNow}
              onOpen={openConversation}
              onPageChange={onListPageChange}
            />
          )}
        </WhatsAppResourceState>
      )}

      <ConversationDrawer
        conversationId={displayedId}
        detail={displayedId ? getConversation(displayedId) : { kind: "loading" }}
        onRequestClose={() => onSelectConversation(null)}
        onRetry={onRetryConversation}
        templates={templates}
        capabilities={capabilities}
        mutations={mutations}
        currentUserId={currentUserId}
        useStoreAgents={useStoreAgents}
        baseNow={now}
        onOpenOrder={onOpenOrder}
        onDirtyChange={handleDirtyChange}
      />

      <AlertDialog
        open={pendingTarget !== null}
        onOpenChange={(open) => {
          if (open) return;
          if (discardingRef.current) {
            discardingRef.current = false;
            return;
          }
          keepCurrentConversation();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingTarget?.id === null
                ? "¿Cerrar la conversación y descartar lo que escribiste?"
                : "¿Cambiar de conversación y descartar lo que escribiste?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              El texto sin enviar de esta conversación se perderá. No se envió nada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir escribiendo</AlertDialogCancel>
            <AlertDialogAction onClick={discardAndContinue}>Descartar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {autoReplyOpen && (
        <AutoReplyDialog
          settings={autoReply}
          businessName={businessName}
          canPersist={canPersistAutoReply}
          onClose={() => setAutoReplyOpen(false)}
          onSave={onSaveAutoReply}
        />
      )}
    </div>
  );
}
