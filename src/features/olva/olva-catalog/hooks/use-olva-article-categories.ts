import { useQuery } from "@tanstack/react-query";
import { olvaCatalogQueries } from "../queries/olva-catalog.queries";

export function useOlvaArticleCategories() {
  return useQuery(olvaCatalogQueries.articleCategories());
}
