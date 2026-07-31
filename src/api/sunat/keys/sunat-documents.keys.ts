export const sunatDocumentKeys = {
  all: ["sunat-documents"] as const,

  lists: () => [...sunatDocumentKeys.all, "list"] as const,

  list: (filters?: unknown) =>
    [...sunatDocumentKeys.lists(), filters] as const,

  details: () => [...sunatDocumentKeys.all, "detail"] as const,

  detail: (externalId: string) =>
    [...sunatDocumentKeys.details(), externalId] as const,

  generateManual: () =>
    [...sunatDocumentKeys.all, "generate-manual"] as const,
};
