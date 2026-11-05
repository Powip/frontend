import type { OlvaShipmentFilters } from "../models/olva-shipment-filters";

export const olvaShipmentKeys = {
  all: ["olva-shipments"] as const,

  lists: () => [...olvaShipmentKeys.all, "list"] as const,

  list: (filters: OlvaShipmentFilters) => [...olvaShipmentKeys.lists(), filters] as const,

  // Under `lists()`, so invalidating the lists also refreshes the per-order lookups
  byOrder: (orderId: string) => [...olvaShipmentKeys.lists(), "by-order", orderId] as const,

  details: () => [...olvaShipmentKeys.all, "detail"] as const,

  detail: (id: string) => [...olvaShipmentKeys.details(), id] as const,

  labels: () => [...olvaShipmentKeys.all, "label"] as const,

  label: (id: string) => [...olvaShipmentKeys.labels(), id] as const,
};
