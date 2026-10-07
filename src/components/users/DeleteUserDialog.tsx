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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar a {fullName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Todavía no se pueden eliminar usuarios desde esta pantalla.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <PendingBackendNotice
          id={noticeId}
          title="Eliminación todavía no habilitada"
        >
          Estamos definiendo qué pasa con el historial del colaborador al darlo de baja. Mientras tanto no se elimina
          ningún usuario.
        </PendingBackendNotice>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <button
            type="button"
            disabled
            aria-describedby={noticeId}
            className="inline-flex h-9 items-center justify-center rounded-md bg-[#ef4444] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Eliminar usuario
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
