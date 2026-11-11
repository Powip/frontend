"use client";

import { Loader2 } from "lucide-react";
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
import { buttonVariants } from "@/components/ui/buttonVariant";
import { useDeleteSunatProfile } from "@/features/sunat/sunat-profile/hooks/use-delete-sunat-profile";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";

interface DeleteSunatProfileDialogProps {
  /** The certificate profile to delete. `null` closes the dialog. */
  profile: SunatProfile | null;
  /**
   * True when `profile` is the default one and the company has other
   * profiles: the backend refuses that case (409), so the confirm button is
   * disabled up front and the user is told what to do first.
   */
  blockedByDefault: boolean;
  /** True when `profile` is the company's only certificate. */
  isOnlyProfile: boolean;
  onClose: () => void;
}

export function DeleteSunatProfileDialog({
  profile,
  blockedByDefault,
  isOnlyProfile,
  onClose,
}: DeleteSunatProfileDialogProps) {
  const deleteProfile = useDeleteSunatProfile();

  function handleConfirm() {
    if (!profile) {
      return;
    }

    deleteProfile.mutate(profile.id, { onSuccess: onClose });
  }

  return (
    <AlertDialog
      open={profile !== null}
      onOpenChange={(open) => {
        if (!open && !deleteProfile.isPending) {
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar certificado</AlertDialogTitle>

          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Se eliminará de forma definitiva el certificado de{" "}
                <span className="font-semibold">{profile?.razonSocial}</span> (RUC {profile?.ruc}),
                junto con el usuario y la clave SOL guardados en este perfil. No se puede deshacer.
                Los comprobantes ya emitidos no se ven afectados, pero mientras no subas otro
                certificado para este RUC no se podrán emitir ni enviar comprobantes con él.
              </p>

              {blockedByDefault && (
                <p className="font-medium text-amber-600 dark:text-amber-500">
                  Este es el certificado predeterminado. Marca otro certificado como predeterminado
                  antes de eliminarlo.
                </p>
              )}

              {!blockedByDefault && profile?.isDefault && isOnlyProfile && (
                <p className="font-medium text-amber-600 dark:text-amber-500">
                  Es tu único certificado: quedarás sin certificado hasta que subas uno nuevo.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteProfile.isPending}>Cancelar</AlertDialogCancel>

          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            disabled={blockedByDefault || deleteProfile.isPending}
            onClick={(event) => {
              // Keep the dialog open (with the spinner) until the mutation
              // settles instead of Radix closing it on click.
              event.preventDefault();
              handleConfirm();
            }}
          >
            {deleteProfile.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Eliminando...
              </>
            ) : (
              "Eliminar"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
