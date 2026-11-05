import type { OlvaQuoteInput } from "../models/olva-quote-input";

export const olvaQuoteKeys = {
  all: ["olva-quotes"] as const,

  calculation: (input: OlvaQuoteInput) => [...olvaQuoteKeys.all, input] as const,
};
