export const olvaCatalogKeys = {
  all: ["olva-catalog"] as const,

  headquarters: () => [...olvaCatalogKeys.all, "headquarters"] as const,

  articleCategories: () => [...olvaCatalogKeys.all, "article-categories"] as const,

  standardSizes: () => [...olvaCatalogKeys.all, "standard-sizes"] as const,

  ubigeos: () => [...olvaCatalogKeys.all, "ubigeos"] as const,
};
