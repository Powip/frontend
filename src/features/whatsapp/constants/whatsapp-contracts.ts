import { WHATSAPP_CONTRACT_STATUSES } from "../enums/whatsapp.enums";
import type { WhatsAppContract } from "../models/contract.model";

const { CONFIRMED, PROPOSED_IN_SPEC, PROPOSED, UNDEFINED } = WHATSAPP_CONTRACT_STATUSES;

export const WHATSAPP_CONTRACTS = {
  companyStores: {
    id: "C-E1",
    label: "Tiendas de la empresa",
    status: CONFIRMED,
    evidence: "src/contexts/AuthContext.tsx",
  },
  companyCouriers: {
    id: "C-E2",
    label: "Couriers de la empresa",
    status: CONFIRMED,
    evidence: "src/services/courierService.ts",
  },
  companySalesChannels: {
    id: "C-E3",
    label: "Canales de venta de la empresa",
    status: CONFIRMED,
    evidence: "src/contexts/AuthContext.tsx",
  },
  customerServiceAgents: {
    id: "C-E4",
    label: "Asesoras de Gestión CC",
    status: CONFIRMED,
    evidence: "src/services/agentesService.ts",
  },
  orderEvidence: {
    id: "C-E5",
    label: "Evidencia del pedido",
    status: CONFIRMED,
    evidence: "src/components/orders/OrderEvidenceSection.tsx",
  },
  orderCustomerServiceAgent: {
    id: "C-E6",
    label: "Asesora dueña del pedido",
    status: CONFIRMED,
    evidence: "src/interfaces/IOrder.ts",
  },
  shippingTypes: {
    id: "C-E8",
    label: "Tipos de envío del pedido",
    status: CONFIRMED,
    evidence: "src/constants/operationsDomain.ts",
  },
  legacyTrackingLink: {
    id: "C-E7",
    label: "Link de rastreo actual por número de pedido",
    status: CONFIRMED,
    evidence: "src/components/modals/CustomerServiceModal.tsx",
  },
  serviceBaseUrl: {
    id: "C-00.1",
    label: "Servicio y URL base del módulo WhatsApp",
    status: UNDEFINED,
    evidence: null,
  },
  connectionStatus: {
    id: "C-01",
    label: "Estado de conexión",
    status: PROPOSED,
    evidence: null,
  },
  accounts: {
    id: "C-02",
    label: "Números por tienda",
    status: PROPOSED_IN_SPEC,
    evidence: null,
  },
  embeddedSignup: {
    id: "C-06",
    label: "Conexión con Meta (Embedded Signup)",
    status: PROPOSED,
    evidence: null,
  },
  testMessage: {
    id: "C-07",
    label: "Mensaje de prueba",
    status: PROPOSED_IN_SPEC,
    evidence: null,
  },
  usageAndPricing: {
    id: "C-08/C-09",
    label: "Uso del mes y tarifas de Meta",
    status: PROPOSED,
    evidence: null,
  },
  contingency: {
    id: "C-10/C-11",
    label: "Contingencia y bandeja de envío asistido",
    status: PROPOSED,
    evidence: null,
  },
  templates: {
    id: "C-12",
    label: "Plantillas",
    status: PROPOSED_IN_SPEC,
    evidence: null,
  },
  templateCatalog: {
    id: "C-13/C-14",
    label: "Catálogo del editor y pedidos de ejemplo",
    status: PROPOSED,
    evidence: null,
  },
  rules: {
    id: "C-16",
    label: "Avisos automáticos",
    status: PROPOSED_IN_SPEC,
    evidence: null,
  },
  settings: {
    id: "C-18",
    label: "Horario, datos faltantes y respuesta automática",
    status: PROPOSED_IN_SPEC,
    evidence: null,
  },
  upcomingQueue: {
    id: "C-20",
    label: "Próximas 24 horas",
    status: PROPOSED,
    evidence: null,
  },
  campaigns: {
    id: "C-21",
    label: "Envíos programados",
    status: PROPOSED_IN_SPEC,
    evidence: null,
  },
  threads: {
    id: "C-22",
    label: "Conversaciones",
    status: PROPOSED_IN_SPEC,
    evidence: null,
  },
  quickReplies: {
    id: "C-23",
    label: "Respuestas rápidas",
    status: UNDEFINED,
    evidence: null,
  },
  messages: {
    id: "C-24",
    label: "Historial de envíos",
    status: PROPOSED_IN_SPEC,
    evidence: null,
  },
  optOuts: {
    id: "C-25",
    label: "Bajas",
    status: PROPOSED_IN_SPEC,
    evidence: null,
  },
  alerts: {
    id: "C-26",
    label: "Alertas de salud",
    status: PROPOSED_IN_SPEC,
    evidence: null,
  },
  auditLog: {
    id: "C-27",
    label: "Registro de cambios",
    status: PROPOSED_IN_SPEC,
    evidence: null,
  },
  permissions: {
    id: "C-28",
    label: "Permisos por rol",
    status: UNDEFINED,
    evidence: null,
  },
  inAppNotifications: {
    id: "C-31",
    label: "Campanita de notificaciones",
    status: UNDEFINED,
    evidence: null,
  },
} as const satisfies Record<string, WhatsAppContract>;

export type WhatsAppContractKey = keyof typeof WHATSAPP_CONTRACTS;

export function getWhatsAppContract(key: WhatsAppContractKey): WhatsAppContract {
  return WHATSAPP_CONTRACTS[key];
}

export function isWhatsAppContractAvailable(key: WhatsAppContractKey): boolean {
  return WHATSAPP_CONTRACTS[key].status === CONFIRMED;
}

export class WhatsAppContractUnavailableError extends Error {
  constructor(readonly contractKey: WhatsAppContractKey) {
    super(`El contrato ${WHATSAPP_CONTRACTS[contractKey].id} todavía no está disponible.`);
    this.name = "WhatsAppContractUnavailableError";
  }
}

export function assertWhatsAppContractAvailable(key: WhatsAppContractKey): void {
  if (!isWhatsAppContractAvailable(key)) {
    throw new WhatsAppContractUnavailableError(key);
  }
}
