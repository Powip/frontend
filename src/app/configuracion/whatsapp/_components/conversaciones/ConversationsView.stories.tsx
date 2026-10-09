import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import type { WhatsAppConversationView } from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppConversationFilters } from "@/features/whatsapp/models/conversation.model";
import { EMPTY_CONVERSATION_FILTERS } from "@/features/whatsapp/utils/conversation-filters.util";
import {
  agentCapabilitiesFixture,
  autoReplySettingsFixture,
  CONVERSATION_FIXTURE_NOW,
  CONVERSATION_FIXTURE_USER_ID,
  conversationAgentsFixture,
  conversationBoardFixture,
  conversationBoardWithoutTotalsFixture,
  conversationListFixture,
  conversationStoresFixture,
  conversationTemplatesFixture,
  emptyConversationBoardFixture,
  fullCapabilitiesFixture,
  getConversationFixture,
  readOnlyCapabilitiesFixture,
} from "@/mocks/whatsapp/whatsapp-conversation.fixtures";
import { ConversationsView, type ConversationsViewProps } from "./ConversationsView";

const PENDING = { kind: "pending-integration" } as const;

const defaultArgs: ConversationsViewProps = {
  stores: conversationStoresFixture,
  currentUserId: CONVERSATION_FIXTURE_USER_ID,
  businessName: "LIVII Store",
  filters: EMPTY_CONVERSATION_FILTERS,
  onFiltersChange: fn(),
  view: "board",
  onViewChange: fn(),
  board: PENDING,
  list: PENDING,
  selectedConversationId: null,
  onSelectConversation: fn(),
  getConversation: () => PENDING,
  templates: PENDING,
  capabilities: { view: false, reply: false, reassign: false, manageOptOuts: false },
  mutations: {},
  useStoreAgents: () => ({ kind: "ready", data: [] }),
  autoReply: PENDING,
  canConfigureAutoReply: true,
  canPersistAutoReply: false,
  onOpenOrder: fn(),
  now: CONVERSATION_FIXTURE_NOW,
};

function StatefulConversations(props: ConversationsViewProps) {
  const [filters, setFilters] = useState<WhatsAppConversationFilters>(props.filters);
  const [view, setView] = useState<WhatsAppConversationView>(props.view);
  const [selected, setSelected] = useState<string | null>(props.selectedConversationId);
  return (
    <ConversationsView
      {...props}
      filters={filters}
      onFiltersChange={(next) => {
        setFilters(next);
        props.onFiltersChange(next);
      }}
      view={view}
      onViewChange={(next) => {
        setView(next);
        props.onViewChange(next);
      }}
      selectedConversationId={selected}
      onSelectConversation={(id) => {
        setSelected(id);
        props.onSelectConversation(id);
      }}
    />
  );
}

const meta = {
  title: "WhatsApp/Conversaciones/ConversationsView",
  component: ConversationsView,
  parameters: { layout: "padded" },
  args: defaultArgs,
  render: (args) => <StatefulConversations {...args} />,
} satisfies Meta<typeof ConversationsView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PendingIntegration: Story = {};

const withData: Partial<ConversationsViewProps> = {
  board: { kind: "ready", data: conversationBoardFixture },
  list: { kind: "ready", data: conversationListFixture },
  getConversation: getConversationFixture,
  templates: { kind: "ready", data: conversationTemplatesFixture },
  capabilities: agentCapabilitiesFixture,
  autoReply: { kind: "ready", data: autoReplySettingsFixture },
};

export const Board: Story = { args: withData };

export const BoardWithoutGlobalTotals: Story = {
  args: { ...withData, board: { kind: "ready", data: conversationBoardWithoutTotalsFixture } },
};

export const List: Story = { args: { ...withData, view: "list" } };

export const Loading: Story = { args: { board: { kind: "loading" }, list: { kind: "loading" } } };

export const LoadError: Story = {
  args: {
    board: { kind: "error", message: "El servicio no respondió." },
    onRetryList: fn(),
  },
};

export const Forbidden: Story = { args: { board: { kind: "forbidden" } } };

export const Empty: Story = {
  args: { board: { kind: "ready", data: emptyConversationBoardFixture } },
};

export const NoMatches: Story = {
  args: {
    board: { kind: "ready", data: emptyConversationBoardFixture },
    filters: { search: "ORD-000", storeId: "store-kunca", assignedToMe: true },
  },
};

export const RepliedWithOpenWindow: Story = {
  args: {
    ...withData,
    capabilities: fullCapabilitiesFixture,
    selectedConversationId: "cv-lucia",
    useStoreAgents: () => ({ kind: "ready", data: conversationAgentsFixture }),
  },
};

export const WindowAboutToClose: Story = {
  args: { ...withData, selectedConversationId: "cv-kevin" },
};

export const AttendedWithClosedWindow: Story = {
  args: { ...withData, selectedConversationId: "cv-diego" },
};

export const UnknownWindow: Story = {
  args: { ...withData, selectedConversationId: "cv-sofia" },
};

export const FailedNotice: Story = {
  args: { ...withData, selectedConversationId: "cv-alexandra" },
};

export const SkippedWithoutOrder: Story = {
  args: { ...withData, selectedConversationId: "cv-luis" },
};

export const Assisted: Story = {
  args: { ...withData, selectedConversationId: "cv-rosa" },
};

export const OptedOut: Story = {
  args: { ...withData, selectedConversationId: "cv-pedro" },
};

export const WithEvidence: Story = {
  args: { ...withData, selectedConversationId: "cv-jorge" },
};

export const LongTexts: Story = {
  args: { ...withData, selectedConversationId: "cv-larga" },
};

export const WithoutReplyPermission: Story = {
  args: {
    ...withData,
    capabilities: readOnlyCapabilitiesFixture,
    selectedConversationId: "cv-lucia",
  },
};

export const ConversationLoading: Story = {
  args: { ...withData, selectedConversationId: "cv-cargando" },
};

export const ConversationError: Story = {
  args: { ...withData, selectedConversationId: "cv-no-existe", onRetryConversation: fn() },
};

export const SendingInProgress: Story = {
  args: {
    ...withData,
    selectedConversationId: "cv-lucia",
    mutations: { sendReply: () => new Promise<void>(() => undefined) },
  },
};

export const SendFailedKeepsText: Story = {
  args: {
    ...withData,
    selectedConversationId: "cv-lucia",
    mutations: {
      sendReply: () => Promise.reject(new Error("La ventana de 24 h se cerró antes de enviar.")),
    },
  },
};
