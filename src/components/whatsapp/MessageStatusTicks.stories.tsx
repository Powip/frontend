import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WHATSAPP_MESSAGE_STATUSES } from "@/features/whatsapp/enums/whatsapp.enums";
import { MessageStatusTicks } from "./MessageStatusTicks";

const meta = {
  title: "WhatsApp/MessageStatusTicks",
  component: MessageStatusTicks,
  args: {
    status: WHATSAPP_MESSAGE_STATUSES.READ,
    showLabel: true,
    showDetail: false,
  },
  argTypes: {
    status: { control: "select", options: Object.values(WHATSAPP_MESSAGE_STATUSES) },
  },
} satisfies Meta<typeof MessageStatusTicks>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Read: Story = {};

export const IconOnly: Story = {
  args: { showLabel: false },
};

export const AllStatuses: Story = {
  render: () => (
    <ul className="flex flex-col gap-2">
      {Object.values(WHATSAPP_MESSAGE_STATUSES).map((status) => (
        <li key={status}>
          <MessageStatusTicks status={status} showDetail />
        </li>
      ))}
    </ul>
  ),
};
