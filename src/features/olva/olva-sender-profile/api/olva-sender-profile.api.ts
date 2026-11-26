import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import type { CreateOlvaSenderProfileRequestDto } from "../dto/create-olva-sender-profile-request.dto";
import type { ListOlvaSenderProfilesResponseDto } from "../dto/list-olva-sender-profiles-response.dto";
import type { OlvaSenderProfileResponseDto } from "../dto/olva-sender-profile-response.dto";
import type { UpdateOlvaSenderProfileRequestDto } from "../dto/update-olva-sender-profile-request.dto";

const OLVA_SENDER_PROFILES_BASE = `${API.integrations}/olva/sender-profiles`;

// POST /olva/sender-profiles -> 201
export async function createOlvaSenderProfileApi(
  requestDto: CreateOlvaSenderProfileRequestDto,
): Promise<OlvaSenderProfileResponseDto> {
  const { data } = await axiosAuth.post<OlvaSenderProfileResponseDto>(
    OLVA_SENDER_PROFILES_BASE,
    requestDto,
  );

  return data;
}

// GET /olva/sender-profiles -> 200 { results }
export async function getOlvaSenderProfilesApi(): Promise<ListOlvaSenderProfilesResponseDto> {
  const { data } =
    await axiosAuth.get<ListOlvaSenderProfilesResponseDto>(OLVA_SENDER_PROFILES_BASE);

  return data;
}

// GET /olva/sender-profiles/:id -> 200
export async function getOlvaSenderProfileApi(id: string): Promise<OlvaSenderProfileResponseDto> {
  const { data } = await axiosAuth.get<OlvaSenderProfileResponseDto>(
    `${OLVA_SENDER_PROFILES_BASE}/${id}`,
  );

  return data;
}

// PATCH /olva/sender-profiles/:id -> 200
export async function updateOlvaSenderProfileApi(
  id: string,
  requestDto: UpdateOlvaSenderProfileRequestDto,
): Promise<OlvaSenderProfileResponseDto> {
  const { data } = await axiosAuth.patch<OlvaSenderProfileResponseDto>(
    `${OLVA_SENDER_PROFILES_BASE}/${id}`,
    requestDto,
  );

  return data;
}

// PUT /olva/sender-profiles/:id/default -> 200 (idempotent)
export async function setDefaultOlvaSenderProfileApi(
  id: string,
): Promise<OlvaSenderProfileResponseDto> {
  const { data } = await axiosAuth.put<OlvaSenderProfileResponseDto>(
    `${OLVA_SENDER_PROFILES_BASE}/${id}/default`,
  );

  return data;
}

// DELETE /olva/sender-profiles/:id -> 204. Archives, it does not erase.
export async function archiveOlvaSenderProfileApi(id: string): Promise<void> {
  await axiosAuth.delete<void>(`${OLVA_SENDER_PROFILES_BASE}/${id}`);
}
