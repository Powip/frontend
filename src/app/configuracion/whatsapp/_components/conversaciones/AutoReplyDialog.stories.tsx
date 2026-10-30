import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { autoReplySettingsFixture } from "@/mocks/whatsapp/whatsapp-conversation.fixtures";
import { AutoReplyDialog } from "./AutoReplyDialog";

const meta = {
  title: "WhatsApp/Conversaciones/AutoReplyDialog",
  component: AutoReplyDialog,
  args: {
    settings: { kind: "pending-integration" },
    businessName: "LIVII Store",
    canPersist: false,
    onClose: fn(),
  },
} satisfies Meta<typeof AutoReplyDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SuggestedWhilePending: Story = {};

export const NotConfiguredYet: Story = { args: { settings: { kind: "ready", data: null } } };

export const Saved: Story = {
  args: { settings: { kind: "ready", data: autoReplySettingsFixture } },
};

export const Loading: Story = { args: { settings: { kind: "loading" } } };

export const LoadError: Story = {
  args: { settings: { kind: "error", message: "El servicio no respondió." }, onRetry: fn() },
};
