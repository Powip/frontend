"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";
import { decodeHtmlEntities } from "@/features/sunat/sunat-document/utils/decode-html-entities";
import { findSunatError } from "@/features/sunat/sunat-document/utils/find-sunat-error";
import { useReleaseSunatIssuerAccessBlock } from "@/features/sunat/sunat-issuer-access/hooks/use-release-sunat-issuer-access-block";
import { useSunatIssuerAccessBlocks } from "@/features/sunat/sunat-issuer-access/hooks/use-sunat-issuer-access-blocks";
import { getDocumentTypePlural } from "@/features/sunat/sunat-issuer-access/utils/issuer-access-errors";
import {
  findBlockForDocument,
  getIssuerAccessState,
} from "@/features/sunat/sunat-issuer-access/utils/issuer-access-status";
import { useSunatProfiles } from "@/features/sunat/sunat-profile/hooks/use-sunat-profiles";
import { useUpdateSunatProfileEstablishmentCode } from "@/features/sunat/sunat-profile/hooks/use-update-sunat-profile-establishment-code";
import {
  ESTABLISHMENT_CODE_ERROR,
  isValidEstablishmentCode,
} from "@/features/sunat/sunat-profile/utils/establishment-code";

/**
 * SUNAT error 3030: el emisor no tiene código de establecimiento. Se corrige
 * aquí mismo, sin ir a Emisores (RUC), y después se vuelve a emitir.
 */
function EstablishmentCodeFix({ rucIssuer, onSaved }: { rucIssuer: string; onSaved: () => void }) {
  const { data: profiles = [], isLoading } = useSunatProfiles();
  const update = useUpdateSunatProfileEstablishmentCode();
  const profile = profiles.find((item) => item.ruc === rucIssuer);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setCode(profile.establishmentCode.trim() || "0000");
    }
  }, [profile]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando emisor…</p>;
  }

  if (!profile) {
    return (
      <p className="text-sm text-red-600">No encontramos el RUC {rucIssuer} entre tus emisores.</p>
    );
  }

  const handleSave = () => {
    const value = code.trim();

    if (!isValidEstablishmentCode(value)) {
      setError(ESTABLISHMENT_CODE_ERROR);
      return;
    }

    update.mutate({ id: profile.id, establishmentCode: value }, { onSuccess: onSaved });
  };

  return (
    <div className="space-y-2 rounded-lg border p-3 text-sm">
      <Label htmlFor="rechazado-establishment-code">Código de establecimiento del emisor</Label>
      <div className="flex items-center gap-2">
        <Input
          id="rechazado-establishment-code"
          value={code}
          inputMode="numeric"
          maxLength={4}
          placeholder="0000"
          aria-invalid={error !== null}
          className="w-28"
          onChange={(event) => {
            setCode(event.target.value.replace(/\D/g, ""));
            setError(null);
          }}
        />
        <Button
          className="bg-primary text-white hover:bg-primary/90"
          disabled={update.isPending}
          onClick={handleSave}
        >
          Guardar código y volver a emitir
        </Button>
      </div>
      {error ? (
        <p className="text-red-600">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">4 dígitos. Usa 0000 si es la casa matriz.</p>
      )}
    </div>
  );
}

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
              sunatMessage={
                taxDocument.sunatDescription
                  ? decodeHtmlEntities(taxDocument.sunatDescription)
                  : null
              }
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

  const errorMessage = decodeHtmlEntities(
    taxDocument?.observations || taxDocument?.sunatDescription || "SUNAT rechazó el comprobante",
  );

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
          <div className="font-bold text-red-600 dark:text-red-400">
            {catalogado ? catalogado.desc : errorMessage}
          </div>

          {catalogado && (
            <>
              <div className="mt-1 text-red-800 dark:text-red-300">
                <b>Solución sugerida:</b> {catalogado.sol}
              </div>

              <div className="mt-2 break-words text-xs text-muted-foreground">
                Detalle de SUNAT: {errorMessage}
              </div>
            </>
          )}
        </div>

        {catalogado?.code === "3030" && taxDocument?.rucIssuer && (
          <EstablishmentCodeFix
            rucIssuer={taxDocument.rucIssuer}
            onSaved={() => {
              onClose();
              onReintentar(row);
            }}
          />
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>

          {catalogado?.code !== "3030" && (
            <Button
              onClick={() => {
                onClose();
                onReintentar(row);
              }}
              className="bg-primary text-white hover:bg-primary/90"
            >
              Corregir y reintentar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
