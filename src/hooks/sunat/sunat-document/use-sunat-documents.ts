import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { sunatDocumentKeys } from "@/api/sunat/keys/sunat-documents.keys";
import * as service from "@/services/sunat/sunat-document.service";
import { SunatDocument } from "@/models/sunat/sunat-document";

/**
 * Comprobantes SUNAT de la compañía autenticada. El scope viene del JWT
 * en el backend (@CurrentUser('companyId')), por eso no recibe storeId
 * ni companyId como parámetro.
 */
export function useSunatDocuments(): UseQueryResult<SunatDocument[], Error> {
  return useQuery({
    queryKey: sunatDocumentKeys.lists(),
    queryFn: service.getSunatDocumentsByCompany,
  });
}
