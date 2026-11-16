import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import type {
  ReleaseSunatIssuerAccessBlockRequestDto,
  ReleaseSunatIssuerAccessBlockResponseDto,
  SunatIssuerAccessBlockResponseDto,
} from "../dto/sunat-issuer-access-block-response.dto";

const SUNAT_ISSUER_ACCESS_BLOCKS_BASE = `${API.sunat}/api/v1/sunat-issuer-access-blocks`;

export async function listSunatIssuerAccessBlocksApi(): Promise<
  SunatIssuerAccessBlockResponseDto[]
> {
  const { data } = await axiosAuth.get<SunatIssuerAccessBlockResponseDto[]>(
    SUNAT_ISSUER_ACCESS_BLOCKS_BASE,
  );

  return data;
}

export async function releaseSunatIssuerAccessBlockApi(
  requestDto: ReleaseSunatIssuerAccessBlockRequestDto,
): Promise<ReleaseSunatIssuerAccessBlockResponseDto> {
  const { data } = await axiosAuth.post<ReleaseSunatIssuerAccessBlockResponseDto>(
    `${SUNAT_ISSUER_ACCESS_BLOCKS_BASE}/release`,
    requestDto,
  );

  return data;
}
