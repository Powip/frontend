import { useQuery } from "@tanstack/react-query";
import { olvaCatalogQueries } from "../queries/olva-catalog.queries";
import { indexOlvaUbigeosByCode } from "../utils/index-olva-ubigeos-by-code";

/** The ubigeo catalog as `code -> ubigeo`. Shares the cache with `useOlvaUbigeos` (`select`). */
export function useOlvaUbigeoIndex() {
  return useQuery({
    ...olvaCatalogQueries.ubigeos(),
    select: indexOlvaUbigeosByCode,
  });
}
