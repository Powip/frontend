"use client";

import { CancelledError } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useProgramPreferences } from "@/features/partners/hooks/use-program-preferences";
import { useUpdateProgramPreferences } from "@/features/partners/hooks/use-update-program-preferences";
import { getHttpStatus } from "@/features/partners/mappers/to-partner-identity-from-error";
import type {
  ProgramPreferencesCommand,
  ProgramPreferencesResponse,
  ProgramPreferencesSettings,
} from "@/features/partners/models/program-preferences";
import { programPreferencesCommandSchema } from "@/features/partners/schemas/program-preferences.schema";
import { PartnerSectionError } from "./partner-section-error";

export function ProgramPreferencesCard() {
  const read = useProgramPreferences();
  const write = useUpdateProgramPreferences();
  const denial = read.session.denied ?? write.session.denied;
  const currentMutation = write.mutationForSession;
  const status = getHttpStatus(write.mutation.error);
  const unknown =
    currentMutation &&
    write.mutation.isError &&
    !(write.mutation.error instanceof CancelledError) &&
    (status === null || status >= 500);
  const unresolved = currentMutation && (write.mutation.isPending || unknown);
  const original = unresolved ? write.mutation.variables?.command : undefined;

  if (denial || !read.session.enabled || !write.session.enabled) {
    return (
      <PartnerSectionError
        message={
          getHttpStatus(denial) === 401
            ? "Tu sesión ya no está vigente. Volvé a iniciar sesión para ver tus preferencias."
            : "No tenés acceso a las preferencias de un Partner activo."
        }
      />
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Preferencias del programa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          La opción y el descuento se guardan como preferencias. No activan un contrato, no aplican
          descuentos en checkout y no generan comisiones.
        </p>
        <p className="text-xs text-muted-foreground">
          La opción se elige una sola vez. Después solo se puede cambiar el descuento.
        </p>
        <p role="status" className="rounded-xl border p-3 text-sm">
          Condiciones efectivas: no configuradas. Las tasas efectivas de comisión no están
          disponibles.
        </p>
        {original ? (
          <PreferenceRecovery
            command={original}
            pending={write.mutation.isPending}
            onRetry={() => write.save(original)}
          />
        ) : null}
        {read.isError ? (
          <PartnerSectionError
            message="No pudimos leer tus preferencias."
            error={read.error}
            onRetry={() => read.refetch()}
          />
        ) : !read.data ? (
          <p role="status" className="text-sm text-muted-foreground">
            Cargando preferencias…
          </p>
        ) : (
          <>
            <DocumentedCatalog response={read.data} />
            {!unresolved ? (
              read.data.settings?.version === Number.MAX_SAFE_INTEGER ? (
                <p role="alert" className="text-sm text-muted-foreground">
                  Esta configuración alcanzó el límite de versión. No se puede crear otra solicitud.
                </p>
              ) : (
                <PreferencesForm
                  key={`${read.session.userId}:${read.session.epoch}:${read.data.settings?.version ?? "initial"}`}
                  settings={read.data.settings}
                  onSave={write.save}
                />
              )
            ) : null}
          </>
        )}
        {currentMutation && write.mutation.isError && !unknown ? (
          <p role="alert" className="text-sm text-destructive">
            {status === 409
              ? "La versión cambió. Revisá las preferencias actuales antes de guardar una nueva solicitud."
              : "La solicitud no fue aceptada. Revisá los datos antes de volver a guardar."}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DocumentedCatalog({ response }: { response: ProgramPreferencesResponse }) {
  return (
    <section aria-label="Catálogo documentado">
      <h3 className="mb-2 text-sm font-semibold">Catálogo documentado, no condiciones efectivas</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Especificación Powip Partners {response.catalog.version} · {response.catalog.date}. Estos
        porcentajes documentados no son tasas aplicadas a tu cuenta.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="p-2">Opción</th>
              <th className="p-2">Primer pago documentado</th>
              <th className="p-2">Pago recurrente documentado</th>
            </tr>
          </thead>
          <tbody>
            {response.catalog.options.map((option) => (
              <tr key={option.code} className="border-t">
                <th className="p-2" scope="row">
                  {option.code}
                </th>
                <td className="p-2">{option.firstPaymentPct}%</td>
                <td className="p-2">{option.recurringPaymentPct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PreferencesForm({
  settings,
  onSave,
}: {
  settings: ProgramPreferencesSettings | null;
  onSave: (command: Readonly<ProgramPreferencesCommand>) => void;
}) {
  const optionId = useId();
  const discountId = useId();
  const reasonId = useId();
  const [optionCode, setOptionCode] = useState(settings?.optionCode ?? "");
  const [discountPct, setDiscountPct] = useState(settings?.discountPct ?? "");
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState(false);
  const customDiscount =
    settings && !["0", "5", "10"].includes(settings.discountPct) ? settings.discountPct : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = programPreferencesCommandSchema.safeParse({
      optionCode,
      discountPct,
      expectedVersion: settings?.version ?? null,
      reason,
    });
    setInvalid(!parsed.success);
    if (parsed.success) onSave(Object.freeze(parsed.data));
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {settings
          ? `Preferencia guardada: opción ${settings.optionCode}; descuento ${settings.discountPct}%.`
          : "Todavía no hay una preferencia guardada. Elegí explícitamente ambas opciones."}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor={optionId} className="text-sm font-medium">
            Opción de comisión preferida
          </label>
          {settings ? (
            <input
              id={optionId}
              readOnly
              value={`Opción ${settings.optionCode}`}
              className="h-10 w-full rounded-md border bg-muted px-3 text-sm"
            />
          ) : (
            <select
              id={optionId}
              required
              value={optionCode}
              onChange={(event) => setOptionCode(event.target.value as typeof optionCode)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="" disabled>
                Elegí una opción
              </option>
              {["A", "B", "C"].map((code) => (
                <option key={code} value={code}>
                  Opción {code}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="space-y-2">
          <label htmlFor={discountId} className="text-sm font-medium">
            Descuento preferido
          </label>
          <select
            id={discountId}
            required
            value={discountPct}
            onChange={(event) => setDiscountPct(event.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Elegí un descuento
            </option>
            {["0", "5", "10"].map((value) => (
              <option key={value} value={value}>
                {value}%
              </option>
            ))}
            {customDiscount ? (
              <option value={customDiscount}>{customDiscount}% (configurado)</option>
            ) : null}
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        El descuento documentado es financiado por el Partner. Guardarlo no prueba su aplicación ni
        un impacto financiero.
      </p>
      <div className="space-y-2">
        <label htmlFor={reasonId} className="text-sm font-medium">
          Motivo del cambio
        </label>
        <Textarea
          id={reasonId}
          required
          maxLength={1000}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
      {invalid ? (
        <p role="alert" className="text-sm text-destructive">
          Elegí opción y descuento, y escribí un motivo válido de hasta 1000 caracteres.
        </p>
      ) : null}
      <Button type="submit">Guardar preferencias</Button>
    </form>
  );
}

function PreferenceRecovery({
  command,
  pending,
  onRetry,
}: {
  command: Readonly<ProgramPreferencesCommand>;
  pending: boolean;
  onRetry: () => void;
}) {
  const reasonId = useId();
  return (
    <section className="space-y-3 rounded-xl border p-4" aria-label="Solicitud original">
      <p role="status" className="text-sm">
        {pending
          ? "Guardando la solicitud original…"
          : "El resultado de la solicitud es desconocido. Reintentá exactamente la misma solicitud para recuperar su confirmación."}
      </p>
      <p className="text-sm">
        Opción {command.optionCode} · descuento {command.discountPct}% · versión esperada{" "}
        {command.expectedVersion ?? "inicial"}
      </p>
      <label htmlFor={reasonId} className="text-sm font-medium">
        Motivo de la solicitud original
      </label>
      <Textarea id={reasonId} readOnly value={command.reason} />
      <Button type="button" disabled={pending} onClick={onRetry}>
        Reintentar misma solicitud
      </Button>
    </section>
  );
}
