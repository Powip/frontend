import type { ListSunatDocumentsQueryDto } from "../dto/list-sunat-documents-query.dto";

export const sunatDocumentKeys = {
  all: ["sunat-documents"] as const,

  lists: () => [...sunatDocumentKeys.all, "list"] as const,

  list: (filters: ListSunatDocumentsQueryDto) => [...sunatDocumentKeys.lists(), filters] as const,

  details: () => [...sunatDocumentKeys.all, "detail"] as const,

  detail: (id: string) => [...sunatDocumentKeys.details(), id] as const,
};
