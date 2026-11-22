import { WHATSAPP_TABS, type WhatsAppTab } from "../enums/whatsapp.enums";
import type { WhatsAppContractKey } from "./whatsapp-contracts";

export interface WhatsAppTabDefinition {
  key: WhatsAppTab;
  label: string;
  description: string;
  sections: string[];
  contracts: WhatsAppContractKey[];
  managedByAdministrators: boolean;
}

export const DEFAULT_WHATSAPP_TAB: WhatsAppTab = WHATSAPP_TABS.CONNECTION;

export const WHATSAPP_TAB_STORAGE_KEY = "powip:wa:tab";

export const WHATSAPP_TAB_DEFINITIONS: WhatsAppTabDefinition[] = [
  {
    key: WHATSAPP_TABS.CONNECTION,
    label: "Conexión",
    description:
      "Conecta el número de WhatsApp de cada tienda, revisa su salud y configura el número de contingencia.",
    sections: [
      "Tipo de conexión",
      "Número conectado",
      "Enviar mensaje de prueba",
      "Números por tienda",
      "Número de contingencia y envío asistido",
      "Costo de los mensajes",
    ],
    contracts: [
      "connectionStatus",
      "accounts",
      "embeddedSignup",
      "testMessage",
      "contingency",
      "usageAndPricing",
    ],
    managedByAdministrators: true,
  },
  {
    key: WHATSAPP_TABS.TEMPLATES,
    label: "Plantillas",
    description: "Crea y edita los mensajes que Meta debe aprobar antes de usarse.",
    sections: ["Tus plantillas", "Editor con vista previa", "Revisión de Meta y pruebas A/B"],
    contracts: ["templates", "templateCatalog"],
    managedByAdministrators: true,
  },
  {
    key: WHATSAPP_TABS.SCHEDULING,
    label: "Programación",
    description: "Decide qué mensaje sale, cuándo y a qué pedidos.",
    sections: [
      "Avisos automáticos por estado del envío",
      "Si al pedido le faltan datos",
      "Horario permitido",
      "Próximas 24 horas",
      "Envíos programados",
    ],
    contracts: ["rules", "settings", "upcomingQueue", "campaigns"],
    managedByAdministrators: true,
  },
  // «Conversaciones» queda fuera del menú: POWIP todavía no guarda las respuestas
  // de los compradores a estos avisos. Los chats se atienden en Ventas por chat.
  {
    key: WHATSAPP_TABS.HISTORY,
    label: "Historial de envíos",
    description: "Mide resultados y revisa cada mensaje enviado.",
    sections: ["Indicadores", "Del envío a la lectura", "Tabla de mensajes", "Exportar Excel"],
    contracts: ["messages"],
    managedByAdministrators: false,
  },
  {
    key: WHATSAPP_TABS.SETTINGS,
    // Alertas de salud, registro de cambios y permisos vuelven cuando POWIP los guarde.
    label: "Bajas y números extranjeros",
    description: "Lista de quienes no quieren mensajes y qué hacer con números extranjeros.",
    sections: ["Clientes que no quieren avisos", "Números extranjeros"],
    contracts: ["optOuts", "settings"],
    managedByAdministrators: true,
  },
];
