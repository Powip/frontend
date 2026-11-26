import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  getRulePreviewFixture,
  rulesFixture,
  SCHEDULING_FIXTURE_NOW,
} from "@/mocks/whatsapp/whatsapp-scheduling.fixtures";
import { ActivateRuleDialog } from "./ActivateRuleDialog";

const inTransitRule = rulesFixture[1];

const meta = {
  title: "WhatsApp/Programacion/ActivateRuleDialog",
  component: ActivateRuleDialog,
  parameters: { layout: "fullscreen" },
  args: {
    request: {
      rule: inTransitRule,
      mode: "activate",
      hasUnsavedChanges: false,
      scopeSummary:
        "Todas las tiendas · Todos los canales · Pedidos desde que se activa · máx. 15 días",
    },
    preview: { kind: "pending-integration" },
    canPersist: false,
    onClose: fn(),
  },
} satisfies Meta<typeof ActivateRuleDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PendingIntegration: Story = {};

export const Loading: Story = { args: { preview: { kind: "loading" } } };

export const ErrorState: Story = {
  args: { preview: { kind: "error", message: "El servicio no pudo calcular el conteo." } },
};

export const NoMatchingOrders: Story = {
  args: {
    preview: {
      kind: "ready",
      data: {
        matchingOrders: 0,
        orderStateLabel: "En envío",
        estimatedCost: null,
        computedAt: SCHEDULING_FIXTURE_NOW,
      },
    },
  },
};

export const WithMatchingOrders: Story = {
  args: { preview: getRulePreviewFixture(inTransitRule) },
};

export const UnsavedChanges: Story = {
  args: {
    preview: getRulePreviewFixture(inTransitRule),
    request: {
      rule: inTransitRule,
      mode: "activate",
      hasUnsavedChanges: true,
      scopeSummary: "LIVII · Todos los canales · Pedidos desde que se activa · máx. 15 días",
    },
  },
};

export const CountOnly: Story = {
  args: {
    preview: getRulePreviewFixture(inTransitRule),
    request: {
      rule: inTransitRule,
      mode: "count",
      hasUnsavedChanges: false,
      scopeSummary: "Todas las tiendas · Pedidos desde que se activa · máx. 15 días",
    },
  },
};
