import type { OlvaAgencyResponseDto } from "./olva-agency-response.dto";

// GET /olva/agencies -> 200 { results }
export interface ListOlvaAgenciesResponseDto {
  results: OlvaAgencyResponseDto[];
}
