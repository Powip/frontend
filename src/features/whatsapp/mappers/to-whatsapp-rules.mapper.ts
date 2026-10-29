import type {
  WhatsAppRuleBlockedReasonCode,
  WhatsAppRuleDto,
  WhatsAppRulesDto,
} from "../api/rules.api";
import type { WhatsAppRule, WhatsAppRulesData } from "../models/rule.model";

/** La tarjeta muestra blockedReason tal cual: el backend manda un código, aquí se traduce. */
const BLOCKED_REASON_TEXT: Record<WhatsAppRuleBlockedReasonCode, string> = {
  NOT_CONNECTED:
    "La tienda no tiene un número de WhatsApp conectado. Conéctalo en la pestaña Conexión para activar este aviso.",
  TEMPLATE_NOT_APPROVED:
    "La plantilla guardada no está aprobada por Meta. Elige una aprobada para poder activar este aviso.",
};

export function toWhatsAppRule(dto: WhatsAppRuleDto): WhatsAppRule {
  return {
    id: dto.id,
    key: dto.key,
    label: dto.label,
    triggerLabel: dto.triggerLabel,
    templateId: dto.templateId,
    active: dto.active,
    blockedReason: dto.blockedReason ? BLOCKED_REASON_TEXT[dto.blockedReason] : null,
    when: { ...dto.when },
    allowedWhenModes: [...dto.allowedWhenModes],
    reminder: dto.reminder ? { ...dto.reminder } : null,
    scope: {
      ...dto.scope,
      storeIds: [...dto.scope.storeIds],
      salesChannels: [...dto.scope.salesChannels],
      shippingTypes: [...dto.scope.shippingTypes],
      courierIds: [...dto.scope.courierIds],
    },
    stats: dto.stats,
    activatedAt: dto.activatedAt ? new Date(dto.activatedAt) : null,
    version: dto.version,
  };
}

export function toWhatsAppRulesData(dto: WhatsAppRulesDto): WhatsAppRulesData {
  return {
    rules: dto.items.map(toWhatsAppRule),
    summary: {
      activeCount: dto.summary.activeCount,
      estimatedMonthly: dto.summary.estimatedMonthly,
    },
  };
}