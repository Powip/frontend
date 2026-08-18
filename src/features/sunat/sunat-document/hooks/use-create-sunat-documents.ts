import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { CreateSunatDocumentsRequestDto } from "../dto/create-sunat-documents-request.dto";
import { sunatDocumentKeys } from "../keys/sunat-document.keys";
import {
  type CreateSunatDocumentsResult,
  createSunatDocuments,
} from "../services/create-sunat-documents.service";

export function useCreateSunatDocuments() {
  const queryClient = useQueryClient();

  return useMutation<CreateSunatDocumentsResult, Error, CreateSunatDocumentsRequestDto>({
    mutationFn: createSunatDocuments,

    onSuccess: async ({ documents }) => {
      for (const document of documents) {
        queryClient.setQueryData(sunatDocumentKeys.detail(document.id), document);
      }

      await queryClient.invalidateQueries({
        queryKey: sunatDocumentKeys.lists(),
      });
    },
  });
}
