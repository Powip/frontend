import axios from "axios";
import {
  deleteSunatDocumentSequenceApi,
  getSunatDocumentSequenceApi,
  getSunatDocumentSequencesApi,
  initializeSunatDocumentSequenceApi,
  setDefaultSunatDocumentSequenceApi,
} from "../api/sunat-document-sequence.api";
import type { DeleteSunatDocumentSequenceQuery } from "../dto/delete-sunat-document-sequence.query";
import type { GetSunatDocumentSequenceQuery } from "../dto/get-sunat-document-sequence.query";
import type { InitializeSunatDocumentSequenceRequestDto } from "../dto/initialize-sunat-document-sequence-request.dto";
import type { SetDefaultSunatDocumentSequenceRequestDto } from "../dto/set-default-sunat-document-sequence-request.dto";
import { toSunatDocumentSequence } from "../mappers/to-sunat-document-sequence";
import type { SunatDocumentSequence } from "../models/sunat-document-sequence";

export async function initializeSunatDocumentSequence(
  requestDto: InitializeSunatDocumentSequenceRequestDto,
): Promise<SunatDocumentSequence> {
  const responseDto = await initializeSunatDocumentSequenceApi(requestDto);

  return toSunatDocumentSequence(responseDto);
}

export async function getSunatDocumentSequence(
  query: GetSunatDocumentSequenceQuery,
): Promise<SunatDocumentSequence | null> {
  try {
    const responseDto = await getSunatDocumentSequenceApi(query);

    return toSunatDocumentSequence(responseDto);
  } catch (error) {
    // La serie todavía no fue configurada para este tipo de documento: no es un error real.
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function getSunatDocumentSequences(): Promise<SunatDocumentSequence[]> {
  const response = await getSunatDocumentSequencesApi();

  return response.map(toSunatDocumentSequence);
}

export async function setDefaultSunatDocumentSequence(
  requestDto: SetDefaultSunatDocumentSequenceRequestDto,
): Promise<SunatDocumentSequence> {
  const responseDto = await setDefaultSunatDocumentSequenceApi(requestDto);

  return toSunatDocumentSequence(responseDto);
}

export async function deleteSunatDocumentSequence(
  query: DeleteSunatDocumentSequenceQuery,
): Promise<void> {
  await deleteSunatDocumentSequenceApi(query);
}
