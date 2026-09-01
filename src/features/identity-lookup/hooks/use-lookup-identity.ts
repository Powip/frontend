import { useMutation } from "@tanstack/react-query";
import type { LookupIdentityQueryDto } from "../dto/lookup-identity-query.dto";
import type { IdentityLookupResult } from "../models/identity-lookup-result.model";
import { lookupIdentity } from "../services/lookup-identity.service";

/**
 * A mutation, not a query: this is an on-demand "verify now" action
 * triggered by a button click, not something we want to auto-fetch or
 * cache-and-refetch in the background.
 */
export function useLookupIdentity() {
  return useMutation<IdentityLookupResult, Error, LookupIdentityQueryDto>({
    mutationFn: lookupIdentity,
  });
}
