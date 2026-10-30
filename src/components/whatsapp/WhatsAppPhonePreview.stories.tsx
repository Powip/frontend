import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  agencyTemplateFixture,
  inTransitTemplateFixture,
  invoiceTemplateFixture,
  templatePreviewValuesFixture,
  unsafeTemplateFixture,
} from "@/mocks/whatsapp/whatsapp-template.fixtures";
import { WhatsAppPhonePreview } from "./WhatsAppPhonePreview";

const meta = {
  title: "WhatsApp/WhatsAppPhonePreview",
  component: WhatsAppPhonePreview,
  parameters: { layout: "padded" },
  args: {
    businessName: "LIVII Store",
    body: inTransitTemplateFixture.body,
    values: templatePreviewValuesFixture,
    header: { type: "text", text: inTransitTemplateFixture.header },
    footer: inTransitTemplateFixture.footer,
    buttonText: inTransitTemplateFixture.buttonText,
    timeLabel: "10:02",
  },
} satisfies Meta<typeof WhatsAppPhonePreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InTransit: Story = {};

export const MissingVariableValue: Story = {
  args: {
    body: agencyTemplateFixture.body,
    header: null,
    buttonText: agencyTemplateFixture.buttonText,
    values: { ...templatePreviewValuesFixture, agencia: null },
  },
};

export const WithoutRealOrder: Story = {
  args: { values: {} },
};

export const DocumentHeader: Story = {
  args: {
    body: invoiceTemplateFixture.body,
    header: { type: "document", fileName: "B001-000482.pdf" },
    buttonText: invoiceTemplateFixture.buttonText,
  },
};

export const WithQuickReply: Story = {
  args: { quickReplyText: "Tengo una consulta" },
};

export const UserHtmlIsNotInterpreted: Story = {
  args: {
    body: unsafeTemplateFixture.body,
    header: null,
    footer: null,
  },
};

export const EmptyBody: Story = {
  args: { body: "", header: null, footer: null, buttonText: null },
};
