import { useMutation, UseMutationResult, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as service from "@/services/sunat/sunat-document.service";
import { sunatDocumentKeys } from "@/api/sunat/keys/sunat-documents.keys";
import {
  CreateManualInvoiceResponseDto,
} from "@/api/sunat/dto/sunat-document.dto";
import { CreateManualInvoiceInput } from "@/schemas/sunat/create-manual-invoice.schema";

export function useCreateManualInvoice(): UseMutationResult<
  CreateManualInvoiceResponseDto,
  Error,
  CreateManualInvoiceInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: service.createManualInvoice,

    onSuccess: (response) => {
      queryClient.invalidateQueries({
        queryKey: sunatDocumentKeys.lists(),
      });

      if (response.success) {
        toast.success(
          response.message || "Comprobante generado correctamente."
        );
      } else {
        toast.error(
          response.message || "El comprobante fue rechazado por SUNAT."
        );
      }
    },

    onError(error: Error) {
      toast.error(error.message);
    },
  });
}
