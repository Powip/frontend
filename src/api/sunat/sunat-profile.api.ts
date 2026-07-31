import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { SunatProfileResponseDto } from "./dto/sunat-profile.dto";

export async function createSunatProfile(
  formData: FormData
): Promise<SunatProfileResponseDto> {
  const { data } =
    await axiosAuth.post<SunatProfileResponseDto>(
      `${GATEWAY.integrations}/sunat-profiles`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

  return data;
}

export async function getSunatProfile(
  id: string
): Promise<SunatProfileResponseDto> {
  const { data } =
    await axiosAuth.get<SunatProfileResponseDto>(
      `${GATEWAY.integrations}/sunat-profiles/${id}`
    );

  return data;
}

export async function getSunatProfiles(): Promise<
  SunatProfileResponseDto[]
> {
  const { data } =
    await axiosAuth.get<SunatProfileResponseDto[]>(
      `${GATEWAY.integrations}/sunat-profiles`
    );

  return data;
}

export async function setDefaultSunatProfile(
  id: string
): Promise<SunatProfileResponseDto> {
  const { data } =
    await axiosAuth.patch<SunatProfileResponseDto>(
      `${GATEWAY.integrations}/sunat-profiles/${id}/default`
    );

  return data;
}
