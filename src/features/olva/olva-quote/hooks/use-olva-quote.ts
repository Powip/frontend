import { useQuery } from "@tanstack/react-query";
import type { OlvaQuoteInput } from "../models/olva-quote-input";
import { olvaQuoteQueries } from "../queries/olva-quote.queries";

/** Pass `null` while the form is incomplete: nothing is requested meanwhile. */
export function useOlvaQuote(input: OlvaQuoteInput | null) {
  return useQuery(olvaQuoteQueries.calculation(input));
}
