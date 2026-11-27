"use client";

import { type ChangeEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertGreCredentialApi } from "@/features/sunat/despatch-advice/api/despatch-advice.api";
import { greKeys } from "@/features/sunat/despatch-advice/hooks/use-despatch-advices";
import type { GreProfileSettings, UpsertGreCredentialRequest } from "@/features/sunat/despatch-advice/types/despatch-advice.types";
import { greErrorMessage } from "@/features/sunat/despatch-advice/utils/gre-form";

// FEAT-24 H12 — credenciales GRE de un RUC: client_id y client_secret de la API
// REST de SUNAT (se generan en SOL › Credenciales de API) y la serie T001 de la
// guía remitente. ms-sunat guarda el secreto cifrado y nunca lo devuelve, así
// que para cambiar la serie se vuelve a escribir.

interface Props {
  profile: GreProfileSettings | null;
  onClose: () => void;
}

export interface GreCredentialsForm {
  clientId: string;
  clientSecret: string;
  series: string;
  nextCorrelative: string;
}

/** Problemas del formulario por campo (vacío = se puede guardar). */
export function greCredentialsProblems(form: GreCredentialsForm, current: GreProfileSettings | null): Partial<Record<keyof GreCredentialsForm, string>> {
  const problems: Partial<Record<keyof GreCredentialsForm, string>> = {};
  if (!form.clientId.trim()) problems.clientId = "Escribe el client_id que te dio SOL.";
  else if (form.clientId.trim().length > 100) problems.clientId = "El client_id no puede tener más de 100 caracteres.";
  if (!form.clientSecret.trim()) problems.clientSecret = current?.configured ? "Vuelve a escribir el client_secret: no se guarda a la vista." : "Escribe el client_secret que te dio SOL.";
  else if (form.clientSecret.trim().length > 500) problems.clientSecret = "El client_secret no puede tener más de 500 caracteres.";
  if (!/^T[A-Z0-9]{3}$/.test(form.series.trim().toUpperCase())) problems.series = "La serie de la guía remitente tiene 4 caracteres y empieza con T (por ejemplo, T001).";
  // Obligatorio: la empresa confirma qué número está libre en SUNAT (si emite
  // guías con la misma serie fuera de Powip). Guardarlo libera el freno de la serie.
  const next = form.nextCorrelative.trim();
  if (!next) problems.nextCorrelative = "Escribe el próximo número libre de la serie en SUNAT (1 si nunca emitiste guías con ella).";
  else {
    const value = Number(next);
    if (!/^\d+$/.test(next) || value < 1 || value > 99_999_999) problems.nextCorrelative = "El próximo número va de 1 a 99999999.";
    else if (current?.nextCorrelative && current.series === form.series.trim().toUpperCase() && value < current.nextCorrelative)
      problems.nextCorrelative = `No puede ser menor que ${current.nextCorrelative}: esos números ya se usaron.`;
  }
  return problems;
}

export function greCredentialsRequest(form: GreCredentialsForm): UpsertGreCredentialRequest {
  // ms-sunat exige el próximo número siempre: guardarlo es la confirmación de
  // la empresa de que está libre en SUNAT (y libera el freno de la serie).
  return {
    clientId: form.clientId.trim(),
    clientSecret: form.clientSecret.trim(),
    series: form.series.trim().toUpperCase(),
    nextCorrelative: Number(form.nextCorrelative.trim()),
  };
}

export default function GreCredentialsModal({ profile, onClose }: Props) {
  if (!profile) return null;
  return <GreCredentialsDialog key={profile.sunatProfileId} profile={profile} onClose={onClose} />;
}

function GreCredentialsDialog({ profile, onClose }: { profile: GreProfileSettings; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<GreCredentialsForm>({
    clientId: profile.clientId ?? "",
    clientSecret: "",
    series: profile.series ?? "T001",
    nextCorrelative: profile.nextCorrelative ? String(profile.nextCorrelative) : "",
  });
  const [showErrors, setShowErrors] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const problems = greCredentialsProblems(form, profile);

  const save = useMutation({
    mutationFn: () => upsertGreCredentialApi(profile.sunatProfileId, greCredentialsRequest(form)),
    onSuccess: (credential) => {
      toast.success(`Credenciales GRE guardadas para el RUC ${profile.ruc} (serie ${credential.series}).`);
      void queryClient.invalidateQueries({ queryKey: greKeys.all });
      onClose();
    },
    onError: (error) => setSubmitError(greErrorMessage(error, "No se pudieron guardar las credenciales GRE.")),
  });

  const submit = () => {
    setShowErrors(true);
    setSubmitError(null);
    if (Object.keys(problems).length > 0) return;
    save.mutate();
  };

  const field = (key: keyof GreCredentialsForm) => ({
    value: form[key],
    onChange: (event: ChangeEvent<HTMLInputElement>) => setForm((value) => ({ ...value, [key]: event.target.value })),
    "aria-invalid": showErrors && problems[key] ? true : undefined,
  });
  const error = (key: keyof GreCredentialsForm) =>
    showErrors && problems[key] ? <p className="text-xs text-destructive">{problems[key]}</p> : null;

  return (
    <Dialog open onOpenChange={(open) => (!open && !save.isPending ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" />
            Credenciales GRE
          </DialogTitle>
          <DialogDescription>
            {profile.razonSocial} · RUC {profile.ruc}. Genera el client_id y el client_secret en SOL › Empresas › Credenciales de API SUNAT. Sirven solo para
            las guías de remisión.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="gre-client-id">client_id</Label>
            <Input id="gre-client-id" autoComplete="off" {...field("clientId")} />
            {error("clientId")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gre-client-secret">client_secret</Label>
            <Input id="gre-client-secret" type="password" autoComplete="new-password" placeholder={profile.configured ? "Guardado: escríbelo de nuevo para cambiar algo" : ""} {...field("clientSecret")} />
            {error("clientSecret")}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="gre-series">Serie</Label>
              <Input id="gre-series" maxLength={4} className="uppercase" {...field("series")} />
              {error("series")}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gre-next">Próximo número</Label>
              <Input id="gre-next" inputMode="numeric" placeholder="1" {...field("nextCorrelative")} />
              {error("nextCorrelative")}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Pon el primer número libre de la serie en SUNAT. Si ya emitiste guías con esta serie fuera de Powip (otro sistema o SOL), pon el que sigue al
            último: SUNAT rechaza un número repetido. No se puede retroceder.
          </p>
          {submitError ? (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              {submitError}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Guardar credenciales
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
