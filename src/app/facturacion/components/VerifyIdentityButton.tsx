"use client";

import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  IDENTITY_LOOKUP_DOCUMENT_TYPES,
  type IdentityLookupDocumentType,
} from "@/features/identity-lookup/enums/identity-lookup.enums";
import { useLookupIdentity } from "@/features/identity-lookup/hooks/use-lookup-identity";
import type { IdentityLookupResult } from "@/features/identity-lookup/models/identity-lookup-result.model";
import { getIdentityLookupErrorMessage } from "@/features/identity-lookup/utils/identity-lookup-error.util";
import {
  isValidDniFormat,
  isValidRucFormat,
} from "@/features/identity-lookup/utils/identity-lookup-format.util";
import { cn } from "@/lib/utils";

interface VerifyIdentityButtonProps {
  /**
   * `null` means the currently selected document type has no lookup
   * provider at all (Carnet de Extranjería, Pasaporte) - see
   * toIdentityLookupDocumentType. This is a permanent, structural gap
   * (RENIEC/SUNAT simply don't expose a registry for those documents),
   * not a "coming soon" feature - so it's rendered as a disabled state
   * with an explanatory tooltip, not borrowed from ProximamenteButton
   * (whose whole premise is "not built yet").
   */
  documentType: IdentityLookupDocumentType | null;
  documentNumber: string | null | undefined;
  onVerified: (result: IdentityLookupResult) => void;
  className?: string;
}

/**
 * Presentational + self-contained data component: it owns its own
 * mutation and toast feedback, and only reports upward via `onVerified`.
 * Deliberately has no dependency on react-hook-form or any particular
 * modal, so it can be dropped into any future form that needs the same
 * "look this document up" action, and can be developed/tested in
 * isolation in Storybook.
 */
export function VerifyIdentityButton({
  documentType,
  documentNumber,
  onVerified,
  className,
}: VerifyIdentityButtonProps) {
  const lookupIdentity = useLookupIdentity();

  const normalizedNumber = (documentNumber ?? "").trim();

  const isFormatValid =
    documentType !== null &&
    (documentType === IDENTITY_LOOKUP_DOCUMENT_TYPES.DNI
      ? isValidDniFormat(normalizedNumber)
      : isValidRucFormat(normalizedNumber));

  const isDisabled = documentType === null || !isFormatValid || lookupIdentity.isPending;

  const disabledReason =
    documentType === null
      ? "Este tipo de documento no tiene verificación automática disponible (solo DNI y RUC)."
      : !isFormatValid
        ? `Ingresa un ${documentType} válido (${documentType === IDENTITY_LOOKUP_DOCUMENT_TYPES.DNI ? "8" : "11"} dígitos) para verificar.`
        : null;

  function handleClick() {
    // Re-checking here (rather than relying on `isDisabled` alone) is what
    // lets TypeScript narrow `documentType` to non-null for the rest of
    // this function, with no cast/assertion needed - narrowing performed
    // in the component body above doesn't carry into this nested closure,
    // but a guard written directly inside it does.
    if (!documentType || !isFormatValid) {
      return;
    }

    lookupIdentity.mutate(
      { documentType, documentNumber: normalizedNumber },
      {
        onSuccess: (result) => {
          onVerified(result);
          toast.success(`Datos encontrados: ${result.fullName}`);
        },
        onError: (error) => {
          toast.error(getIdentityLookupErrorMessage(error));
        },
      },
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDisabled}
              onClick={handleClick}
              className={cn(isDisabled && "cursor-not-allowed opacity-60", className)}
            >
              {lookupIdentity.isPending ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-3.5 w-3.5" />
                  Verificar RENIEC / SUNAT
                </>
              )}
            </Button>
          </span>
        </TooltipTrigger>

        <TooltipContent>
          {disabledReason ??
            `Buscar en ${documentType === IDENTITY_LOOKUP_DOCUMENT_TYPES.DNI ? "RENIEC" : "SUNAT"} por ${documentType}.`}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
