import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import type { GetSunatDocumentSequenceQuery } from "../dto/get-sunat-document-sequence.query";
import type { InitializeSunatDocumentSequenceRequestDto } from "../dto/initialize-sunat-document-sequence-request.dto";
import type { SunatDocumentSequenceResponseDto } from "../dto/sunat-document-sequence-response.dto";

export async function initializeSunatDocumentSequenceApi(
  requestDto: InitializeSunatDocumentSequenceRequestDto,
): Promise<SunatDocumentSequenceResponseDto> {
  const { data } = await axiosAuth.post<SunatDocumentSequenceResponseDto>(
    // `${GATEWAY.integrations}/sunat-documents`,
    `${API.sunat}/api/v1/sunat-document-sequences/initialize`,
    requestDto,
  );

  return data;
}

export async function getSunatDocumentSequenceApi(
  query: GetSunatDocumentSequenceQuery,
): Promise<SunatDocumentSequenceResponseDto> {
  const { data } = await axiosAuth.get<SunatDocumentSequenceResponseDto>(
    `${API.sunat}/api/v1/sunat-document-sequences`,
    {
      params: query,
    },
  );

  return data;
}

export async function getSunatDocumentSequencesApi(): Promise<SunatDocumentSequenceResponseDto[]> {
  const { data } = await axiosAuth.get<SunatDocumentSequenceResponseDto[]>(
    `${API.sunat}/api/v1/sunat-document-sequences/default`,
  );

  return data;
}
