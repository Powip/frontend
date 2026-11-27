"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldQuestion } from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { toast } from "sonner";
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
import {
  type CpeValidationCredential,
  cpeValidationErrorMessage,
  deleteCpeValidationCredentialApi,
  upsertCpeValidationCredentialApi,
} from "@/features/sunat/cpe-validation/cpe-validation.api";
import {
  cpeValidationKeys,
  useCpeValidationCredential,
} from "@/features/sunat/cpe-validation/use-cpe-validation";

// Freno de duplicados (facturas, boletas y notas): credenciales de la Consulta
// Integrada de Validez de Comprobantes por RUC. Se muestra a todos los usuarios
// que ya ven Facturación. Sin credenciales, la emisión funciona igual que
// siempre.

interface IssuerProfile {
  id: string;
  ruc: string;
  razonSocial: string;
}

export interface CpeValidationForm {
  clientId: string;
  clientSecret: string;
}

/** Problemas del formulario por campo (vacío = se puede guardar). */
export function cpeValidationProblems(
  form: CpeValidationForm,
  configured: boolean,
): Partial<Record<keyof CpeValidationForm, string>> {
  const problems: Partial<Record<keyof CpeValidationForm, string>> = {};
  if (!form.clientId.trim()) problems.clientId = "Escribe el Id (client_id) que te dio SOL.";
  else if (form.clientId.trim().length > 100)
    problems.clientId = "El client_id no puede tener más de 100 caracteres.";
  if (!form.clientSecret.trim())
    problems.clientSecret = configured
      ? "Vuelve a escribir la clave (client_secret): no se guarda a la vista."
      : "Escribe la clave (client_secret) que te dio SOL.";
  else if (form.clientSecret.trim().length > 500)
    problems.clientSecret = "El client_secret no puede tener más de 500 caracteres.";
  return problems;
}

export function CpeValidationCredentialsRow({
  profile,
  serviceConfigured,
}: {
  profile: IssuerProfile;
  serviceConfigured: boolean;
}) {
  const credential = useCpeValidationCredential(profile.id);
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: () => deleteCpeValidationCredentialApi(profile.id),
    onSuccess: () => {
      toast.success(
        `Se quitaron las credenciales de la Consulta Integrada del RUC ${profile.ruc}.`,
      );
      void queryClient.invalidateQueries({ queryKey: cpeValidationKeys.all });
    },
    onError: (error) =>
      toast.error(cpeValidationErrorMessage(error, "No se pudieron quitar las credenciales.")),
  });

  const configured = Boolean(credential.data);

  return (
    <div
      className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
      data-testid={`cpe-validation-${profile.ruc}`}
    >
      <div className="flex items-start gap-2">
        <ShieldQuestion className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <div>
          <div className="text-sm font-semibold">
            Freno de duplicados (Consulta Integrada):{" "}
            {credential.isPending ? (
              <span className="font-normal text-muted-foreground">cargando…</span>
            ) : credential.isError ? (
              <span className="font-normal text-destructive">no se pudo consultar</span>
            ) : configured ? (
              <span className="text-green-700 dark:text-green-400">activo</span>
            ) : (
              <span className="text-amber-700 dark:text-amber-400">sin credenciales</span>
            )}
          </div>
          <p className="max-w-xl text-xs text-muted-foreground">
            {configured
              ? `client_id ${credential.data?.clientId ?? "—"}. Antes de enviar una factura, boleta o nota, Powip pregunta a SUNAT si el número ya existe; si existe, no la envía y te avisa.`
              : "Sin credenciales, Powip emite como siempre. Con ellas, revisa en SUNAT que el número esté libre antes de enviar (evita choques con otro sistema de facturación)."}
          </p>
          {!serviceConfigured ? (
            <p
              className="mt-1 max-w-xl text-xs text-amber-700 dark:text-amber-400"
              data-testid="cpe-validation-service-off"
            >
              La consulta está apagada en el servidor de facturación: puedes guardar las
              credenciales, pero no se usarán hasta que se active.
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {configured ? (
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Quitar
          </Button>
        ) : null}
        <Button
          variant="outline"
          disabled={credential.isPending || credential.isError}
          onClick={() => setEditing(true)}
        >
          {configured ? "Actualizar credenciales" : "Configurar credenciales"}
        </Button>
      </div>
      {editing ? (
        <CpeValidationDialog
          profile={profile}
          current={credential.data ?? null}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}

function CpeValidationDialog({
  profile,
  current,
  onClose,
}: {
  profile: IssuerProfile;
  current: CpeValidationCredential | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CpeValidationForm>({
    clientId: current?.clientId ?? "",
    clientSecret: "",
  });
  const [showErrors, setShowErrors] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const problems = cpeValidationProblems(form, Boolean(current));

  const save = useMutation({
    mutationFn: () =>
      upsertCpeValidationCredentialApi(profile.id, {
        clientId: form.clientId.trim(),
        clientSecret: form.clientSecret.trim(),
      }),
    onSuccess: () => {
      toast.success(`Credenciales de la Consulta Integrada guardadas para el RUC ${profile.ruc}.`);
      void queryClient.invalidateQueries({ queryKey: cpeValidationKeys.all });
      onClose();
    },
    onError: (error) =>
      setSubmitError(cpeValidationErrorMessage(error, "No se pudieron guardar las credenciales.")),
  });

  const submit = () => {
    setShowErrors(true);
    setSubmitError(null);
    if (Object.keys(problems).length > 0) return;
    save.mutate();
  };

  const field = (key: keyof CpeValidationForm) => ({
    value: form[key],
    onChange: (event: ChangeEvent<HTMLInputElement>) =>
      setForm((value) => ({ ...value, [key]: event.target.value })),
    "aria-invalid": showErrors && problems[key] ? true : undefined,
  });
  const error = (key: keyof CpeValidationForm) =>
    showErrors && problems[key] ? (
      <p className="text-xs text-destructive">{problems[key]}</p>
    ) : null;

  return (
    <Dialog open onOpenChange={(open) => (!open && !save.isPending ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldQuestion className="h-5 w-5 text-primary" aria-hidden="true" />
            Consulta Integrada de comprobantes
          </DialogTitle>
          <DialogDescription>
            {profile.razonSocial} · RUC {profile.ruc}. En SOL: Empresas › Comprobantes de pago ›
            Consulta de Validez del Comprobante de Pago › Credenciales de API SUNAT › Habilitar ›
            Registrar. El Id es el client_id y la Clave es el client_secret.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="cpe-client-id">client_id</Label>
            <Input id="cpe-client-id" autoComplete="off" {...field("clientId")} />
            {error("clientId")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cpe-client-secret">client_secret</Label>
            <Input
              id="cpe-client-secret"
              type="password"
              autoComplete="new-password"
              placeholder={current ? "Guardado: escríbelo de nuevo para cambiar algo" : ""}
              {...field("clientSecret")}
            />
            {error("clientSecret")}
          </div>
          <p className="text-xs text-muted-foreground">
            La clave se guarda cifrada y no se vuelve a mostrar. Si SUNAT no responde, Powip envía
            igual (la consulta es una ayuda, no un requisito).
          </p>
          {submitError ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
            >
              {submitError}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={save.isPending}>
            {save.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            Guardar credenciales
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
