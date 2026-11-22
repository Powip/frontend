import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { resolveEffectivePermissions } from "@/features/whatsapp/utils/whatsapp-permissions.util";
import {
  accountsFixture,
  assistedQueueFixture,
  CONNECTION_FIXTURE_NOW,
  connectedStatusFixture,
  connectionStoresFixture,
  contingencyFixture,
  liviiAccountFixture,
  notConnectedStatusFixture,
  partialAccountFixture,
  pricingFixture,
  redQualityAccountFixture,
  stalePricingFixture,
  testRunFixtures,
  unknownStatusFixture,
  unknownUsageFixture,
  usageFixture,
} from "@/mocks/whatsapp/whatsapp-connection.fixtures";
import { conversationAgentsFixture } from "@/mocks/whatsapp/whatsapp-conversation.fixtures";
import { schedulingTemplatesFixture } from "@/mocks/whatsapp/whatsapp-scheduling.fixtures";
import { ConnectionView, type ConnectionViewProps } from "./ConnectionView";

const PENDING = { kind: "pending-integration" } as const;

const defaultArgs: ConnectionViewProps = {
  stores: connectionStoresFixture,
  storeId: "store-livii",
  onStoreChange: fn(),
  now: CONNECTION_FIXTURE_NOW,
  canManage: true,
  effectivePermissions: resolveEffectivePermissions(null),
  status: PENDING,
  account: PENDING,
  accounts: PENDING,
  templates: PENDING,
  testRun: null,
  contingency: PENDING,
  agents: PENDING,
  assistedQueue: PENDING,
  pricing: PENDING,
  usage: PENDING,
  signupAvailable: false,
  mutations: {},
};

function StatefulConnection(props: ConnectionViewProps) {
  const [storeId, setStoreId] = useState(props.storeId);
  return (
    <ConnectionView
      {...props}
      storeId={storeId}
      onStoreChange={(next) => {
        setStoreId(next);
        props.onStoreChange(next);
      }}
    />
  );
}

const meta = {
  title: "WhatsApp/Conexion/ConnectionView",
  component: ConnectionView,
  parameters: { layout: "padded" },
  args: defaultArgs,
  render: (args) => <StatefulConnection {...args} />,
} satisfies Meta<typeof ConnectionView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PendingIntegration: Story = {};

const connected: Partial<ConnectionViewProps> = {
  status: { kind: "ready", data: connectedStatusFixture },
  account: { kind: "ready", data: liviiAccountFixture },
  accounts: { kind: "ready", data: accountsFixture },
  templates: { kind: "ready", data: schedulingTemplatesFixture },
  contingency: { kind: "ready", data: contingencyFixture },
  agents: { kind: "ready", data: conversationAgentsFixture },
  assistedQueue: { kind: "ready", data: assistedQueueFixture },
  pricing: { kind: "ready", data: pricingFixture },
  usage: { kind: "ready", data: usageFixture },
};

export const Connected: Story = { args: connected };

export const PartialMetaData: Story = {
  args: {
    ...connected,
    status: { kind: "ready", data: unknownStatusFixture },
    account: { kind: "ready", data: partialAccountFixture },
    pricing: { kind: "ready", data: stalePricingFixture },
    usage: { kind: "ready", data: unknownUsageFixture },
  },
};

export const RedQualityAndLimitReached: Story = {
  args: { ...connected, account: { kind: "ready", data: redQualityAccountFixture } },
};

export const StoreWithoutNumber: Story = {
  args: {
    ...connected,
    storeId: "store-kunca",
    status: { kind: "ready", data: notConnectedStatusFixture },
    account: { kind: "ready", data: null },
    contingency: { kind: "ready", data: null },
    assistedQueue: { kind: "ready", data: { items: [], pendingTotal: 0, hasMore: false } },
  },
};

export const Loading: Story = {
  args: {
    status: { kind: "loading" },
    account: { kind: "loading" },
    accounts: { kind: "loading" },
    templates: { kind: "loading" },
    contingency: { kind: "loading" },
    assistedQueue: { kind: "loading" },
    pricing: { kind: "loading" },
    usage: { kind: "loading" },
  },
};

export const LoadErrors: Story = {
  args: {
    status: { kind: "error", message: "El servicio no respondió." },
    account: { kind: "error", message: "El servicio no respondió." },
    accounts: { kind: "error", message: "El servicio no respondió." },
    contingency: { kind: "error", message: "El servicio no respondió." },
    assistedQueue: { kind: "forbidden" },
    pricing: { kind: "error", message: "El servicio no respondió." },
    usage: { kind: "error", message: "El servicio no respondió." },
    onRetry: fn(),
  },
};

export const TestWaitingForDelivery: Story = {
  args: { ...connected, testRun: testRunFixtures.queued },
};

export const TestDeliveredWithoutRead: Story = {
  args: { ...connected, testRun: testRunFixtures.deliveredWithoutRead },
};

export const TestRead: Story = { args: { ...connected, testRun: testRunFixtures.read } };

export const TestFailed: Story = { args: { ...connected, testRun: testRunFixtures.failed } };

export const SignupBlocked: Story = {
  args: { ...connected, initialSignup: { storeId: "store-kunca", phase: { kind: "intro" } } },
};

export const SignupWaitingForMeta: Story = {
  args: {
    ...connected,
    signupAvailable: true,
    effectivePermissions: resolveEffectivePermissions(["WA_CONNECTION"]),
    mutations: { startSignup: () => new Promise<void>(() => undefined) },
    initialSignup: { storeId: "store-kunca", phase: { kind: "waiting" } },
  },
};

export const SignupFailed: Story = {
  args: {
    ...connected,
    signupAvailable: true,
    effectivePermissions: resolveEffectivePermissions(["WA_CONNECTION"]),
    mutations: {
      startSignup: () => Promise.reject(new Error("Ese número ya está conectado a otra tienda.")),
    },
    initialSignup: {
      storeId: "store-kunca",
      phase: {
        kind: "error",
        message: "Cerraste la ventana de Meta antes de terminar. No se conectó ningún número.",
      },
    },
  },
};

export const SignupConfirmedByPowip: Story = {
  args: { ...connected, initialSignup: { storeId: "store-kunca", phase: { kind: "success" } } },
};
