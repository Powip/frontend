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
import {
  waButton,
  waDialogBody,
  waDialogContent,
  waDialogFooter,
  waDialogHeader,
  waDialogTitle,
} from "@/components/whatsapp/ui/wa-classes";
import { cn } from "@/lib/utils";

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
        <Button
          type="button"
          className={waButton({ size: "sm" })}
          onClick={() => setConfirmOpen(true)}
        >
          Descartar cambios
        </Button>
        <BlockedActionButton
          className={waButton({ variant: "primary", size: "sm" })}
          blocked={blocked || !onSave}
          blockedReasonId={blockedReasonId}
          onClick={() => onSave?.()}
        >
          {saveLabel}
        </BlockedActionButton>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className={cn(waDialogContent, "sm:max-w-[440px]")}>
          <AlertDialogHeader className={waDialogHeader}>
            <AlertDialogTitle className={waDialogTitle}>{discardTitle}</AlertDialogTitle>
          </AlertDialogHeader>
          <div className={waDialogBody}>
            <AlertDialogDescription className="m-0 text-sm text-wa-muted">
              Los cambios no guardados se perderán.
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter className={waDialogFooter}>
            <AlertDialogCancel className={waButton()}>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              className={waButton({ variant: "solid-danger" })}
              onClick={onConfirmDiscard}
            >
              Descartar cambios
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
