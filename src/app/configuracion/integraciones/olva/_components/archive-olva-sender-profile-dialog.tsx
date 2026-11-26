"use client";

import { Loader2 } from "lucide-react";
import type { MouseEvent } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useArchiveOlvaSenderProfile } from "@/features/olva/olva-sender-profile/hooks/use-archive-olva-sender-profile";
import type { OlvaSenderProfile } from "@/features/olva/olva-sender-profile/models/olva-sender-profile";

interface ArchiveOlvaSenderProfileDialogProps {
  /** The profile waiting for confirmation; null keeps the dialog closed. */
  profile: OlvaSenderProfile | null;
  onOpenChange: (open: boolean) => void;
}

export function ArchiveOlvaSenderProfileDialog({
  profile,
  onOpenChange,
}: ArchiveOlvaSenderProfileDialogProps) {
  const { mutate, reset, isPending } = useArchiveOlvaSenderProfile();

  function handleOpenChange(nextOpen: boolean) {
    // Closing mid-request would hide the outcome from the user
    if (!nextOpen && isPending) return;

    if (!nextOpen) reset();

    onOpenChange(nextOpen);
  }

  function handleConfirm(event: MouseEvent<HTMLButtonElement>) {
    // Radix closes the dialog on action click; keep it open until the request settles
    event.preventDefault();

    if (!profile) return;

    mutate(profile.id, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <AlertDialog open={profile !== null} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar remitente</AlertDialogTitle>
          <AlertDialogDescription>
            {profile ? `“${profile.label}” (RUC ${profile.ruc}) ` : ""}dejará de estar disponible
            para generar guías con Olva. Las guías que ya registraste con este remitente no se
            modifican.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 aria-hidden="true" className="animate-spin" />
                Eliminando...
              </>
            ) : (
              "Eliminar"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
