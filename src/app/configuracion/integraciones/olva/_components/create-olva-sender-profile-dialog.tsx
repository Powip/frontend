"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateOlvaSenderProfileForm } from "@/features/olva/olva-sender-profile/hooks/use-create-olva-sender-profile-form";
import { useOlvaSenderProfiles } from "@/features/olva/olva-sender-profile/hooks/use-olva-sender-profiles";
import { isFirstOlvaSenderProfile } from "@/features/olva/olva-sender-profile/utils/olva-sender-profile-permissions";
import { CreateOlvaSenderProfileForm } from "./create-olva-sender-profile-form";

interface CreateOlvaSenderProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateOlvaSenderProfileDialog({
  open,
  onOpenChange,
}: CreateOlvaSenderProfileDialogProps) {
  // Same query as the profiles list, so this reuses its cache instead of fetching again
  const { data: existingProfiles } = useOlvaSenderProfiles();
  const isFirstProfile = isFirstOlvaSenderProfile(existingProfiles);

  const { form, submit, reset, isSubmitting } = useCreateOlvaSenderProfileForm({
    onSuccess: () => onOpenChange(false),
    forceDefault: isFirstProfile,
  });

  function handleOpenChange(nextOpen: boolean) {
    // Closing mid-request would hide the outcome (and any field error) from the user
    if (!nextOpen && isSubmitting) return;

    if (!nextOpen) reset();

    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo remitente</DialogTitle>
          <DialogDescription>
            Es la empresa que figura como remitente en las guías de Olva. Verificamos el RUC con
            Olva antes de guardarlo.
          </DialogDescription>
        </DialogHeader>

        <CreateOlvaSenderProfileForm
          form={form}
          onSubmit={submit}
          onCancel={() => handleOpenChange(false)}
          isSubmitting={isSubmitting}
          isDefaultLocked={isFirstProfile}
        />
      </DialogContent>
    </Dialog>
  );
}
