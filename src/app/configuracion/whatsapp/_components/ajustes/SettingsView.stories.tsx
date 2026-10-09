import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import type { WhatsAppAuditFilters } from "@/features/whatsapp/models/settings-tab.model";
import { resolveEffectivePermissions } from "@/features/whatsapp/utils/whatsapp-permissions.util";
import {
  alertSettingsFixture,
  auditPageFixture,
  auditWithoutUsersFixture,
  emptyAuditPageFixture,
  emptyOptOutsPageFixture,
  mixedEffectivePermissionsFixture,
  optOutsPageFixture,
  permissionSettingsFixture,
  protectionSettingsFixture,
  recentAlertsFixture,
  SETTINGS_FIXTURE_NOW,
  settingsStoresFixture,
} from "@/mocks/whatsapp/whatsapp-settings.fixtures";
import { SettingsView, type SettingsViewProps } from "./SettingsView";

const PENDING = { kind: "pending-integration" } as const;

const defaultArgs: SettingsViewProps = {
  stores: settingsStoresFixture,
  storeContext: settingsStoresFixture[0],
  now: SETTINGS_FIXTURE_NOW,
  canManage: true,
  effectivePermissions: resolveEffectivePermissions(null),
  protection: PENDING,
  optOuts: PENDING,
  optOutSearch: "",
  onOptOutSearchChange: fn(),
  alertSettings: PENDING,
  recentAlerts: PENDING,
  audit: PENDING,
  auditFilters: { entity: null, userId: null },
  onAuditFiltersChange: fn(),
  permissionMatrix: PENDING,
  mutations: {},
  onOpenTab: fn(),
};

function StatefulSettings(props: SettingsViewProps) {
  const [search, setSearch] = useState(props.optOutSearch);
  const [auditFilters, setAuditFilters] = useState<WhatsAppAuditFilters>(props.auditFilters);
  return (
    <SettingsView
      {...props}
      optOutSearch={search}
      onOptOutSearchChange={setSearch}
      auditFilters={auditFilters}
      onAuditFiltersChange={setAuditFilters}
    />
  );
}

const meta = {
  title: "WhatsApp/Ajustes/SettingsView",
  component: SettingsView,
  parameters: { layout: "padded" },
  args: defaultArgs,
  render: (args) => <StatefulSettings {...args} />,
} satisfies Meta<typeof SettingsView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PendingIntegration: Story = {};

const withData: Partial<SettingsViewProps> = {
  protection: { kind: "ready", data: protectionSettingsFixture },
  optOuts: { kind: "ready", data: optOutsPageFixture },
  alertSettings: { kind: "ready", data: alertSettingsFixture },
  recentAlerts: { kind: "ready", data: recentAlertsFixture },
  audit: { kind: "ready", data: auditPageFixture },
  permissionMatrix: { kind: "ready", data: permissionSettingsFixture },
  effectivePermissions: mixedEffectivePermissionsFixture,
};

export const WithData: Story = { args: withData };

export const NotConfiguredYet: Story = {
  args: {
    ...withData,
    protection: { kind: "ready", data: null },
    alertSettings: { kind: "ready", data: null },
  },
};

export const Empty: Story = {
  args: {
    ...withData,
    optOuts: { kind: "ready", data: emptyOptOutsPageFixture },
    recentAlerts: { kind: "ready", data: [] },
    audit: { kind: "ready", data: emptyAuditPageFixture },
  },
};

export const AuditWithoutUserFilter: Story = {
  args: { ...withData, audit: { kind: "ready", data: auditWithoutUsersFixture } },
};

export const Loading: Story = {
  args: {
    protection: { kind: "loading" },
    optOuts: { kind: "loading" },
    alertSettings: { kind: "loading" },
    recentAlerts: { kind: "loading" },
    audit: { kind: "loading" },
    permissionMatrix: { kind: "loading" },
  },
};

export const LoadErrors: Story = {
  args: {
    protection: { kind: "error", message: "El servicio no respondió." },
    optOuts: { kind: "error", message: "El servicio no respondió." },
    alertSettings: { kind: "error", message: "El servicio no respondió." },
    recentAlerts: { kind: "error", message: "El servicio no respondió." },
    audit: { kind: "forbidden" },
    permissionMatrix: { kind: "forbidden" },
    onRetry: fn(),
  },
};

export const ReadOnly: Story = { args: { ...withData, canManage: false } };

export const SaveFails: Story = {
  args: {
    ...withData,
    effectivePermissions: resolveEffectivePermissions(["WA_OPTOUTS", "WA_RULES"]),
    mutations: {
      saveProtection: () => Promise.reject(new Error("La configuración cambió en otra sesión.")),
      addOptOut: () => Promise.reject(new Error("Ese número ya estaba dado de baja.")),
    },
  },
};
