import type { OlvaPersonLookup } from "../models/olva-person-lookup";

export const olvaPersonKeys = {
  all: ["olva-person"] as const,

  lookup: ({ documentType, documentNumber, role }: OlvaPersonLookup) =>
    [...olvaPersonKeys.all, documentType, documentNumber, role ?? null] as const,
};
