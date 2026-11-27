import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import type { IdentityLookupResponseDto } from "../dto/identity-lookup-response.dto";
import type { LookupIdentityQueryDto } from "../dto/lookup-identity-query.dto";

export async function lookupIdentityApi(
  query: LookupIdentityQueryDto,
): Promise<IdentityLookupResponseDto> {
  const { data } = await axiosAuth.get<IdentityLookupResponseDto>(
    `${API.sunat}/api/v1/identity-lookup`,
    { params: query },
  );

  return data;
}
