import { useQuery } from "@tanstack/react-query";
import type { GetSunatDocumentSequenceQuery } from "../dto/get-sunat-document-sequence.query";
import { sunatDocumentSequenceKeys } from "../keys/sunat-document-sequence.keys";
import type { SunatDocumentSequence } from "../models/sunat-document-sequence";
import { getSunatDocumentSequence } from "../services/sunat-document-sequence.service";

export function useSunatDocumentSequence(query: GetSunatDocumentSequenceQuery) {
  return useQuery<SunatDocumentSequence | null, Error>({
    queryKey: sunatDocumentSequenceKeys.detail(query.taxDocumentType, query.series),
    queryFn: () => getSunatDocumentSequence(query),
  });
}
