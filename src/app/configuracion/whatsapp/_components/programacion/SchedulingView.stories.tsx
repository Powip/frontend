import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  campaignsFixture,
  failingCatalogsFixture,
  getRulePreviewFixture,
  loadingCatalogsFixture,
  rulesDataFixture,
  SCHEDULING_FIXTURE_NOW,
  schedulingTemplatesFixture,
  scopeCatalogsFixture,
  sendingSettingsFixture,
  skippedNoticesFixture,
  upcomingQueueFixture,
} from "@/mocks/whatsapp/whatsapp-scheduling.fixtures";
import { SchedulingView, type SchedulingViewProps } from "./SchedulingView";

const PENDING = { kind: "pending-integration" } as const;

const defaultArgs: SchedulingViewProps = {
  rules: PENDING,
  templates: PENDING,
  settings: PENDING,
  skipped: PENDING,
  queue: PENDING,
  campaigns: PENDING,
  catalogs: scopeCatalogsFixture,
  canManage: true,
  canPersist: { rules: false, settings: false, campaigns: false },
  businessName: "LIVII Store",
  link: { kind: "none" },
  onDismissLink: fn(),
  getRulePreview: () => PENDING,
  getSegmentCount: () => PENDING,
  onCorrectOrder: fn(),
  now: () => SCHEDULING_FIXTURE_NOW,
};

const meta = {
  title: "WhatsApp/Programacion/SchedulingView",
  component: SchedulingView,
  parameters: { layout: "padded" },
  args: defaultArgs,
} satisfies Meta<typeof SchedulingView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PendingIntegration: Story = {};

const withData: Partial<SchedulingViewProps> = {
  rules: { kind: "ready", data: rulesDataFixture },
  templates: { kind: "ready", data: schedulingTemplatesFixture },
  settings: { kind: "ready", data: sendingSettingsFixture },
  skipped: { kind: "ready", data: skippedNoticesFixture },
  queue: { kind: "ready", data: upcomingQueueFixture },
  campaigns: { kind: "ready", data: campaignsFixture },
  getRulePreview: getRulePreviewFixture,
  getSegmentCount: () => ({
    kind: "ready",
    data: { matchingToday: 42, computedAt: SCHEDULING_FIXTURE_NOW },
  }),
};

export const WithData: Story = { args: withData };

export const LinkFromTemplates: Story = {
  args: {
    ...withData,
    link: { kind: "rule", ruleKey: "pedido_en_camino", templateId: "tpl-camino" },
  },
};

export const LinkWhileRulesPending: Story = {
  args: { link: { kind: "rule", ruleKey: "pedido_en_camino", templateId: "tpl-camino" } },
};

export const LinkWithoutRule: Story = {
  args: { link: { kind: "no-rule-for-template", templateId: "tpl-recompra" } },
};

export const LinkUnknownRule: Story = {
  args: {
    ...withData,
    link: { kind: "unknown-rule", requestedKey: "regla_inexistente", templateId: null },
  },
};

export const CatalogsLoading: Story = { args: { ...withData, catalogs: loadingCatalogsFixture } };

export const CatalogsFailing: Story = { args: { ...withData, catalogs: failingCatalogsFixture } };

export const Loading: Story = {
  args: {
    rules: { kind: "loading" },
    settings: { kind: "loading" },
    skipped: { kind: "loading" },
    queue: { kind: "loading" },
    campaigns: { kind: "loading" },
  },
};

export const Errors: Story = {
  args: {
    rules: { kind: "error", message: "Error 503 del servicio de avisos." },
    settings: { kind: "error", message: "Error 503." },
    skipped: { kind: "error", message: "Error 503." },
    queue: { kind: "error", message: "Error 503." },
    campaigns: { kind: "error", message: "Error 503." },
  },
};

export const Empty: Story = {
  args: {
    rules: {
      kind: "ready",
      data: { rules: [], summary: { activeCount: 0, estimatedMonthly: null } },
    },
    skipped: { kind: "ready", data: [] },
    queue: { kind: "ready", data: { total: 0, groups: [] } },
    campaigns: { kind: "ready", data: [] },
  },
};

export const ReadOnlyForNonAdministrators: Story = { args: { ...withData, canManage: false } };
