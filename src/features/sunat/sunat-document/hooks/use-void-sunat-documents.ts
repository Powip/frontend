import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type VoidSunatDocumentsRequestDto,
  voidSunatDocumentsApi,
} from "../api/sunat-document.api";
import { sunatDocumentKeys } from "../keys/sunat-document.keys";
import { toSunatDocument } from "../mappers/to-sunat-document.mapper";
import type { SunatDocument } from "../models/sunat-document.model";

/** Asks SUNAT to void (dar de baja) facturas or notas of serie F. */
export function useVoidSunatDocuments() {
  const queryClient = useQueryClient();

  return useMutation<SunatDocument[], Error, VoidSunatDocumentsRequestDto>({
    mutationFn: async (request) => (await voidSunatDocumentsApi(request)).map(toSunatDocument),

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["business-tax-documents"] }),
        queryClient.invalidateQueries({ queryKey: sunatDocumentKeys.all }),
      ]);
    },
  });
}
