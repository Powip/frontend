import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  INTEGRATIONS_FIXTURE_NOW,
  orderThreadsFixture,
} from "@/mocks/whatsapp/whatsapp-integrations.fixtures";
import { OrderWhatsAppMessagesView } from "./OrderWhatsAppMessages";

const meta = {
  title: "WhatsApp/Integraciones/OrderWhatsAppMessages",
  component: OrderWhatsAppMessagesView,
  parameters: { layout: "padded" },
  args: { threads: { kind: "pending-integration" }, now: INTEGRATIONS_FIXTURE_NOW },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OrderWhatsAppMessagesView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PendingIntegration: Story = {};
export const Loading: Story = { args: { threads: { kind: "loading" } } };
export const LoadError: Story = {
  args: { threads: { kind: "error", message: "El servicio no respondió." }, onRetry: fn() },
};
export const Empty: Story = { args: { threads: { kind: "ready", data: [] } } };
export const WithThreadsAndEvidence: Story = {
  args: { threads: { kind: "ready", data: orderThreadsFixture } },
};
