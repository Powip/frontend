import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import type { DeleteSunatDocumentSequenceQuery } from "../dto/delete-sunat-document-sequence.query";
import type { GetSunatDocumentSequenceQuery } from "../dto/get-sunat-document-sequence.query";
import type { InitializeSunatDocumentSequenceRequestDto } from "../dto/initialize-sunat-document-sequence-request.dto";
import type { SetDefaultSunatDocumentSequenceRequestDto } from "../dto/set-default-sunat-document-sequence-request.dto";
import type { SunatDocumentSequenceResponseDto } from "../dto/sunat-document-sequence-response.dto";

const SUNAT_DOCUMENT_SEQUENCES_BASE = `${API.sunat}/api/v1/sunat-document-sequences`;

export async function initializeSunatDocumentSequenceApi(
  requestDto: InitializeSunatDocumentSequenceRequestDto,
): Promise<SunatDocumentSequenceResponseDto> {
  const { data } = await axiosAuth.post<SunatDocumentSequenceResponseDto>(
    `${SUNAT_DOCUMENT_SEQUENCES_BASE}/initialize`,
    requestDto,
  );

  return data;
}

export async function getSunatDocumentSequenceApi(
  query: GetSunatDocumentSequenceQuery,
): Promise<SunatDocumentSequenceResponseDto> {
  const { data } = await axiosAuth.get<SunatDocumentSequenceResponseDto>(
    SUNAT_DOCUMENT_SEQUENCES_BASE,
    {
      params: query,
    },
  );

  return data;
}

/**
 * Lists every sequence (any tax document type/series) configured for the
 * authenticated company's default SUNAT issuer.
 *
 * NOTE: this previously pointed at `/sunat-document-sequences/default`,
 * which doesn't exist on the backend (the controller exposes this as
 * `GET /sunat-document-sequences/company` - see
 * SunatDocumentSequenceController#listByCompany). That 404 went unnoticed
 * because nothing called this function yet; fixed here as part of wiring
 * up the list/delete/set-default UI in SeriesTab.
 */
export async function getSunatDocumentSequencesApi(): Promise<SunatDocumentSequenceResponseDto[]> {
  const { data } = await axiosAuth.get<SunatDocumentSequenceResponseDto[]>(
    `${SUNAT_DOCUMENT_SEQUENCES_BASE}/company`,
  );

  return data;
}

export async function setDefaultSunatDocumentSequenceApi(
  requestDto: SetDefaultSunatDocumentSequenceRequestDto,
): Promise<SunatDocumentSequenceResponseDto> {
  const { data } = await axiosAuth.patch<SunatDocumentSequenceResponseDto>(
    `${SUNAT_DOCUMENT_SEQUENCES_BASE}/default`,
    requestDto,
  );

  return data;
}

export async function deleteSunatDocumentSequenceApi(
  query: DeleteSunatDocumentSequenceQuery,
): Promise<void> {
  await axiosAuth.delete<void>(SUNAT_DOCUMENT_SEQUENCES_BASE, {
    params: query,
  });
}
