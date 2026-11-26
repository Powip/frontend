import { keepPreviousData, queryOptions, skipToken } from "@tanstack/react-query";
import { OLVA_QUOTE_STALE_TIME_MS } from "../../shared/constants/olva-cache.constants";
import { shouldRetryOlvaRequest } from "../../shared/utils/should-retry-olva-request";
import { olvaQuoteKeys } from "../keys/olva-quote.keys";
import type { OlvaQuoteInput } from "../models/olva-quote-input";
import { calculateOlvaQuote } from "../services/olva-quote.service";

const EMPTY_INPUT: OlvaQuoteInput = {
  originUbigeo: "",
  destinationUbigeo: "",
  deliveryType: "O",
  shipmentType: 1,
  weightKg: 0,
};

export const olvaQuoteQueries = {
  /**
   * A quote is a read-only calculation, so it is a query (cached by its inputs, refreshed
   * automatically) even though the endpoint is a POST. Idle for `null`.
   */
  calculation: (input: OlvaQuoteInput | null) =>
    queryOptions({
      queryKey: olvaQuoteKeys.calculation(input ?? EMPTY_INPUT),
      queryFn: input ? () => calculateOlvaQuote(input) : skipToken,
      // While the weight changes, keep showing the last price instead of a spinner
      placeholderData: keepPreviousData,
      staleTime: OLVA_QUOTE_STALE_TIME_MS,
      retry: shouldRetryOlvaRequest,
    }),
};
