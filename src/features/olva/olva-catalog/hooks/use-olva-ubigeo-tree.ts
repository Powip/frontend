import { useQuery } from "@tanstack/react-query";
import { olvaCatalogQueries } from "../queries/olva-catalog.queries";
import { buildOlvaUbigeoTree } from "../utils/build-olva-ubigeo-tree";

/**
 * The ubigeo catalog as department -> province -> district, for a home delivery's destination.
 * Shares the cache with `useOlvaUbigeos` (`select`).
 */
export function useOlvaUbigeoTree() {
  return useQuery({
    ...olvaCatalogQueries.ubigeos(),
    select: buildOlvaUbigeoTree,
  });
}
