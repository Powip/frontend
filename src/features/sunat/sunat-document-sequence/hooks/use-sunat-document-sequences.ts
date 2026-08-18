import { useQuery } from "@tanstack/react-query";
import { sunatDocumentSequenceKeys } from "../keys/sunat-document-sequence.keys";
import type { SunatDocumentSequence } from "../models/sunat-document-sequence";
import { getSunatDocumentSequences } from "../services/sunat-document-sequence.service";

export function useSunatDocumentSequences() {
  return useQuery<SunatDocumentSequence[], Error>({
    queryKey: sunatDocumentSequenceKeys.all,
    queryFn: getSunatDocumentSequences,
  });
}
