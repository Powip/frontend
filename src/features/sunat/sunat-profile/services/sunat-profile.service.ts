import {
  createSunatProfileApi,
  getSunatProfilesApi,
  setDefaultSunatProfileApi,
} from "../api/sunat-profile.api";
import type { CreateSunatProfileRequestDto } from "../dto/create-sunat-profile-request.dto";
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
