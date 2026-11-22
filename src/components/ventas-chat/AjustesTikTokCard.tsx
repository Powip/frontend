"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTikTokAuthUrl, goToExternalUrl, integrationsErrorMessage } from "@/services/crmTeamService";
import { useConnectTikTokOAuth, useDeleteTikTokAccount, useTikTokAccounts } from "@/hooks/useCrmTeam";
import type { TikTokAccount, TikTokWebhookResult } from "@/types/crmTeam";
import AjustesCard from "./AjustesCard";
import ConfirmDialog from "./ConfirmDialog";

const WEBHOOK_NOTE: Record<TikTokWebhookResult, string | null> = {
  registered: null,
  skipped: "Falta configurar la URL que recibe los mensajes. Hasta entonces no llegarán a la Bandeja.",
  failed: "TikTok no aceptó la URL que recibe los mensajes. Hasta corregirla no llegarán a la Bandeja.",
};

/** Lee lo que dejó la vuelta de TikTok en la URL y la limpia para no repetirlo. */
function readReturn(): { code?: string; state?: string; error?: string } {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const code = hash.get("tiktok_code") ?? undefined;
  const state = hash.get("tiktok_state") ?? undefined;
  const error =
    query.get("tiktok") === "error"
      ? query.get("message") || "TikTok no completó la conexión. Vuelve a intentarlo."
      : undefined;
  if (code || error) window.history.replaceState(null, "", window.location.pathname);
  return { code, state, error };
}

/** Conecta cuentas de empresa de TikTok con ms-integrations (permiso en la pantalla de TikTok). */
export default function AjustesTikTokCard() {
  const accounts = useTikTokAccounts();
  const connect = useConnectTikTokOAuth();
  const remove = useDeleteTikTokAccount();
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<{ label: string; note: string | null } | null>(null);
  const [opening, setOpening] = useState(false);
  const [deleting, setDeleting] = useState<TikTokAccount | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const handled = useRef(false);
  const { mutate } = connect;

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const back = readReturn();
    if (back.error) {
      setError(back.error);
      return;
    }
    if (!back.code || !back.state) return;
    mutate(
      { code: back.code, state: back.state },
      {
        onSuccess: (res) =>
          setConnected({ label: res.account.name || res.account.accountId, note: WEBHOOK_NOTE[res.webhook] }),
        onError: (err) => setError(integrationsErrorMessage(err)),
      },
    );
  }, [mutate]);

  const start = async () => {
    setError(null);
    setConnected(null);
    setOpening(true);
    try {
      goToExternalUrl(await getTikTokAuthUrl());
    } catch (err) {
      setError(integrationsErrorMessage(err));
      setOpening(false);
    }
  };

  return (
    <AjustesCard
      id="tiktok"
      title="TikTok"
      description={
        <>
          Recibe y responde mensajes directos de TikTok en la Bandeja. Necesitas una cuenta de empresa
          de TikTok. Al conectar, TikTok te pide el permiso en su propia pantalla y luego vuelves aquí.
          TikTok solo deja responder: el cliente debe escribir primero.
        </>
      }
      canSave
      saving={opening || connect.isPending}
      onSave={start}
      error={error}
      saveLabel="Conectar con TikTok"
    >
      <div className="space-y-2" data-testid="tiktok-accounts">
        <p className="text-xs font-medium">Cuentas conectadas</p>
        {accounts.isLoading && <p className="text-xs text-muted-foreground">Cargando cuentas…</p>}
        {accounts.isError && (
          <p role="alert" className="text-xs text-destructive">
            No se pudieron leer las cuentas: {integrationsErrorMessage(accounts.error)}
          </p>
        )}
        {accounts.data?.length === 0 && (
          <p className="text-xs text-muted-foreground">Aún no hay cuentas conectadas.</p>
        )}
        <ul className="space-y-1.5">
          {accounts.data?.map((a) => (
            <li
              key={a.id}
              data-testid="tiktok-account"
              className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm"
            >
              <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium">TikTok</span>
              <span className="font-medium">{a.name || "Sin nombre"}</span>
              <span className="text-xs text-muted-foreground">ID {a.accountId}</span>
              {!a.isActive && <span className="text-xs text-amber-700">Inactiva</span>}
              {!a.autoRenew && (
                <span className="text-xs text-amber-700">
                  Sin renovación automática: vuelve a conectarla con el botón
                </span>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-auto"
                aria-label={`Eliminar cuenta ${a.name || a.accountId}`}
                onClick={() => {
                  setDeleteError(null);
                  setDeleting(a);
                }}
              >
                <Trash2 /> Eliminar
              </Button>
            </li>
          ))}
        </ul>
        {deleteError && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {deleteError}
          </p>
        )}
      </div>
      {connect.isPending && (
        <p role="status" className="text-xs text-muted-foreground">
          Terminando la conexión con TikTok…
        </p>
      )}
      {connected && (
        <div
          role="status"
          className="space-y-1 rounded-md border bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30"
        >
          <p className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Cuenta conectada: {connected.label}
          </p>
          {connected.note && <p className="text-xs text-amber-700">{connected.note}</p>}
        </div>
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Eliminar cuenta"
        description={
          deleting
            ? `Se desconectará TikTok «${deleting.name || deleting.accountId}». Dejarás de recibir sus mensajes en Powip.`
            : ""
        }
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) {
            remove.mutate(target.id, {
              onError: (err) => setDeleteError(integrationsErrorMessage(err)),
            });
          }
        }}
      />
    </AjustesCard>
  );
}
