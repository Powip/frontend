"use client";

import { CancelledError } from "@tanstack/react-query";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  type ReferralRejectionInput,
  useReferralRejection,
} from "@/features/partners/hooks/use-referral-rejection";
import { getHttpStatus } from "@/features/partners/mappers/to-partner-identity-from-error";
import type { AdminReviewQueueItem } from "@/features/partners/models/admin-review-queue";
import { referralRejectionCommandSchema } from "@/features/partners/schemas/referral-rejection.schema";
import { adminReadSessionEpoch } from "@/features/partners/utils/admin-read-session-state";
import { AdminReadError } from "../../_components/admin-read-error";

interface Props {
  items: AdminReviewQueueItem[];
  reload: () => Promise<AdminReviewQueueItem[]>;
}
export function ReferralRejectionControls(props: Props) {
  const { auth } = useAuth();
  return (
    <SessionReferralRejectionControls
      key={`${auth?.user.id}:${adminReadSessionEpoch(auth?.accessToken)}`}
      {...props}
    />
  );
}
function SessionReferralRejectionControls({ items, reload }: Props) {
  const { session, write } = useReferralRejection();
  const [selected, setSelected] = useState<AdminReviewQueueItem | null>(null);
  const [reason, setReason] = useState("");
  const [attempt, setAttempt] = useState<ReferralRejectionInput | null>(null);
  const [pending, setPending] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [reloadError, setReloadError] = useState<unknown>(null);
  const [invalid, setInvalid] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const status = getHttpStatus(error);
  const unknown = Boolean(error) && (status === null || status >= 500);

  async function send(input: ReferralRejectionInput) {
    if (pending || !session.enabled) return;
    setAttempt(input);
    setPending(true);
    setError(null);
    setReloadError(null);
    setConfirmed(false);
    try {
      const result = await write(input);
      session.assertCurrent(new AbortController().signal);
      if (!mounted.current) return;
      if (
        selected &&
        (result.partnerId !== selected.partnerId || result.origin !== selected.origin)
      )
        throw new Error("La confirmación no coincide con el referido elegido.");
      setAttempt(null);
      setSelected(null);
      setReason("");
      setConfirmed(true);
    } catch (failure) {
      if (mounted.current && !(failure instanceof CancelledError)) setError(failure);
    } finally {
      if (mounted.current) setPending(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || attempt || !session.enabled || pending || reloading) return;
    const parsed = referralRejectionCommandSchema.safeParse({
      expectedVersion: selected.version,
      reason,
    });
    if (!parsed.success) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    const input = Object.freeze({ referralId: selected.id, command: Object.freeze(parsed.data) });
    void send(input);
  }
  async function reviewAfterDefinitiveError() {
    if (!attempt || unknown || pending || !session.enabled || reloading) return;
    setReloading(true);
    setReloadError(null);
    try {
      session.assertCurrent(new AbortController().signal);
      const actual = await reload();
      session.assertCurrent(new AbortController().signal);
      if (!mounted.current) return;
      setSelected(actual.find((item) => item.id === attempt.referralId) ?? null);
      setAttempt(null);
      setReason("");
      setError(null);
      setReloadError(null);
    } catch (failure) {
      if (mounted.current && !(failure instanceof CancelledError)) setReloadError(failure);
    } finally {
      if (mounted.current) setReloading(false);
    }
  }
  if (!session.canAccess) return null;
  if (session.denied)
    return (
      <AdminReadError
        error={session.denied}
        message="No tenés permiso actual para rechazar referidos."
      />
    );
  if (hidden)
    return (
      <Button type="button" variant="outline" onClick={() => setHidden(false)}>
        {attempt ? "Recuperar solicitud de rechazo" : "Abrir rechazo de referido"}
      </Button>
    );
  return (
    <section aria-label="Rechazo de referido pendiente" className="space-y-3 rounded-xl border p-4">
      <h3 className="font-semibold">Rechazar un referido pendiente</h3>
      <p className="text-sm text-muted-foreground">
        Registra un rechazo operacional con motivo. No aprueba, vincula personas, atribuye empresas
        ni cambia comisiones.
      </p>
      {attempt ? (
        <div className="space-y-3">
          <p>
            Referido: {attempt.referralId} · Versión propuesta: {attempt.command.expectedVersion}
          </p>
          <label htmlFor="referral-rejection-original-reason">
            Motivo de la solicitud original
          </label>
          <Textarea
            id="referral-rejection-original-reason"
            value={attempt.command.reason}
            readOnly
            disabled
          />
          <p role="status">
            {pending
              ? "Esperando confirmación del rechazo original…"
              : unknown
                ? "El resultado es desconocido. Reintentar conserva exactamente el referido, la versión y el motivo, aunque la cola cambie."
                : "La solicitud no fue confirmada. Revisá la cola antes de proponer otro rechazo."}
          </p>
          {unknown || pending ? (
            <Button
              type="button"
              disabled={pending || !session.enabled}
              onClick={() => void send(attempt)}
            >
              {pending ? "Guardando…" : "Reintentar mismo rechazo"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={reloading || !session.enabled}
              onClick={() => void reviewAfterDefinitiveError()}
            >
              {reloading ? "Consultando…" : "Revisar cola antes de nueva solicitud"}
            </Button>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="referral-rejection-target">Referido a rechazar</label>
          <select
            id="referral-rejection-target"
            className="block rounded border p-2"
            value={selected?.id ?? ""}
            disabled={!session.enabled || reloading}
            onChange={(event) => {
              setSelected(items.find((item) => item.id === event.target.value) ?? null);
              setReason("");
              setInvalid(false);
              setConfirmed(false);
            }}
          >
            <option value="">Elegir referido pendiente</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.businessName} · {item.origin} · {item.id}
              </option>
            ))}
          </select>
          {selected ? <p>Versión del referido elegido: {selected.version}</p> : null}
          <label htmlFor="referral-rejection-reason">Motivo del rechazo</label>
          <Textarea
            id="referral-rejection-reason"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setInvalid(false);
            }}
            required
            maxLength={1000}
            disabled={
              !selected ||
              !session.enabled ||
              reloading ||
              selected.version >= Number.MAX_SAFE_INTEGER
            }
            aria-invalid={invalid}
          />
          {invalid ? (
            <p role="alert">
              Ingresá un motivo válido de hasta 1000 caracteres, sin caracteres de control.
            </p>
          ) : null}
          {selected && selected.version >= Number.MAX_SAFE_INTEGER ? (
            <p role="status">El referido alcanzó el límite de versiones. No admite otro rechazo.</p>
          ) : null}
          <Button
            type="submit"
            variant="destructive"
            disabled={
              !selected ||
              !session.enabled ||
              reloading ||
              selected.version >= Number.MAX_SAFE_INTEGER
            }
          >
            Rechazar referido
          </Button>
        </form>
      )}
      {confirmed ? (
        <p role="status">Rechazo confirmado. La cola se actualiza con los datos guardados.</p>
      ) : null}
      {error ? (
        <AdminReadError
          error={error}
          message={
            status === 409
              ? "La versión cambió o la clave ya corresponde a otra solicitud. Revisá la cola actual."
              : "No pudimos confirmar el rechazo."
          }
        />
      ) : null}
      {reloadError ? (
        <AdminReadError
          error={reloadError}
          message="No pudimos consultar la cola actual. La solicitud original se conserva."
        />
      ) : null}
      <Button
        type="button"
        variant="ghost"
        disabled={pending || reloading}
        onClick={() => setHidden(true)}
      >
        Cerrar control de rechazo
      </Button>
    </section>
  );
}
