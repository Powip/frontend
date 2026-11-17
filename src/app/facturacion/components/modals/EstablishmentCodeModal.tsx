"use client";

import { Loader2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
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
import { useUpdateSunatProfileEstablishmentCode } from "@/features/sunat/sunat-profile/hooks/use-update-sunat-profile-establishment-code";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";
import {
  ESTABLISHMENT_CODE_ERROR,
  isValidEstablishmentCode,
} from "@/features/sunat/sunat-profile/utils/establishment-code";

interface EstablishmentCodeModalProps {
  /** Issuer to edit. `null` closes the dialog. */
  profile: SunatProfile | null;
  onClose: () => void;
}

/**
 * Edits the issuer's SUNAT establishment code ("código de local anexo").
 * SUNAT rejects documents without it (error 3030).
 */
export function EstablishmentCodeModal({ profile, onClose }: EstablishmentCodeModalProps) {
  const update = useUpdateSunatProfileEstablishmentCode();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCode(profile?.establishmentCode.trim() || "0000");
    setError(null);
  }, [profile]);

  if (!profile) {
    return null;
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const value = code.trim();

    if (!isValidEstablishmentCode(value)) {
      setError(ESTABLISHMENT_CODE_ERROR);
      return;
    }

    update.mutate(
      { id: profile.id, establishmentCode: value },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Código de establecimiento</DialogTitle>
            <DialogDescription>
              {profile.razonSocial} · RUC {profile.ruc}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-2">
            <Label htmlFor="establishment-code">Código de local anexo (SUNAT)</Label>
            <Input
              id="establishment-code"
              value={code}
              inputMode="numeric"
              maxLength={4}
              placeholder="0000"
              aria-invalid={error !== null}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, ""));
                setError(null);
              }}
            />
            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                4 dígitos. Usa 0000 si es la casa matriz. Lo encuentras en tu ficha RUC de SUNAT.
              </p>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
