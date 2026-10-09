"use client";

import { useEffect, useMemo, useState } from "react";
import {
  OrderDetailModalProvider,
  useOrderDetailModal,
} from "@/components/orders/OrderDetailModal";
import { useAuth } from "@/contexts/AuthContext";
import { isWhatsAppContractAvailable } from "@/features/whatsapp/constants/whatsapp-contracts";
import type { WhatsAppConversationView } from "@/features/whatsapp/enums/whatsapp.enums";
import { useWhatsAppStoreAgents } from "@/features/whatsapp/hooks/use-whatsapp-store-agents";
import type { WhatsAppConversationFilters } from "@/features/whatsapp/models/conversation.model";
import { resolveConversationCapabilities } from "@/features/whatsapp/utils/conversation-access.util";
import { EMPTY_CONVERSATION_FILTERS } from "@/features/whatsapp/utils/conversation-filters.util";
import {
  DEFAULT_CONVERSATION_VIEW,
  readStoredConversationView,
  writeStoredConversationView,
} from "@/features/whatsapp/utils/conversation-preferences.util";
import { ConversationsView } from "./ConversationsView";

const PENDING = { kind: "pending-integration" } as const;
const NO_MUTATIONS = {};

export const CONVERSATION_THREAD_PARAM = "thread";

interface ConversationsTabProps {
  canManage: boolean;
  businessName: string;
  search: string;
  onNavigate: (search: string) => void;
}

function ConversationsTabContent({
  canManage,
  businessName,
  search,
  onNavigate,
}: ConversationsTabProps) {
  const { auth } = useAuth();
  const { openOrderDetail } = useOrderDetailModal();
  const storesSource = auth?.company?.stores;
  const stores = useMemo(
    () => (storesSource ?? []).map((store) => ({ id: store.id, name: store.name })),
    [storesSource],
  );
  const currentUserId = auth?.user?.id ?? null;
  const [filters, setFilters] = useState<WhatsAppConversationFilters>(EMPTY_CONVERSATION_FILTERS);
  const [view, setView] = useState<WhatsAppConversationView>(DEFAULT_CONVERSATION_VIEW);
  const selectedConversationId = new URLSearchParams(search).get(CONVERSATION_THREAD_PARAM);
  const capabilities = useMemo(() => resolveConversationCapabilities(null), []);

  useEffect(() => {
    const stored = readStoredConversationView();
    if (stored) setView(stored);
  }, []);

  const changeView = (next: WhatsAppConversationView) => {
    setView(next);
    writeStoredConversationView(next);
  };

  const selectConversation = (conversationId: string | null) => {
    const params = new URLSearchParams(search);
    if (conversationId) params.set(CONVERSATION_THREAD_PARAM, conversationId);
    else params.delete(CONVERSATION_THREAD_PARAM);
    onNavigate(params.toString());
  };

  return (
    <ConversationsView
      stores={stores}
      currentUserId={currentUserId}
      businessName={businessName}
      filters={filters}
      onFiltersChange={setFilters}
      view={view}
      onViewChange={changeView}
      board={PENDING}
      list={PENDING}
      selectedConversationId={selectedConversationId}
      onSelectConversation={selectConversation}
      getConversation={() => PENDING}
      templates={PENDING}
      capabilities={capabilities}
      mutations={NO_MUTATIONS}
      useStoreAgents={useWhatsAppStoreAgents}
      autoReply={PENDING}
      canConfigureAutoReply={canManage}
      canPersistAutoReply={isWhatsAppContractAvailable("settings")}
      onOpenOrder={(orderId) => openOrderDetail(orderId, { initialTab: "seguimiento" })}
    />
  );
}

export function ConversationsTab(props: ConversationsTabProps) {
  return (
    <OrderDetailModalProvider>
      <ConversationsTabContent {...props} />
    </OrderDetailModalProvider>
  );
}
