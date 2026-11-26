import { queryOptions } from "@tanstack/react-query";
import { OLVA_REFERENCE_DATA_STALE_TIME_MS } from "../../shared/constants/olva-cache.constants";
import { shouldRetryOlvaRequest } from "../../shared/utils/should-retry-olva-request";
import { olvaCatalogKeys } from "../keys/olva-catalog.keys";
import {
  getOlvaArticleCategories,
  getOlvaHeadquarters,
  getOlvaStandardSizes,
  getOlvaUbigeos,
} from "../services/olva-catalog.service";

// queryOptions() keeps key + fn + cache policy together, typed once: hooks, prefetch
// (`queryClient.prefetchQuery(olvaCatalogQueries.headquarters())`) and tests all reuse them.
const referenceData = {
  staleTime: OLVA_REFERENCE_DATA_STALE_TIME_MS,
  retry: shouldRetryOlvaRequest,
} as const;

export const olvaCatalogQueries = {
  headquarters: () =>
    queryOptions({
      queryKey: olvaCatalogKeys.headquarters(),
      queryFn: getOlvaHeadquarters,
      ...referenceData,
    }),

  articleCategories: () =>
    queryOptions({
      queryKey: olvaCatalogKeys.articleCategories(),
      queryFn: getOlvaArticleCategories,
      ...referenceData,
    }),

  standardSizes: () =>
    queryOptions({
      queryKey: olvaCatalogKeys.standardSizes(),
      queryFn: getOlvaStandardSizes,
      ...referenceData,
    }),

  ubigeos: () =>
    queryOptions({
      queryKey: olvaCatalogKeys.ubigeos(),
      queryFn: getOlvaUbigeos,
      ...referenceData,
    }),
};
