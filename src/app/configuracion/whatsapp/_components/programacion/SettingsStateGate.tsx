import type { ReactNode } from "react";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppSendingSettings } from "@/features/whatsapp/models/sending-settings.model";

interface SettingsStateGateProps {
  settings: ResourceState<WhatsAppSendingSettings>;
  onRetry?: () => void;
  children: () => ReactNode;
}

export function SettingsStateGate({ settings, onRetry, children }: SettingsStateGateProps) {
  if (settings.kind === "pending-integration" || settings.kind === "ready") {
    return <>{children()}</>;
  }
  return (
    <WhatsAppResourceState
      state={settings}
      pendingTitle=""
      loadingLabel="Cargando la configuración"
      errorTitle="No se pudo cargar la configuración"
      onRetry={onRetry}
    >
      {() => null}
    </WhatsAppResourceState>
  );
}
