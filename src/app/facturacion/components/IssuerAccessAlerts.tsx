"use client";

import { AlertTriangle } from "lucide-react";
import { IssuerAccessExplanation } from "@/app/facturacion/components/IssuerAccessExplanation";
import { Button } from "@/components/ui/button";
import type { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";
import { useReleaseSunatIssuerAccessBlock } from "@/features/sunat/sunat-issuer-access/hooks/use-release-sunat-issuer-access-block";
import { useSunatIssuerAccessBlocks } from "@/features/sunat/sunat-issuer-access/hooks/use-sunat-issuer-access-blocks";
import { getDocumentTypePlural } from "@/features/sunat/sunat-issuer-access/utils/issuer-access-errors";
import { findAcceptedTypesOfIssuer } from "@/features/sunat/sunat-issuer-access/utils/issuer-access-status";

interface IssuerAccessAlertsProps {
  /** Sales with their documents: used to tell which types SUNAT does accept. */
  rows: TaxDocumentRow[];
}

/**
 * One alert per RUC and document type SUNAT is refusing. It says exactly
 * what fails (e.g. invoices), what does work (e.g. sales receipts), why,
 * and how to send the waiting documents once it is fixed.
 */
export function IssuerAccessAlerts({ rows }: IssuerAccessAlertsProps) {
  const { data: blocks = [] } = useSunatIssuerAccessBlocks();
  const release = useReleaseSunatIssuerAccessBlock();

  return blocks.map((block) => {
    const typePlural = getDocumentTypePlural(block.taxDocumentType);
    const issuerName = block.razonSocial ?? `RUC ${block.rucIssuer}`;
    const acceptedTypes = findAcceptedTypesOfIssuer(rows, block);

    return (
      <div
        key={`${block.rucIssuer}-${block.taxDocumentType}`}
        role="alert"
        className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm dark:border-red-900 dark:bg-red-950/40"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />

        <div className="space-y-2">
          <p className="font-semibold">
            SUNAT no está aceptando las {typePlural} de {issuerName}
            {block.razonSocial && <> (RUC {block.rucIssuer})</>}. No es un problema de los
            comprobantes.
          </p>

          <IssuerAccessExplanation
            sunatCode={block.sunatCode}
            sunatMessage={block.sunatMessage}
            solUser={block.solUser}
            category={block.category}
          />

          {acceptedTypes.map(({ taxDocumentType, lastNumber }) => (
            <p key={taxDocumentType}>
              SUNAT sí está aceptando las {getDocumentTypePlural(taxDocumentType)} de este RUC
              (última aceptada: {lastNumber}). El problema es solo con las {typePlural}.
            </p>
          ))}

          <p>
            {block.heldDocuments === 1
              ? "Hay 1 comprobante en espera. Conserva su número y no se ha enviado."
              : `Hay ${block.heldDocuments} comprobantes en espera. Conservan su número y no se han enviado.`}
          </p>

          <Button
            size="sm"
            variant="outline"
            disabled={release.isPending || !block.sunatProfileId}
            onClick={() => {
              if (block.sunatProfileId) {
                release.mutate({
                  sunatProfileId: block.sunatProfileId,
                  taxDocumentType: block.taxDocumentType,
                });
              }
            }}
          >
            Ya lo corregí en SUNAT — reenviar {typePlural}
          </Button>
        </div>
      </div>
    );
  });
}
