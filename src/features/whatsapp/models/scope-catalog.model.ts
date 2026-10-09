import type { WhatsAppResourceState } from "./resource-state.model";

export interface WhatsAppCatalogOption {
  value: string;
  label: string;
}

export interface WhatsAppScopeCatalogs {
  stores: WhatsAppResourceState<WhatsAppCatalogOption[]>;
  salesChannels: WhatsAppResourceState<WhatsAppCatalogOption[]>;
  shippingTypes: WhatsAppResourceState<WhatsAppCatalogOption[]>;
  couriers: WhatsAppResourceState<WhatsAppCatalogOption[]>;
}
