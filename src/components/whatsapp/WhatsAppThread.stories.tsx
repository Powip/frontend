import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { conversationDetailsFixture } from "@/mocks/whatsapp/whatsapp-conversation.fixtures";
import {
  agentAndNotesFixture,
  deliveredWithEvidenceFixture,
  notSentFixture,
  repliedConversationFixture,
  WHATSAPP_FIXTURE_NOW,
} from "@/mocks/whatsapp/whatsapp-message.fixtures";
import { WhatsAppThread } from "./WhatsAppThread";

const meta = {
  title: "WhatsApp/WhatsAppThread",
  component: WhatsAppThread,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
  args: {
    messages: repliedConversationFixture,
    now: WHATSAPP_FIXTURE_NOW,
  },
} satisfies Meta<typeof WhatsAppThread>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CustomerReplied: Story = {};

export const DeliveredWithEvidenceAndInvoice: Story = {
  args: { messages: deliveredWithEvidenceFixture },
};

export const AgentReplyNotesAndAppEcho: Story = {
  args: { messages: agentAndNotesFixture },
};

export const FailedSkippedAssistedQueued: Story = {
  args: { messages: notSentFixture },
};

export const Empty: Story = {
  args: { messages: [] },
};

export const DispatchAndDeliveryEvidence: Story = {
  args: { messages: conversationDetailsFixture["cv-jorge"].messages },
};

export const InboundMedia: Story = {
  args: { messages: conversationDetailsFixture["cv-lucia"].messages },
};

export const LongTexts: Story = {
  args: { messages: conversationDetailsFixture["cv-larga"].messages },
};
