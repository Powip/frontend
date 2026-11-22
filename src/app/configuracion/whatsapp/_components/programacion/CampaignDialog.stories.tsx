import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ComponentProps } from "react";
import { fn } from "storybook/test";
import {
  campaignsFixture,
  SCHEDULING_FIXTURE_NOW,
  schedulingTemplatesFixture,
  scopeCatalogsFixture,
} from "@/mocks/whatsapp/whatsapp-scheduling.fixtures";
import { CampaignDialog } from "./CampaignDialog";

const defaultArgs: ComponentProps<typeof CampaignDialog> = {
  mode: { kind: "new" },
  templates: { kind: "pending-integration" },
  catalogs: scopeCatalogsFixture,
  canPersist: false,
  getSegmentCount: () => ({ kind: "pending-integration" }),
  now: () => SCHEDULING_FIXTURE_NOW,
  onClose: fn(),
};

const meta = {
  title: "WhatsApp/Programacion/CampaignDialog",
  component: CampaignDialog,
  parameters: { layout: "fullscreen" },
  args: defaultArgs,
} satisfies Meta<typeof CampaignDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NewWithoutBackend: Story = {};

export const NewWithApprovedTemplates: Story = {
  args: {
    templates: { kind: "ready", data: schedulingTemplatesFixture },
    getSegmentCount: () => ({
      kind: "ready",
      data: { matchingToday: 42, computedAt: SCHEDULING_FIXTURE_NOW },
    }),
  },
};

export const EditRecurring: Story = {
  args: {
    mode: { kind: "edit", campaign: campaignsFixture[1] },
    templates: { kind: "ready", data: schedulingTemplatesFixture },
  },
};

export const CountError: Story = {
  args: {
    getSegmentCount: () => ({ kind: "error", message: "No se pudo calcular el segmento." }),
  },
};
