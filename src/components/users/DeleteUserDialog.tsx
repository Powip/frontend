"use client";

import { useId } from "react";
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
import type { User } from "@/interfaces/IUser";
import { PendingBackendNotice } from "./PendingBackendNotice";

interface DeleteUserDialogProps {
  user: User | null;
  onOpenChange: (open: boolean) => void;
}

export function DeleteUserDialog({ user, onOpenChange }: DeleteUserDialogProps) {
  const noticeId = `${useId()}-pending`;
  const fullName = user ? `${user.name} ${user.surname}`.trim() : "";

  return (
    <AlertDialog open={!!user} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <AlertDialogHeader className="min-w-0">
          <AlertDialogTitle className="break-words">¿Eliminar a {fullName}?</AlertDialogTitle>
          <AlertDialogDescription>Todavía no se pueden eliminar usuarios desde esta pantalla.</AlertDialogDescription>
        </AlertDialogHeader>
        <PendingBackendNotice id={noticeId} title="Eliminación todavía no habilitada">
          Estamos definiendo qué pasa con el historial del colaborador al darlo de baja.
        </PendingBackendNotice>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled aria-describedby={noticeId}>
            Eliminar usuario
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
