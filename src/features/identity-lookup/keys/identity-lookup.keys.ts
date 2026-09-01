import type { LookupIdentityQueryDto } from "../dto/lookup-identity-query.dto";

export const identityLookupKeys = {
  all: ["identity-lookup"] as const,

  lookups: () => [...identityLookupKeys.all, "lookup"] as const,

  lookup: (query: LookupIdentityQueryDto) =>
    [...identityLookupKeys.lookups(), query.documentType, query.documentNumber] as const,
};
