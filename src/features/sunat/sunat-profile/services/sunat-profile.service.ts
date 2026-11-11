import {
  createSunatProfileApi,
  deleteSunatProfileApi,
  getSunatProfilesApi,
  replaceSunatProfileCertificateApi,
  setDefaultSunatProfileApi,
} from "../api/sunat-profile.api";
import type { CreateSunatProfileRequestDto } from "../dto/create-sunat-profile-request.dto";
import type { ReplaceSunatProfileCertificateInput } from "../dto/replace-sunat-profile-certificate-request.dto";
import { toSunatProfile } from "../mappers/to-sunat-profile";
import type { SunatProfile } from "../models/sunat-profile";

export async function createSunatProfile(
  requestDto: CreateSunatProfileRequestDto,
): Promise<SunatProfile> {
  const response = await createSunatProfileApi(requestDto);

  return toSunatProfile(response);
}

export async function getSunatProfiles(): Promise<SunatProfile[]> {
  const responseDto = await getSunatProfilesApi();

  return responseDto.map(toSunatProfile);
}

export async function setDefaultSunatProfile(id: string): Promise<SunatProfile> {
  const responseDto = await setDefaultSunatProfileApi(id);

  return toSunatProfile(responseDto);
}

export async function replaceSunatProfileCertificate({
  id,
  ...requestDto
}: ReplaceSunatProfileCertificateInput): Promise<SunatProfile> {
  const responseDto = await replaceSunatProfileCertificateApi(id, requestDto);

  return toSunatProfile(responseDto);
}

export async function deleteSunatProfile(id: string): Promise<void> {
  await deleteSunatProfileApi(id);
}
