import type { OlvaTrackingLookup } from "../models/olva-tracking-lookup";

export const olvaTrackingKeys = {
  all: ["olva-tracking"] as const,

  single: (lookup: OlvaTrackingLookup) => [...olvaTrackingKeys.all, "single", lookup] as const,

  // The order of a batch is part of its answer (results come in request order)
  batch: (lookups: readonly OlvaTrackingLookup[]) =>
    [...olvaTrackingKeys.all, "batch", lookups] as const,
};
