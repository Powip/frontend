import {
  archiveOlvaSenderProfileApi,
  createOlvaSenderProfileApi,
  getOlvaSenderProfileApi,
  getOlvaSenderProfilesApi,
  setDefaultOlvaSenderProfileApi,
  updateOlvaSenderProfileApi,
} from "../api/olva-sender-profile.api";
import type { CreateOlvaSenderProfileRequestDto } from "../dto/create-olva-sender-profile-request.dto";
import type { UpdateOlvaSenderProfileRequestDto } from "../dto/update-olva-sender-profile-request.dto";
import { toOlvaSenderProfile } from "../mappers/to-olva-sender-profile";
import type { OlvaSenderProfile } from "../models/olva-sender-profile";

export interface UpdateOlvaSenderProfileInput {
  id: string;
  requestDto: UpdateOlvaSenderProfileRequestDto;
}

export async function createOlvaSenderProfile(
  requestDto: CreateOlvaSenderProfileRequestDto,
): Promise<OlvaSenderProfile> {
  const responseDto = await createOlvaSenderProfileApi(requestDto);

  return toOlvaSenderProfile(responseDto);
}

export async function getOlvaSenderProfiles(): Promise<OlvaSenderProfile[]> {
  const { results } = await getOlvaSenderProfilesApi();

  return results.map(toOlvaSenderProfile);
}

export async function getOlvaSenderProfile(id: string): Promise<OlvaSenderProfile> {
  const responseDto = await getOlvaSenderProfileApi(id);

  return toOlvaSenderProfile(responseDto);
}

export async function updateOlvaSenderProfile({
  id,
  requestDto,
}: UpdateOlvaSenderProfileInput): Promise<OlvaSenderProfile> {
  const responseDto = await updateOlvaSenderProfileApi(id, requestDto);

  return toOlvaSenderProfile(responseDto);
}

export async function setDefaultOlvaSenderProfile(id: string): Promise<OlvaSenderProfile> {
  const responseDto = await setDefaultOlvaSenderProfileApi(id);

  return toOlvaSenderProfile(responseDto);
}

export async function archiveOlvaSenderProfile(id: string): Promise<void> {
  await archiveOlvaSenderProfileApi(id);
}
