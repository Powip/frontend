export interface OlvaAgencyFilters {
  q?: string;
  department?: string;
  province?: string;
  district?: string;
}

export interface OlvaNearestAgenciesInput {
  latitude: number;
  longitude: number;
  limit?: number;
}
