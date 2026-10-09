import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { DEFAULT_HISTORY_PERIOD } from "@/features/whatsapp/constants/whatsapp-settings-catalog";
import { WHATSAPP_PERMISSION_CODES } from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppHistoryFilters } from "@/features/whatsapp/models/history.model";
import { resolveEffectivePermissions } from "@/features/whatsapp/utils/whatsapp-permissions.util";
import {
  HISTORY_FIXTURE_NOW,
  historyEmptyPageFixture,
  historyMetricsFixture,
  historyMetricsPartialFixture,
  historyMetricsZeroFixture,
  historyPageFixture,
} from "@/mocks/whatsapp/whatsapp-history.fixtures";
import { settingsStoresFixture } from "@/mocks/whatsapp/whatsapp-settings.fixtures";
import { HistoryView, type HistoryViewProps } from "./HistoryView";

const PENDING = { kind: "pending-integration" } as const;

const defaultArgs: HistoryViewProps = {
  stores: settingsStoresFixture,
  filters: { period: DEFAULT_HISTORY_PERIOD, status: "all", search: "", storeId: null },
  onFiltersChange: fn(),
  now: HISTORY_FIXTURE_NOW,
  metrics: PENDING,
  page: PENDING,
  effectivePermissions: resolveEffectivePermissions(null),
  exportPermission: null,
  onOpenOrder: fn(),
};

function StatefulHistory(props: HistoryViewProps) {
  const [filters, setFilters] = useState<WhatsAppHistoryFilters>(props.filters);
  return (
    <HistoryView
      {...props}
      filters={filters}
      onFiltersChange={(next) => {
        setFilters(next);
        props.onFiltersChange(next);
      }}
    />
  );
}

const meta = {
  title: "WhatsApp/Historial/HistoryView",
  component: HistoryView,
  parameters: { layout: "padded" },
  args: defaultArgs,
  render: (args) => <StatefulHistory {...args} />,
} satisfies Meta<typeof HistoryView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PendingIntegration: Story = {};

const withData: Partial<HistoryViewProps> = {
  metrics: { kind: "ready", data: historyMetricsFixture },
  page: { kind: "ready", data: historyPageFixture },
};

export const WithData: Story = { args: withData };

export const RealZeros: Story = {
  args: {
    metrics: { kind: "ready", data: historyMetricsZeroFixture },
    page: { kind: "ready", data: historyEmptyPageFixture },
  },
};

export const PartialMetrics: Story = {
  args: { ...withData, metrics: { kind: "ready", data: historyMetricsPartialFixture } },
};

export const Loading: Story = { args: { metrics: { kind: "loading" }, page: { kind: "loading" } } };

export const LoadError: Story = {
  args: {
    metrics: { kind: "error", message: "El servicio no respondió." },
    page: { kind: "error", message: "El servicio no respondió." },
    onRetry: fn(),
  },
};

export const Forbidden: Story = {
  args: { metrics: { kind: "forbidden" }, page: { kind: "forbidden" } },
};

export const NoMatches: Story = {
  args: {
    metrics: { kind: "ready", data: historyMetricsFixture },
    page: { kind: "ready", data: historyEmptyPageFixture },
    filters: { period: "today", status: "not_sent", search: "ORD-000", storeId: null },
  },
};

export const ResendAndExportFailing: Story = {
  args: {
    ...withData,
    effectivePermissions: resolveEffectivePermissions([WHATSAPP_PERMISSION_CODES.REPLY]),
    exportPermission: true,
    onPageChange: fn(),
    onResend: () => Promise.reject(new Error("El número sigue sin WhatsApp.")),
    onExport: () => Promise.reject(new Error("No se pudo generar el archivo.")),
  },
};
