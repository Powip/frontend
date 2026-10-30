import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { templatesListFixture } from "@/mocks/whatsapp/whatsapp-templates.fixtures";
import { TemplatesListView } from "./TemplatesListView";

const meta = {
  title: "WhatsApp/Plantillas/TemplatesListView",
  component: TemplatesListView,
  parameters: { layout: "padded" },
  args: {
    state: { kind: "pending-integration" },
    canManage: true,
    onCreate: fn(),
    onEdit: fn(),
    onDuplicate: fn(),
    onRetry: fn(),
  },
} satisfies Meta<typeof TemplatesListView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PendingIntegration: Story = {};

export const Loading: Story = { args: { state: { kind: "loading" } } };

export const ErrorWithRetry: Story = {
  args: { state: { kind: "error", message: "El servicio de plantillas respondió con un error." } },
};

export const Empty: Story = { args: { state: { kind: "ready", data: [] } } };

export const AllMetaStatuses: Story = {
  args: { state: { kind: "ready", data: templatesListFixture } },
};

export const ReadOnlyForNonAdministrators: Story = {
  args: { state: { kind: "ready", data: templatesListFixture }, canManage: false },
};

export const WithApprovalNotice: Story = {
  args: {
    state: { kind: "ready", data: templatesListFixture },
    approvedNotice: {
      templateName: "saldo_pendiente",
      canActivateRule: true,
      onActivateRule: fn(),
      onDismiss: fn(),
    },
  },
};
