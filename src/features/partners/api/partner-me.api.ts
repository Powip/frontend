import axios from "axios";
import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import type { PartnerMeResponseDto } from "../dto/partner-me-response.dto";

export async function getPartnerMeApi(): Promise<PartnerMeResponseDto> {
  const { data } = await axiosAuth.get<PartnerMeResponseDto>(`${API.partners}/me`);

  return data;
}

export async function getPartnerMeWithTokenApi(accessToken: string): Promise<PartnerMeResponseDto> {
  const { data } = await axios.get<PartnerMeResponseDto>(`${API.partners}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return data;
}
