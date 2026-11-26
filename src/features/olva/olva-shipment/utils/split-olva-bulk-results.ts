import type {
  OlvaBulkShipmentCreated,
  OlvaBulkShipmentFailed,
  OlvaBulkShipmentResult,
  OlvaBulkShipmentUnknown,
} from "../models/olva-bulk-shipment-result";

export interface SplitOlvaBulkResults {
  created: OlvaBulkShipmentCreated[];
  unknown: OlvaBulkShipmentUnknown[];
  failed: OlvaBulkShipmentFailed[];
}

/** Groups the results of a lot by what happened to them, keeping request order in each group. */
export function splitOlvaBulkResults(
  results: readonly OlvaBulkShipmentResult[],
): SplitOlvaBulkResults {
  const split: SplitOlvaBulkResults = { created: [], unknown: [], failed: [] };

  for (const result of results) {
    if (result.status === "created") split.created.push(result);
    else if (result.status === "unknown") split.unknown.push(result);
    else split.failed.push(result);
  }

  return split;
}
