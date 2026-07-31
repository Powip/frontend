import { toCreateSunatProfileRequestDto, toSunatProfile } from "@/api/sunat/mappers/sunat-profile.mapper";
import * as api from "@/api/sunat/sunat-profile.api";
import { CreateSunatProfileInput } from "@/schemas/sunat/create-sunat-profile.schema";
import { SunatProfile } from "@/models/sunat/sunat-profile";
import { toFormData } from "@/utils/to-form-data";

export async function createSunatProfile(
  input: CreateSunatProfileInput
): Promise<SunatProfile> {
  const requestDto = toCreateSunatProfileRequestDto(input);

  const formData = toFormData(requestDto);

  const responseDto = await api.createSunatProfile(formData);

  return toSunatProfile(responseDto);
}

export async function getSunatProfile(
  id: string
): Promise<SunatProfile>{
  const responseDto = await api.getSunatProfile(id);

  return toSunatProfile(responseDto);
}

export async function getSunatProfiles(): Promise<SunatProfile[]> {
  const responseDtos = await api.getSunatProfiles();

  return responseDtos.map(toSunatProfile);
}

export async function setDefaultSunatProfile(
  id: string
): Promise<SunatProfile> {
  const responseDto = await api.setDefaultSunatProfile(id);

  return toSunatProfile(responseDto);
}
