import { Lock } from "lucide-react";
import { PendingIntegrationNotice } from "@/components/whatsapp/PendingIntegrationNotice";
import type { WhatsAppTabDefinition } from "@/features/whatsapp/constants/whatsapp-tabs";
import { WHATSAPP_TABS } from "@/features/whatsapp/enums/whatsapp.enums";
import { buildActivateRuleSearch } from "@/features/whatsapp/utils/rule-link.util";
import type { WhatsAppAccess } from "@/features/whatsapp/utils/whatsapp-access.util";
import type { WhatsAppNavigate } from "@/features/whatsapp/utils/whatsapp-tab.util";
import { SettingsTab } from "./ajustes/SettingsTab";
import { ConnectionTab } from "./conexion/ConnectionTab";
import { ConversationsTab } from "./conversaciones/ConversationsTab";
import { HistoryTab } from "./historial/HistoryTab";
import { TemplatesTab } from "./plantillas/TemplatesTab";
import { SchedulingTab } from "./programacion/SchedulingTab";

interface WhatsAppTabPanelProps {
  definition: WhatsAppTabDefinition;
  access: WhatsAppAccess;
  businessName: string;
  search: string;
  onNavigate: WhatsAppNavigate;
}

const TABS_WITH_OWN_CONTENT: string[] = [
  WHATSAPP_TABS.CONNECTION,
  WHATSAPP_TABS.TEMPLATES,
  WHATSAPP_TABS.SCHEDULING,
  WHATSAPP_TABS.CONVERSATIONS,
  WHATSAPP_TABS.HISTORY,
  WHATSAPP_TABS.SETTINGS,
];

export function WhatsAppTabPanel({
  definition,
  access,
  businessName,
  search,
  onNavigate,
}: WhatsAppTabPanelProps) {
  const hasOwnContent = TABS_WITH_OWN_CONTENT.includes(definition.key);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {!hasOwnContent && (
        <PendingIntegrationNotice
          title="Pendiente de integración"
          description="Estas secciones se activarán cuando el servicio de WhatsApp de POWIP esté disponible. Hasta entonces no se muestran números, mensajes, métricas ni contadores."
          items={definition.sections}
        />
      )}

      {definition.managedByAdministrators && !access.canManageConfiguration && (
        <p className="flex items-start gap-2 text-[13px] text-wa-muted">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Solo un administrador podrá cambiar esta configuración. Los permisos de Supervisor CC y
          Asesora todavía no están definidos.
        </p>
      )}

      {definition.key === WHATSAPP_TABS.TEMPLATES && (
        <TemplatesTab
          canManage={access.canManageConfiguration}
          businessName={businessName}
          onActivateRule={(template) => onNavigate(buildActivateRuleSearch(search, template))}
        />
      )}

      {definition.key === WHATSAPP_TABS.SCHEDULING && (
        <SchedulingTab
          canManage={access.canManageConfiguration}
          businessName={businessName}
          search={search}
          onNavigate={onNavigate}
        />
      )}

      {definition.key === WHATSAPP_TABS.CONVERSATIONS && (
        <ConversationsTab
          canManage={access.canManageConfiguration}
          businessName={businessName}
          search={search}
          onNavigate={onNavigate}
        />
      )}

      {definition.key === WHATSAPP_TABS.HISTORY && <HistoryTab />}

      {definition.key === WHATSAPP_TABS.SETTINGS && (
        <SettingsTab
          canManage={access.canManageConfiguration}
          search={search}
          onNavigate={onNavigate}
        />
      )}

      {definition.key === WHATSAPP_TABS.CONNECTION && (
        <ConnectionTab canManage={access.canManageConfiguration} />
      )}
    </div>
  );
}
