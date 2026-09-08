import { useMutation, useQueryClient } from "@tanstack/react-query";
import { salesKeys } from "@/features/sales/keys/sales.keys";
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
      // 1. Manually update detail cache for each emitted document
      for (const document of documents) {
        queryClient.setQueryData(sunatDocumentKeys.detail(document.id), document);
      }

      // 2. Invalidate ALL list queries under both SUNAT documents and Sales
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: sunatDocumentKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey: salesKeys.all,
        }),
      ]);
    },
  });
}
