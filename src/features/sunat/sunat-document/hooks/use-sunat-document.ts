import { useQuery } from "@tanstack/react-query";

import { sunatDocumentKeys } from "../keys/sunat-document.keys";
import { getSunatDocument } from "../services/get-sunat-document.service";

export function useSunatDocument(id: string) {
  return useQuery({
    queryKey: sunatDocumentKeys.detail(id),
    queryFn: () => getSunatDocument(id),
    enabled: Boolean(id),
  });
}
