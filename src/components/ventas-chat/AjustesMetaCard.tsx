"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { EmbeddedSignupCancelledError, launchFacebookLogin } from "@/lib/metaEmbeddedSignup";
import { connectChannelAccount } from "@/services/crmPlanService";
import {
  completeMetaLogin,
  getMetaLoginConfig,
  integrationsErrorMessage,
} from "@/services/crmTeamService";
import { planKeys } from "@/hooks/useCrmPlan";
import {
  useConnectMetaAccount,
  useDeleteMetaAccount,
  useMetaAccounts,
  teamKeys,
} from "@/hooks/useCrmTeam";
import type { MetaAccount, MetaChannel, MetaLoginConfig } from "@/types/crmTeam";
import AjustesCard from "./AjustesCard";
import ConnectWithFacebookBox from "./ConnectWithFacebookBox";
import ConfirmDialog from "./ConfirmDialog";
import { CHANNEL_LABEL, NATIVE_SELECT_CLASS } from "./format";

const EMPTY = { channel: "instagram" as MetaChannel, accountId: "", pageId: "", name: "", accessToken: "" };

type ChannelChoice = "both" | MetaChannel;
const CHANNELS_OF: Record<ChannelChoice, MetaChannel[]> = {
  both: ["instagram", "messenger"],
  instagram: ["instagram"],
  messenger: ["messenger"],
};

/**
 * Conecta cuentas de Instagram y Messenger con ms-integrations. Igual que WhatsApp: tienda,
 * «Conectar con Facebook» (Facebook Login for Business) o datos manuales. Tras conectar,
 * la cuenta queda registrada en ms-crm con su tienda antes del primer mensaje.
 */
export default function AjustesMetaCard() {
  const { auth, selectedStoreId } = useAuth();
  const stores = auth?.company?.stores ?? [];
  const defaultStoreId = stores.find((s) => s.id === selectedStoreId)?.id ?? stores[0]?.id ?? "";
  const qc = useQueryClient();
  const [storeId, setStoreId] = useState(defaultStoreId);
  const [choice, setChoice] = useState<ChannelChoice>("both");
  const [loginConfig, setLoginConfig] = useState<MetaLoginConfig | null>(null);
  const [loginConfigError, setLoginConfigError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const accounts = useMetaAccounts();
  const connect = useConnectMetaAccount();
  const remove = useDeleteMetaAccount();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<MetaAccount | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId && defaultStoreId) setStoreId(defaultStoreId);
  }, [defaultStoreId, storeId]);

  useEffect(() => {
    let alive = true;
    getMetaLoginConfig()
      .then((cfg) => alive && setLoginConfig(cfg))
      .catch((err) => alive && setLoginConfigError(integrationsErrorMessage(err)));
    return () => {
      alive = false;
    };
  }, []);

  /** Registra las cuentas en ms-crm con la tienda elegida. Devuelve los avisos (no corta el flujo). */
  const linkStore = async (list: Pick<MetaAccount, "channel" | "accountId" | "name">[]) => {
    const problems: string[] = [];
    for (const a of list) {
      try {
        await connectChannelAccount({
          channel: a.channel,
          accountId: a.accountId,
          ...(a.name ? { name: a.name } : {}),
          ...(storeId ? { storeId } : {}),
        });
      } catch (err) {
        problems.push(
          `${CHANNEL_LABEL[a.channel]} ${a.name || a.accountId}: conectada, pero no se pudo asignar la tienda (${integrationsErrorMessage(err)}). Asígnala en «Cuentas y tiendas».`,
        );
      }
    }
    void qc.invalidateQueries({ queryKey: planKeys.channels });
    return problems;
  };

  const connectWithFacebook = async () => {
    if (!loginConfig || loggingIn) return;
    setLoggingIn(true);
    setError(null);
    setConnected(null);
    setWarnings([]);
    try {
      const code = await launchFacebookLogin(loginConfig);
      const result = await completeMetaLogin({ code, channels: CHANNELS_OF[choice] });
      const pageProblems = result.pages
        .filter((p) => p.error)
        .map((p) => `Página ${p.pageName || p.pageId}: ${p.error}`);
      const storeProblems = await linkStore(result.accounts);
      void qc.invalidateQueries({ queryKey: teamKeys.metaAccounts });
      if (result.accounts.length === 0) {
        setError(pageProblems.join(" · ") || "Meta no devolvió ninguna cuenta para conectar.");
      } else {
        setConnected(
          result.accounts.map((a) => `${CHANNEL_LABEL[a.channel]} · ${a.name || a.accountId}`).join(", "),
        );
      }
      setWarnings([...(result.accounts.length ? pageProblems : []), ...storeProblems]);
    } catch (err) {
      setError(err instanceof EmbeddedSignupCancelledError ? err.message : integrationsErrorMessage(err));
    } finally {
      setLoggingIn(false);
    }
  };

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
    setWarnings([]);
    // El token no se conserva tras enviar, salga bien o mal.
    setForm((f) => ({ ...f, accessToken: "" }));
    connect.mutate(body, {
      onSuccess: (acc) => {
        setConnected(`${CHANNEL_LABEL[acc.channel]} · ${acc.name || acc.accountId}`);
        setForm(EMPTY);
        void linkStore([acc]).then(setWarnings);
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
          Recibe y responde mensajes y comentarios de Instagram y de Messenger en la Bandeja. Lo
          más simple es «Conectar con Facebook»: eliges la página en la ventana de Meta y Powip
          guarda la página, su Instagram vinculado, el token y la suscripción del webhook solo.
          También puedes pegar los datos de Meta Business (ID de la cuenta, ID de la página y token
          de acceso de la página). Powip los valida con Meta antes de guardarlos.
        </>
      }
      canSave={complete}
      saving={connect.isPending}
      onSave={submit}
      error={error}
      saveLabel="Conectar cuenta"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="meta-store">Tienda</Label>
          <select
            id="meta-store"
            className={cn(NATIVE_SELECT_CLASS, "h-9 text-sm")}
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            disabled={stores.length === 0}
          >
            {stores.length === 0 && <option value="">Sin tiendas</option>}
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meta-login-channels">Qué conectar</Label>
          <select
            id="meta-login-channels"
            className={cn(NATIVE_SELECT_CLASS, "h-9 text-sm")}
            value={choice}
            onChange={(e) => setChoice(e.target.value as ChannelChoice)}
          >
            <option value="both">Instagram y Messenger</option>
            <option value="instagram">Solo Instagram</option>
            <option value="messenger">Solo Messenger</option>
          </select>
        </div>
      </div>
      <ConnectWithFacebookBox
        testId="meta-login"
        help="Abre la ventana de Meta y marca la página de Facebook del negocio (y su cuenta de Instagram profesional). Powip conecta todo solo."
        config={loginConfig}
        configError={loginConfigError}
        fallbackMissing={["META_MESSAGING_APP_ID", "META_MESSAGING_APP_SECRET", "META_MESSAGING_LOGIN_CONFIG_ID"]}
        busy={loggingIn}
        disabled={connect.isPending}
        onConnect={() => void connectWithFacebook()}
      />
      <p className="text-xs font-medium">O con datos manuales</p>
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
      {warnings.length > 0 && (
        <ul role="alert" data-testid="meta-login-warnings" className="space-y-1 text-xs text-amber-700">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
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
