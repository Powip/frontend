import { type UseMutationResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { releaseSunatIssuerAccessBlockApi } from "../api/sunat-issuer-access.api";
import type {
  ReleaseSunatIssuerAccessBlockRequestDto,
  ReleaseSunatIssuerAccessBlockResponseDto,
} from "../dto/sunat-issuer-access-block-response.dto";
import { sunatIssuerAccessKeys } from "../keys/sunat-issuer-access.keys";

/**
 * "Ya lo corregí en SUNAT": sends the waiting documents again, each with the
 * number it already had. If SUNAT still refuses, the block comes back with
 * SUNAT's latest answer, so trying burns no numbers.
 */
export function useReleaseSunatIssuerAccessBlock(): UseMutationResult<
  ReleaseSunatIssuerAccessBlockResponseDto,
  Error,
  ReleaseSunatIssuerAccessBlockRequestDto
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: releaseSunatIssuerAccessBlockApi,

    onSuccess: ({ resumedDocuments }) => {
      queryClient.invalidateQueries({ queryKey: sunatIssuerAccessKeys.all });
      queryClient.invalidateQueries({ queryKey: ["business-tax-documents"] });

      toast.success(
        resumedDocuments === 1
          ? "Se reenvió 1 comprobante con su mismo número. Si SUNAT sigue sin autorizarlo, este aviso volverá a aparecer."
          : `Se reenviaron ${resumedDocuments} comprobantes con su mismo número. Si SUNAT sigue sin autorizarlos, este aviso volverá a aparecer.`,
      );
    },

    onError: () => {
      toast.error("No se pudo reenviar. Intenta nuevamente en unos minutos.");
    },
  });
}
