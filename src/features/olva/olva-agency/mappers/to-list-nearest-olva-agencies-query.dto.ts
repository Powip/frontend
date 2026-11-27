import type { ListNearestOlvaAgenciesQueryDto } from "../dto/olva-agency-query.dto";
import type { OlvaNearestAgenciesInput } from "../models/olva-agency-filters";

export function toListNearestOlvaAgenciesQueryDto({
  latitude,
  longitude,
  limit,
}: OlvaNearestAgenciesInput): ListNearestOlvaAgenciesQueryDto {
  return limit === undefined
    ? { lat: latitude, lng: longitude }
    : { lat: latitude, lng: longitude, limit };
}
