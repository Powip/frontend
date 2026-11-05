import type { OlvaNearestAgencyResponseDto } from "../dto/olva-agency-response.dto";
import type { OlvaNearestAgency } from "../models/olva-agency";
import { toOlvaAgency } from "./to-olva-agency";

export function toOlvaNearestAgency(dto: OlvaNearestAgencyResponseDto): OlvaNearestAgency {
  return { ...toOlvaAgency(dto), distanceKm: dto.distanceKm };
}
