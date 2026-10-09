"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";

interface FormDraftActionsProps {
  isDirty: boolean;
  blocked: boolean;
  blockedReasonId: string;
  saveLabel: string;
  discardTitle: string;
  onConfirmDiscard: () => void;
  onSave?: () => void;
}

export function FormDraftActions({
  isDirty,
  blocked,
  blockedReasonId,
  saveLabel,
  discardTitle,
  onConfirmDiscard,
  onSave,
}: FormDraftActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  if (!isDirty) return null;
  return (
    <>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
          Descartar cambios
        </Button>
        <BlockedActionButton
          size="sm"
          blocked={blocked || !onSave}
          blockedReasonId={blockedReasonId}
          onClick={() => onSave?.()}
        >
          {saveLabel}
        </BlockedActionButton>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{discardTitle}</AlertDialogTitle>
            <AlertDialogDescription>Los cambios no guardados se perderán.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmDiscard}>Descartar cambios</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
