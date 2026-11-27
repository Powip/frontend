import type { OlvaSenderProfileResponseDto } from "./olva-sender-profile-response.dto";

// Not paginated (a company has at most 10 active profiles)
export interface ListOlvaSenderProfilesResponseDto {
  results: OlvaSenderProfileResponseDto[];
}
