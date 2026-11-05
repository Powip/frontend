import type { OlvaAgencyWeekday } from "../../shared/constants/olva-enums.constants";

export interface OlvaAgencyScheduleSlot {
  /** "HH:mm", null when closed. */
  open: string | null;
  close: string | null;
}

export type OlvaAgencySchedule = Partial<Record<OlvaAgencyWeekday, OlvaAgencyScheduleSlot>>;

export interface OlvaAgencyCoordinates {
  latitude: number;
  longitude: number;
}

export interface OlvaAgency {
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
  schedule: OlvaAgencySchedule;
  /** Null when Olva has no position for the agency (it cannot be placed on a map). */
  coordinates: OlvaAgencyCoordinates | null;
  headquarterCode: string;
  headquarterId: number;
}

export interface OlvaNearestAgency extends OlvaAgency {
  distanceKm: number;
}
