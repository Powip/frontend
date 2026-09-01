import { lookupIdentityApi } from "../api/identity-lookup.api";
import type { LookupIdentityQueryDto } from "../dto/lookup-identity-query.dto";
import { toIdentityLookupResult } from "../mappers/to-identity-lookup-result.mapper";
import type { IdentityLookupResult } from "../models/identity-lookup-result.model";

export async function lookupIdentity(query: LookupIdentityQueryDto): Promise<IdentityLookupResult> {
  const response = await lookupIdentityApi(query);

  return toIdentityLookupResult(response);
}
