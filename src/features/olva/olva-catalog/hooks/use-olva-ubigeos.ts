import { useQuery } from "@tanstack/react-query";
import { olvaCatalogQueries } from "../queries/olva-catalog.queries";

export function useOlvaUbigeos() {
  return useQuery(olvaCatalogQueries.ubigeos());
}
