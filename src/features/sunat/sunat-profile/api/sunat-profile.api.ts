import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import type { CreateSunatProfileRequestDto } from "../dto/create-sunat-profile-request.dto";
import type { SunatProfileResponseDto } from "../dto/sunat-profile-response.dto";

export async function createSunatProfileApi(
  requestDto: CreateSunatProfileRequestDto,
): Promise<SunatProfileResponseDto> {
  const formData = new FormData();

  formData.append("name", requestDto.name);

  if (requestDto.description !== undefined) {
    formData.append("description", requestDto.description);
  }

  formData.append("ruc", requestDto.ruc);
  formData.append("razonSocial", requestDto.razonSocial);
  formData.append("countryCode", requestDto.countryCode);
  formData.append("ubigeo", requestDto.ubigeo);
  formData.append("address", requestDto.address);
  formData.append("establishmentCode", requestDto.establishmentCode);

  formData.append("solUser", requestDto.solUser);
  formData.append("solPassword", requestDto.solPassword);
  formData.append("certificatePassword", requestDto.certificatePassword);

  formData.append("certificate", requestDto.certificate);

  if (requestDto.logo !== undefined) {
    formData.append("logo", requestDto.logo);
  }

  const { data } = await axiosAuth.post<SunatProfileResponseDto>(
    `${API.sunat}/api/v1/sunat-profiles`,
    formData,
  );

  return data;
}

export async function getSunatProfileApi(id: string): Promise<SunatProfileResponseDto> {
  const { data } = await axiosAuth.get<SunatProfileResponseDto>(
    // `${GATEWAY.integrations}/sunat-profiles/${id}`
    `${API.sunat}/api/v1/sunat-profiles/${id}`,
  );

  return data;
}

export async function getSunatProfilesApi(): Promise<SunatProfileResponseDto[]> {
  const { data } = await axiosAuth.get<SunatProfileResponseDto[]>(
    // `${GATEWAY.integrations}/sunat-profiles`
    `${API.sunat}/api/v1/sunat-profiles`,
  );

  return data;
}

export async function setDefaultSunatProfileApi(id: string): Promise<SunatProfileResponseDto> {
  const { data } = await axiosAuth.patch<SunatProfileResponseDto>(
    // `${GATEWAY.integrations}/sunat-profiles/${id}/default`
    `${API.sunat}/api/v1/sunat-profiles/${id}/default`,
  );

  return data;
}
