import type { WhatsAppResourceState } from "@/features/whatsapp/models/resource-state.model";
import type {
  WhatsAppCatalogOption,
  WhatsAppScopeCatalogs,
} from "@/features/whatsapp/models/scope-catalog.model";
import type { ScopeCatalogLabels } from "@/features/whatsapp/utils/rule-summary.util";

function toLabelMap(catalog: WhatsAppResourceState<WhatsAppCatalogOption[]>): Map<string, string> {
  return new Map(
    catalog.kind === "ready" ? catalog.data.map((option) => [option.value, option.label]) : [],
  );
}

export function buildScopeLabels(catalogs: WhatsAppScopeCatalogs): ScopeCatalogLabels {
  return {
    stores: toLabelMap(catalogs.stores),
    couriers: toLabelMap(catalogs.couriers),
    shippingTypes: toLabelMap(catalogs.shippingTypes),
  };
}
