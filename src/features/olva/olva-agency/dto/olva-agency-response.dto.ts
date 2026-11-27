import type { OlvaAgencyWeekday } from "../../shared/constants/olva-enums.constants";

export interface OlvaAgencyScheduleSlotResponseDto {
  /** "HH:mm" or null when closed that day. */
  open: string | null;
  close: string | null;
}

export interface OlvaAgencyResponseDto {
  code: string;
  name: string;
  type: string;
  department: string;
  province: string;
  district: string;
  address: string;
  ubigeo: string;
  isPartner: boolean;
  phone: string | null;
  /** Days missing from the record have no known schedule. */
  schedule: Partial<Record<OlvaAgencyWeekday, OlvaAgencyScheduleSlotResponseDto>>;
  latitude: number | null;
  longitude: number | null;
  headquarterCode: string;
  headquarterId: number;
}

export interface OlvaNearestAgencyResponseDto extends OlvaAgencyResponseDto {
  distanceKm: number;
}
