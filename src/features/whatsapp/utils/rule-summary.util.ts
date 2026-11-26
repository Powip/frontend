import { WHATSAPP_RULE_DATE_MODES, WHATSAPP_RULE_WHEN_MODES } from "../enums/whatsapp.enums";
import type { WhatsAppRuleScope, WhatsAppRuleWhen } from "../models/rule.model";
import { formatDateKey } from "./lima-time.util";

export interface ScopeCatalogLabels {
  stores: Map<string, string>;
  couriers: Map<string, string>;
  shippingTypes: Map<string, string>;
}

const MINUTES_PER_DAY = 1440;

export function describeRuleWhen(when: WhatsAppRuleWhen): string {
  switch (when.mode) {
    case WHATSAPP_RULE_WHEN_MODES.IMMEDIATELY:
      return "Inmediato";
    case WHATSAPP_RULE_WHEN_MODES.DELAY_MINUTES: {
      const minutes = when.minutes ?? 0;
      if (minutes > 0 && minutes % MINUTES_PER_DAY === 0) {
        const days = minutes / MINUTES_PER_DAY;
        return `${days} ${days === 1 ? "día" : "días"} después`;
      }
      return `${minutes} min después`;
    }
    case WHATSAPP_RULE_WHEN_MODES.FIXED_TIME:
      return `Todos los días a las ${when.time ?? "—"}`;
    case WHATSAPP_RULE_WHEN_MODES.HOURS_BEFORE_DELIVERY:
      return `${when.hours ?? "—"} h antes de la entrega estimada`;
  }
}

function describeList(
  values: string[],
  allLabel: string,
  labels: Map<string, string> | null,
): string {
  if (values.length === 0) return allLabel;
  return values.map((value) => labels?.get(value) ?? value).join(", ");
}

export function describeRuleScope(scope: WhatsAppRuleScope, labels: ScopeCatalogLabels): string {
  const dates =
    scope.dateMode === WHATSAPP_RULE_DATE_MODES.SINCE_ACTIVATION
      ? "Pedidos desde que se activa"
      : `Pedidos del ${scope.from ? formatDateKey(scope.from) : "—"}${
          scope.to ? ` al ${formatDateKey(scope.to)}` : " en adelante"
        }`;
  return [
    describeList(scope.storeIds, "Todas las tiendas", labels.stores),
    describeList(scope.salesChannels, "Todos los canales", null),
    describeList(scope.shippingTypes, "Todos los tipos de envío", labels.shippingTypes),
    describeList(scope.courierIds, "Todos los couriers", labels.couriers),
    dates,
    `máx. ${scope.maxOrderAgeDays} días`,
  ].join(" · ");
}
