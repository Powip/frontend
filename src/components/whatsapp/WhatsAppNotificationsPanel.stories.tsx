import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  INTEGRATIONS_FIXTURE_NOW,
  notificationsFeedFixture,
} from "@/mocks/whatsapp/whatsapp-integrations.fixtures";
import {
  WhatsAppNotificationsButton,
  WhatsAppNotificationsList,
} from "./WhatsAppNotificationsPanel";

const meta = {
  title: "WhatsApp/Integraciones/WhatsAppNotifications",
  component: WhatsAppNotificationsList,
  parameters: { layout: "padded" },
  args: { feed: { kind: "pending-integration" }, now: INTEGRATIONS_FIXTURE_NOW },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WhatsAppNotificationsList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PendingIntegration: Story = {};
export const Loading: Story = { args: { feed: { kind: "loading" } } };
export const LoadError: Story = {
  args: { feed: { kind: "error", message: "El servicio no respondió." }, onRetry: fn() },
};
export const Empty: Story = {
  args: { feed: { kind: "ready", data: { items: [], unreadTotal: 0 } } },
};
export const WithAlerts: Story = {
  args: { feed: { kind: "ready", data: notificationsFeedFixture } },
};
export const BellButtonFuture: Story = {
  args: { feed: { kind: "ready", data: notificationsFeedFixture } },
  render: (args) => <WhatsAppNotificationsButton {...args} />,
};
