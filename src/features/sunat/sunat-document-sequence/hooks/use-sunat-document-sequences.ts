import { useQuery } from "@tanstack/react-query";
import { sunatDocumentSequenceKeys } from "../keys/sunat-document-sequence.keys";
import type { SunatDocumentSequence } from "../models/sunat-document-sequence";
import { getSunatDocumentSequences } from "../services/sunat-document-sequence.service";

/**
 * Sequences of one SUNAT issuer (RUC). `sunatProfileId` omitted = the
 * company's default profile, which is what single-RUC companies use.
 */
export function useSunatDocumentSequences(
  sunatProfileId?: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery<SunatDocumentSequence[], Error>({
    queryKey: sunatDocumentSequenceKeys.list(sunatProfileId),
    queryFn: () => getSunatDocumentSequences(sunatProfileId),
    enabled: options.enabled ?? true,
  });
}
