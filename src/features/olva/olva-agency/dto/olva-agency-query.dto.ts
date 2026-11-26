// Query string of GET /olva/agencies. All filters are optional and combine with AND;
// `q` searches name and address.
export interface ListOlvaAgenciesQueryDto {
  q?: string;
  department?: string;
  province?: string;
  district?: string;
}

// Query string of GET /olva/agencies/nearest. lat -90..90, lng -180..180, limit 1..50 (default 5).
export interface ListNearestOlvaAgenciesQueryDto {
  lat: number;
  lng: number;
  limit?: number;
}
