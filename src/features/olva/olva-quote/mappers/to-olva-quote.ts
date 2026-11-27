import type { OlvaQuoteResponseDto } from "../dto/olva-quote-response.dto";
import type { OlvaQuote } from "../models/olva-quote";

export function toOlvaQuote(dto: OlvaQuoteResponseDto): OlvaQuote {
  return { ...dto };
}
