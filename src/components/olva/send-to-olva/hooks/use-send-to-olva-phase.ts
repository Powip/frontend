import { useCallback, useReducer } from "react";
import type { OlvaBulkShipmentResult } from "@/features/olva/olva-shipment/models/olva-bulk-shipment-result";
import { SEND_TO_OLVA_VIEWS, type SendToOlvaView } from "../constants/send-to-olva.constants";
import { mergeOlvaBulkResults } from "../utils/merge-olva-bulk-results";

interface PhaseState {
  view: SendToOlvaView;
  /** Every result of the lot so far, one per order, across retries. */
  results: OlvaBulkShipmentResult[];
}

type PhaseAction =
  | { type: "resultsReceived"; results: OlvaBulkShipmentResult[] }
  | { type: "editRequested" };

const INITIAL_STATE: PhaseState = { view: SEND_TO_OLVA_VIEWS.EDIT, results: [] };

function phaseReducer(state: PhaseState, action: PhaseAction): PhaseState {
  switch (action.type) {
    case "resultsReceived":
      return {
        view: SEND_TO_OLVA_VIEWS.RESULTS,
        results: mergeOlvaBulkResults(state.results, action.results),
      };
    case "editRequested":
      return { ...state, view: SEND_TO_OLVA_VIEWS.EDIT };
  }
}

/** Which screen the modal shows (the form or the outcome) and what the lot has produced so far. */
export function useSendToOlvaPhase() {
  const [state, dispatch] = useReducer(phaseReducer, INITIAL_STATE);

  const showResults = useCallback(
    (results: OlvaBulkShipmentResult[]) => dispatch({ type: "resultsReceived", results }),
    [],
  );
  const backToEdit = useCallback(() => dispatch({ type: "editRequested" }), []);

  return { view: state.view, results: state.results, showResults, backToEdit };
}
