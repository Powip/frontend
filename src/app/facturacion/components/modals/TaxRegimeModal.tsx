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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateSunatProfileTaxRegime } from "@/features/sunat/sunat-profile/hooks/use-update-sunat-profile-tax-regime";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";
import {
  isNuevoRus,
  SUNAT_TAX_REGIME_LABELS,
  SUNAT_TAX_REGIMES,
  type SunatTaxRegime,
} from "@/features/sunat/sunat-profile/utils/tax-regime";

interface TaxRegimeModalProps {
  /** Issuer to edit. `null` closes the dialog. */
  profile: SunatProfile | null;
  onClose: () => void;
}

/**
 * Edits the issuer's tax regime. A Nuevo RUS issuer only issues boletas and
 * no line shows IGV; the customer pays the same amount.
 */
export function TaxRegimeModal({ profile, onClose }: TaxRegimeModalProps) {
  const update = useUpdateSunatProfileTaxRegime();
  const [taxRegime, setTaxRegime] = useState<SunatTaxRegime>(SUNAT_TAX_REGIMES.GENERAL);

  useEffect(() => {
    setTaxRegime(profile?.taxRegime ?? SUNAT_TAX_REGIMES.GENERAL);
  }, [profile]);

  if (!profile) {
    return null;
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    update.mutate({ id: profile.id, taxRegime }, { onSuccess: () => onClose() });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Régimen tributario</DialogTitle>
            <DialogDescription>
              {profile.razonSocial} · RUC {profile.ruc}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-2">
            <Label htmlFor="tax-regime">Régimen del RUC</Label>
            <Select
              value={taxRegime}
              onValueChange={(value) => setTaxRegime(value as SunatTaxRegime)}
            >
              <SelectTrigger id="tax-regime">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(SUNAT_TAX_REGIMES).map((value) => (
                  <SelectItem key={value} value={value}>
                    {SUNAT_TAX_REGIME_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {isNuevoRus(taxRegime)
                ? "Este RUC solo emitirá boletas y sin IGV. El cliente paga lo mismo."
                : "Este RUC emite facturas y boletas con IGV."}
            </p>
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
