"use client";
import { useState } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { integrationsErrorMessage } from "@/services/crmTeamService";
import {
  useConnectMetaAccount,
  useDeleteMetaAccount,
  useMetaAccounts,
} from "@/hooks/useCrmTeam";
import type { MetaAccount, MetaChannel } from "@/types/crmTeam";
import AjustesCard from "./AjustesCard";
import ConfirmDialog from "./ConfirmDialog";
import { CHANNEL_LABEL, NATIVE_SELECT_CLASS } from "./format";

const EMPTY = { channel: "instagram" as MetaChannel, accountId: "", pageId: "", name: "", accessToken: "" };

/** Conecta cuentas de Instagram y Messenger con ms-integrations. */
export default function AjustesMetaCard() {
  const accounts = useMetaAccounts();
  const connect = useConnectMetaAccount();
  const remove = useDeleteMetaAccount();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<MetaAccount | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const set = (k: "accountId" | "pageId" | "name" | "accessToken") =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const complete = !!form.accountId.trim() && !!form.pageId.trim() && !!form.accessToken.trim();

  const submit = () => {
    if (!complete || connect.isPending) return;
    const body = {
      channel: form.channel,
      accountId: form.accountId.trim(),
      pageId: form.pageId.trim(),
      ...(form.name.trim() ? { name: form.name.trim() } : {}),
      accessToken: form.accessToken.trim(),
    };
    setError(null);
    setConnected(null);
    // El token no se conserva tras enviar, salga bien o mal.
    setForm((f) => ({ ...f, accessToken: "" }));
    connect.mutate(body, {
      onSuccess: (acc) => {
        setConnected(`${CHANNEL_LABEL[acc.channel]} · ${acc.name || acc.accountId}`);
        setForm(EMPTY);
      },
      onError: (err) => setError(integrationsErrorMessage(err)),
    });
  };

  return (
    <AjustesCard
      id="meta"
      title="Instagram y Messenger"
      description={
        <>
          Recibe y responde mensajes de Instagram y de Messenger en la Bandeja. Necesitas una app de
          Meta con los permisos de mensajería y el webhook apuntando a Powip. Los datos (ID de la
          cuenta, ID de la página y token de acceso de la página) salen de Meta Business. Powip los
          valida con Meta antes de guardarlos.
        </>
      }
      canSave={complete}
      saving={connect.isPending}
      onSave={submit}
      error={error}
      saveLabel="Conectar cuenta"
    >
      <div className="space-y-2" data-testid="meta-accounts">
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
              data-testid="meta-account"
              className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm"
            >
              <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium">
                {CHANNEL_LABEL[a.channel]}
              </span>
              <span className="font-medium">{a.name || "Sin nombre"}</span>
              <span className="text-xs text-muted-foreground">ID {a.accountId}</span>
              {!a.isActive && <span className="text-xs text-amber-700">Inactiva</span>}
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

      <form
        className="grid gap-3 sm:grid-cols-2"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="meta-channel">Canal</Label>
          <select
            id="meta-channel"
            className={cn(NATIVE_SELECT_CLASS, "h-9 text-sm")}
            value={form.channel}
            onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as MetaChannel }))}
          >
            <option value="instagram">Instagram</option>
            <option value="messenger">Messenger</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meta-name">Nombre (opcional)</Label>
          <Input id="meta-name" value={form.name} onChange={set("name")} autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meta-account-id">Cuenta que recibe los mensajes (ID)</Label>
          <Input id="meta-account-id" value={form.accountId} onChange={set("accountId")} autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meta-page-id">ID de la página de Facebook</Label>
          <Input id="meta-page-id" value={form.pageId} onChange={set("pageId")} autoComplete="off" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="meta-token">Token de acceso de la página</Label>
          <Input
            id="meta-token"
            type="password"
            value={form.accessToken}
            onChange={set("accessToken")}
            autoComplete="off"
          />
          <p className="text-[11px] text-muted-foreground">
            Se envía una sola vez y no se muestra después.
          </p>
        </div>
      </form>
      {connected && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md border bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30"
        >
          <CheckCircle2 className="h-4 w-4" /> Cuenta conectada: {connected}
        </p>
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Eliminar cuenta"
        description={
          deleting
            ? `Se desconectará ${CHANNEL_LABEL[deleting.channel]} «${deleting.name || deleting.accountId}». Dejarás de recibir sus mensajes en Powip.`
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
