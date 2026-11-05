import { calculateOlvaQuoteApi } from "../api/olva-quote.api";
import { toCalculateOlvaQuoteRequestDto } from "../mappers/to-calculate-olva-quote-request.dto";
import { toOlvaQuote } from "../mappers/to-olva-quote";
import type { OlvaQuote } from "../models/olva-quote";
import type { OlvaQuoteInput } from "../models/olva-quote-input";

export async function calculateOlvaQuote(input: OlvaQuoteInput): Promise<OlvaQuote> {
  return toOlvaQuote(await calculateOlvaQuoteApi(toCalculateOlvaQuoteRequestDto(input)));
}
