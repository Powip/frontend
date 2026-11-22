import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { type ReactNode, useState } from "react";
import { WaDot } from "@/components/whatsapp/ui/WaPill";
import { WHATSAPP_TABS, type WhatsAppTab } from "@/features/whatsapp/enums/whatsapp.enums";
import { SettingsView } from "./ajustes/SettingsView";
import ajustesMeta, * as ajustes from "./ajustes/SettingsView.stories";
import { ConnectionView } from "./conexion/ConnectionView";
import conexionMeta, * as conexion from "./conexion/ConnectionView.stories";
import { ConversationsView } from "./conversaciones/ConversationsView";
import conversacionesMeta, * as conversaciones from "./conversaciones/ConversationsView.stories";
import { HistoryView } from "./historial/HistoryView";
import historialMeta, * as historial from "./historial/HistoryView.stories";
import { TemplatesListView } from "./plantillas/TemplatesListView";
import plantillasMeta, * as plantillas from "./plantillas/TemplatesListView.stories";
import { SchedulingView } from "./programacion/SchedulingView";
import programacionMeta, * as programacion from "./programacion/SchedulingView.stories";
import {
  WhatsAppPageFrame,
  WhatsAppPageHeader,
  WhatsAppPendingStatusPill,
  WhatsAppTabsShell,
} from "./WhatsAppPageLayout";

type Variant = "pending" | "data";

function panels(variant: Variant): Record<WhatsAppTab, ReactNode> {
  const data = variant === "data";
  return {
    [WHATSAPP_TABS.CONNECTION]: (
      <ConnectionView
        {...conexionMeta.args}
        {...(data ? conexion.Connected.args : conexion.PendingIntegration.args)}
      />
    ),
    [WHATSAPP_TABS.TEMPLATES]: (
      <TemplatesListView
        {...plantillasMeta.args}
        {...(data ? plantillas.AllMetaStatuses.args : plantillas.PendingIntegration.args)}
      />
    ),
    [WHATSAPP_TABS.SCHEDULING]: (
      <SchedulingView
        {...programacionMeta.args}
        {...(data ? programacion.WithData.args : programacion.PendingIntegration.args)}
      />
    ),
    [WHATSAPP_TABS.CONVERSATIONS]: (
      <ConversationsView
        {...conversacionesMeta.args}
        {...(data ? conversaciones.Board.args : conversaciones.PendingIntegration.args)}
      />
    ),
    [WHATSAPP_TABS.HISTORY]: (
      <HistoryView
        {...historialMeta.args}
        {...(data ? historial.WithData.args : historial.PendingIntegration.args)}
      />
    ),
    [WHATSAPP_TABS.SETTINGS]: (
      <SettingsView
        {...ajustesMeta.args}
        {...(data ? ajustes.WithData.args : ajustes.PendingIntegration.args)}
      />
    ),
  };
}

function ConnectedPill() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--wa-whatsapp)_30%,transparent)] bg-wa-whatsapp-soft px-3 py-[7px] text-[13px] font-semibold text-wa-whatsapp-dark">
      <WaDot />
      Conectado · LIVII
    </span>
  );
}

function WhatsAppPagePreview({ tab, variant }: { tab: WhatsAppTab; variant: Variant }) {
  const [active, setActive] = useState<WhatsAppTab>(tab);
  const content = panels(variant);
  return (
    <div className="min-h-screen bg-background">
      <WhatsAppPageFrame>
        <WhatsAppPageHeader
          status={variant === "data" ? <ConnectedPill /> : <WhatsAppPendingStatusPill />}
        />
        <WhatsAppTabsShell
          value={active}
          onValueChange={(value) => setActive(value as WhatsAppTab)}
          renderPanel={(definition) => (definition.key === active ? content[definition.key] : null)}
        />
      </WhatsAppPageFrame>
    </div>
  );
}

const meta = {
  title: "WhatsApp/Pagina",
  component: WhatsAppPagePreview,
  parameters: { layout: "fullscreen" },
  args: { tab: WHATSAPP_TABS.CONNECTION, variant: "data" },
} satisfies Meta<typeof WhatsAppPagePreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ConexionConDatos: Story = { args: { tab: WHATSAPP_TABS.CONNECTION } };
export const ConexionPendiente: Story = {
  args: { tab: WHATSAPP_TABS.CONNECTION, variant: "pending" },
};
export const PlantillasConDatos: Story = { args: { tab: WHATSAPP_TABS.TEMPLATES } };
export const PlantillasPendiente: Story = {
  args: { tab: WHATSAPP_TABS.TEMPLATES, variant: "pending" },
};
export const ProgramacionConDatos: Story = { args: { tab: WHATSAPP_TABS.SCHEDULING } };
export const ProgramacionPendiente: Story = {
  args: { tab: WHATSAPP_TABS.SCHEDULING, variant: "pending" },
};
export const ConversacionesConDatos: Story = { args: { tab: WHATSAPP_TABS.CONVERSATIONS } };
export const ConversacionesPendiente: Story = {
  args: { tab: WHATSAPP_TABS.CONVERSATIONS, variant: "pending" },
};
export const HistorialConDatos: Story = { args: { tab: WHATSAPP_TABS.HISTORY } };
export const HistorialPendiente: Story = {
  args: { tab: WHATSAPP_TABS.HISTORY, variant: "pending" },
};
export const AjustesConDatos: Story = { args: { tab: WHATSAPP_TABS.SETTINGS } };
export const AjustesPendiente: Story = {
  args: { tab: WHATSAPP_TABS.SETTINGS, variant: "pending" },
};
