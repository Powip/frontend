import axiosAuth from "@/lib/axiosAuth";
import { OLVA_API_BASE_URL } from "../../shared/constants/olva-api.constants";
import type { GetOlvaPersonQueryDto } from "../dto/olva-person-query.dto";
import type { OlvaPersonResponseDto } from "../dto/olva-person-response.dto";
import type { OlvaPersonLookup } from "../models/olva-person-lookup";

// GET /olva/person/:docType/:docNumber?role=sender|recipient -> 200 (404 when unknown)
export async function getOlvaPersonApi({
  documentType,
  documentNumber,
  role,
}: OlvaPersonLookup): Promise<OlvaPersonResponseDto> {
  const params: GetOlvaPersonQueryDto = role ? { role } : {};

  const { data } = await axiosAuth.get<OlvaPersonResponseDto>(
    `${OLVA_API_BASE_URL}/person/${encodeURIComponent(documentType)}/${encodeURIComponent(documentNumber)}`,
    { params },
  );

  return data;
}
