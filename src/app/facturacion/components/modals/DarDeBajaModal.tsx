"use client";

import axios from "axios";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useVoidSunatDocuments } from "@/features/sunat/sunat-document/hooks/use-void-sunat-documents";
import type { SunatDocument } from "@/features/sunat/sunat-document/models/sunat-document.model";
import { formatVoidDeadline } from "@/features/sunat/sunat-document/utils/void-status";

/** Same limit as ms-sunat-tax-documents (SUNAT_VOID_REASON_MAX_LENGTH). */
export const VOID_REASON_MAX_LENGTH = 100;

function documentLabel(document: SunatDocument): string {
  const kind =
    document.taxDocumentType === "07"
      ? "Nota de crédito"
      : document.taxDocumentType === "08"
        ? "Nota de débito"
        : "Factura";
  return `${kind} ${document.series}-${document.correlative}`;
}

function voidErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.length > 0) return message;
    if (Array.isArray(message) && message.length > 0) return message.join(". ");
  }
  return "No se pudo pedir la baja. Intenta nuevamente.";
}

interface DarDeBajaModalProps {
  /** Document to void; null closes the modal. */
  document: SunatDocument | null;
  onClose: () => void;
}

/**
 * Comunicación de baja (RA) of a factura or nota of serie F: asks for the reason and for confirmation
 * that it cannot be undone. SUNAT answers later; meanwhile the document shows "Baja en proceso".
 */
export function DarDeBajaModal({ document, onClose }: DarDeBajaModalProps) {
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const { mutateAsync, isPending } = useVoidSunatDocuments();

  useEffect(() => {
    if (document) {
      setReason("");
      setConfirmed(false);
    }
  }, [document]);

  const trimmed = reason.trim();
  const canSubmit = Boolean(document) && trimmed.length > 0 && confirmed && !isPending;

  const submit = async () => {
    if (!document || !canSubmit) return;

    try {
      await mutateAsync({ documentIds: [document.id], reason: trimmed });
      toast.success(`Baja de ${document.series}-${document.correlative} enviada a SUNAT`);
      onClose();
    } catch (error) {
      toast.error(voidErrorMessage(error));
    }
  };

  return (
    <Dialog open={document !== null} onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dar de baja</DialogTitle>
          <DialogDescription>
            {document ? documentLabel(document) : ""} · se envía a SUNAT una comunicación de baja.
          </DialogDescription>
        </DialogHeader>

        {document && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground" data-testid="baja-plazo">
              Plazo hasta el <strong>{formatVoidDeadline(document.voidDeadline)}</strong> (7 días
              desde su emisión).
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="baja-motivo">Motivo de la baja</Label>
              <Textarea
                id="baja-motivo"
                value={reason}
                maxLength={VOID_REASON_MAX_LENGTH}
                placeholder="Ej.: Nota de crédito emitida por duplicado"
                onChange={(event) => setReason(event.target.value)}
                disabled={isPending}
              />
              <p className="text-right text-[11px] text-muted-foreground">
                {reason.length}/{VOID_REASON_MAX_LENGTH}
              </p>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                La baja no se puede deshacer. Si SUNAT la acepta, el comprobante deja de tener
                validez y ya no cuenta en el saldo.
              </span>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="baja-confirmar"
                checked={confirmed}
                onCheckedChange={(value) => setConfirmed(value === true)}
                disabled={isPending}
              />
              <Label htmlFor="baja-confirmar" className="text-sm font-normal leading-snug">
                Entiendo que la baja es irreversible.
              </Label>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={submit} disabled={!canSubmit}>
            {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Dar de baja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
