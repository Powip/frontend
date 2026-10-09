import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  abWithWinnerTemplateFixture,
  approvedTemplateFixture,
  draftTemplateFixture,
  invoiceTemplateWithDocumentFixture,
  pausedTemplateFixture,
  pendingWithApprovedVersionTemplateFixture,
  rejectedTemplateFixture,
} from "@/mocks/whatsapp/whatsapp-templates.fixtures";
import { TemplateEditorDialog } from "./TemplateEditorDialog";

const meta = {
  title: "WhatsApp/Plantillas/TemplateEditorDialog",
  component: TemplateEditorDialog,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    mode: { kind: "new" },
    businessName: "LIVII Store",
    canManage: true,
    canPersist: false,
    onClose: fn(),
  },
} satisfies Meta<typeof TemplateEditorDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NewTemplate: Story = {};

export const EditApproved: Story = {
  args: { mode: { kind: "edit", template: approvedTemplateFixture } },
};

export const EditAbTest: Story = {
  args: { mode: { kind: "edit", template: abWithWinnerTemplateFixture } },
};

export const InReviewWithApprovedVersion: Story = {
  args: { mode: { kind: "edit", template: pendingWithApprovedVersionTemplateFixture } },
};

export const Rejected: Story = {
  args: { mode: { kind: "edit", template: rejectedTemplateFixture } },
};

export const Paused: Story = {
  args: { mode: { kind: "edit", template: pausedTemplateFixture } },
};

export const Draft: Story = {
  args: { mode: { kind: "edit", template: draftTemplateFixture } },
};

export const InvoiceWithDocumentHeader: Story = {
  args: { mode: { kind: "edit", template: invoiceTemplateWithDocumentFixture } },
};

export const Duplicate: Story = {
  args: { mode: { kind: "duplicate", template: approvedTemplateFixture } },
};

export const ReadOnlyForNonAdministrators: Story = {
  args: { mode: { kind: "edit", template: approvedTemplateFixture }, canManage: false },
};
