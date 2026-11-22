import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { TemplateApprovedBanner } from "./TemplateApprovedBanner";

const meta = {
  title: "WhatsApp/Plantillas/TemplateApprovedBanner",
  component: TemplateApprovedBanner,
  parameters: { layout: "padded" },
  args: {
    templateName: "saldo_pendiente",
    canActivateRule: true,
    onActivateRule: fn(),
    onDismiss: fn(),
  },
} satisfies Meta<typeof TemplateApprovedBanner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CanActivateRule: Story = {};

export const WithoutRulePermission: Story = { args: { canActivateRule: false } };
