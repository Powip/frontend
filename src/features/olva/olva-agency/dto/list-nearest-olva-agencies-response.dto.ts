import type { OlvaNearestAgencyResponseDto } from "./olva-agency-response.dto";

// GET /olva/agencies/nearest -> 200 { results } (closest first)
export interface ListNearestOlvaAgenciesResponseDto {
  results: OlvaNearestAgencyResponseDto[];
}
