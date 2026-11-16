"use client";

import { AlertTriangle } from "lucide-react";
import { IssuerAccessExplanation } from "@/app/facturacion/components/IssuerAccessExplanation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";
import { findSunatError } from "@/features/sunat/sunat-document/utils/find-sunat-error";
import { useReleaseSunatIssuerAccessBlock } from "@/features/sunat/sunat-issuer-access/hooks/use-release-sunat-issuer-access-block";
import { useSunatIssuerAccessBlocks } from "@/features/sunat/sunat-issuer-access/hooks/use-sunat-issuer-access-blocks";
import { getDocumentTypePlural } from "@/features/sunat/sunat-issuer-access/utils/issuer-access-errors";
import {
  findBlockForDocument,
  getIssuerAccessState,
} from "@/features/sunat/sunat-issuer-access/utils/issuer-access-status";

interface RechazadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: TaxDocumentRow | null;
  onReintentar: (row: TaxDocumentRow) => void;
}

export default function RechazadoModal({
  isOpen,
  onClose,
  row,
  onReintentar,
}: RechazadoModalProps) {
  const { data: blocks = [] } = useSunatIssuerAccessBlocks();
  const release = useReleaseSunatIssuerAccessBlock();

  if (!row) {
    return null;
  }

  const { sale, taxDocument } = row;

  const accessState = getIssuerAccessState(blocks, taxDocument);
  const block = findBlockForDocument(blocks, taxDocument);

  // SUNAT refused the issuer (SOL user / RUC), not this document: there is
  // nothing to correct in the document, so the generic "corregir y
  // reintentar" would only spend another number and fail the same way.
  if (accessState && taxDocument) {
    const documentNumber = `${taxDocument.series}-${taxDocument.correlative}`;
    const typePlural = getDocumentTypePlural(taxDocument.taxDocumentType);

    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              SUNAT no autorizó el envío
            </DialogTitle>

            <DialogDescription>
              Venta: <span className="font-bold text-foreground">{sale.orderNumber}</span>
              {" — "}
              {documentNumber}
              {" — "}
              S/ {Number(sale.grandTotal).toFixed(2)}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/40">
            <IssuerAccessExplanation
              sunatCode={taxDocument.sunatCode}
              sunatMessage={taxDocument.sunatDescription}
              solUser={block?.solUser}
              category={block?.category}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            {accessState === "WAITING"
              ? `El comprobante no tiene errores. Está en espera con su número ${documentNumber} y se enviará cuando SUNAT autorice las ${typePlural} de este RUC.`
              : "El comprobante no tiene errores, pero este intento ya no se reenvía solo. Cuando lo corrijas en SUNAT, vuelve a emitirlo: usará un número nuevo."}
          </p>

          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>
              Cerrar
            </Button>

            {accessState === "WAITING" ? (
              <Button
                disabled={release.isPending || !block?.sunatProfileId}
                onClick={() => {
                  if (block?.sunatProfileId) {
                    release.mutate({
                      sunatProfileId: block.sunatProfileId,
                      taxDocumentType: block.taxDocumentType,
                    });
                    onClose();
                  }
                }}
                className="bg-primary text-white hover:bg-primary/90"
              >
                Ya lo corregí en SUNAT — reenviar
              </Button>
            ) : (
              <Button
                onClick={() => {
                  onClose();
                  onReintentar(row);
                }}
                className="bg-primary text-white hover:bg-primary/90"
              >
                Ya lo corregí — volver a emitir
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const catalogado = findSunatError(
    taxDocument?.sunatCode ?? null,
    taxDocument?.sunatDescription ?? null,
  );

  const errorMessage =
    taxDocument?.observations || taxDocument?.sunatDescription || "SUNAT rechazó el comprobante";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Comprobante Rechazado
          </DialogTitle>

          <DialogDescription>
            Venta: <span className="font-bold text-foreground">{sale.orderNumber}</span>
            {" — "}
            {sale.customer.fullName}
            {" — "}
            S/ {Number(sale.grandTotal).toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/40">
          <div className="font-bold text-red-600 dark:text-red-400">{errorMessage}</div>

          {catalogado && (
            <div className="mt-1 text-red-800 dark:text-red-300">
              <b>Solución sugerida:</b> {catalogado.sol}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>

          <Button
            onClick={() => {
              onClose();
              onReintentar(row);
            }}
            className="bg-primary text-white hover:bg-primary/90"
          >
            Corregir y reintentar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
