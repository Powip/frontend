import type {
  OlvaBulkShipmentCreated,
  OlvaBulkShipmentFailed,
  OlvaBulkShipmentRegisteredNotSaved,
  OlvaBulkShipmentResult,
} from "../models/olva-bulk-shipment-result";

export interface SplitOlvaBulkResults {
  created: OlvaBulkShipmentCreated[];
  registeredNotSaved: OlvaBulkShipmentRegisteredNotSaved[];
  failed: OlvaBulkShipmentFailed[];
}

/** Groups the results of a lot by what happened to them, keeping request order in each group. */
export function splitOlvaBulkResults(
  results: readonly OlvaBulkShipmentResult[],
): SplitOlvaBulkResults {
  const split: SplitOlvaBulkResults = { created: [], registeredNotSaved: [], failed: [] };

  for (const result of results) {
    if (result.status === "created") split.created.push(result);
    else if (result.status === "registered_not_saved") split.registeredNotSaved.push(result);
    else split.failed.push(result);
  }

  return split;
}
