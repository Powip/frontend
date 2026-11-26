import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WhatsAppIcon } from "@/components/shared/WhatsAppIcon";
import { Button } from "@/components/ui/button";
import { parseWhatsAppLastNotice } from "@/features/whatsapp/utils/last-notice.util";
import { lastNoticeDtoFixtures } from "@/mocks/whatsapp/whatsapp-integrations.fixtures";
import { WhatsAppLastNoticeIndicator } from "./WhatsAppLastNoticeIndicator";

function ButtonWithIndicator({ raw }: { raw: unknown }) {
  return (
    <Button
      size="icon"
      variant="outline"
      className="relative bg-green-500 text-white hover:bg-green-600 border-green-600"
      title="WhatsApp"
    >
      <WhatsAppIcon className="h-4 w-4" />
      <WhatsAppLastNoticeIndicator notice={parseWhatsAppLastNotice(raw)} />
    </Button>
  );
}

const meta = {
  title: "WhatsApp/Integraciones/WhatsAppLastNoticeIndicator",
  component: ButtonWithIndicator,
  parameters: { layout: "centered" },
  args: { raw: undefined },
} satisfies Meta<typeof ButtonWithIndicator>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithoutData: Story = {};
export const Read: Story = { args: { raw: lastNoticeDtoFixtures.read } };
export const Delivered: Story = { args: { raw: lastNoticeDtoFixtures.delivered } };
export const NotSent: Story = { args: { raw: lastNoticeDtoFixtures.failed } };
export const Assisted: Story = { args: { raw: lastNoticeDtoFixtures.assisted } };
export const InvalidData: Story = { args: { raw: lastNoticeDtoFixtures.invalidStatus } };
