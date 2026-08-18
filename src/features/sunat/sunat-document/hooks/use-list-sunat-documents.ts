import { useQuery } from "@tanstack/react-query";

import type { ListSunatDocumentsQueryDto } from "../dto/list-sunat-documents-query.dto";
import { sunatDocumentKeys } from "../keys/sunat-document.keys";
import { listSunatDocuments } from "../services/list-sunat-documents.service";

export function useListSunatDocuments(query: ListSunatDocumentsQueryDto = {}) {
  return useQuery({
    queryKey: sunatDocumentKeys.list(query),
    queryFn: () => listSunatDocuments(query),
  });
}
