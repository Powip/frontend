"use client";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { crmError } from "@/services/crmService";
import {
  completeEmbeddedSignup,
  connectCustomWaba,
  getEmbeddedSignupConfig,
  integrationsErrorMessage,
} from "@/services/crmTeamService";
import { EmbeddedSignupCancelledError, launchEmbeddedSignup } from "@/lib/metaEmbeddedSignup";
import type { EmbeddedSignupConfig } from "@/types/crmTeam";
import { useTemplates } from "@/hooks/useCrmEngagement";
import type { Template } from "@/types/crm";
import AjustesCard from "./AjustesCard";

const EMPTY = { wabaId: "", phoneNumberId: "", businessPhoneNumber: "", accessToken: "" };

export function countTemplates(items: Template[] | undefined) {
  const list = items ?? [];
  return {
    approved: list.filter((t) => t.status === "APPROVED").length,
    pending: list.filter((t) => t.status === "PENDING").length,
    rejected: list.filter((t) => t.status === "REJECTED").length,
  };
}

function TemplatesStatus() {
  const { data, isLoading, isError, error } = useTemplates();
  const counts = countTemplates(data);
  return (
    <div className="rounded-md border bg-muted/30 p-3 text-sm" data-testid="templates-status">
      <p className="text-xs font-medium">Plantillas de WhatsApp</p>
      {isLoading && <p className="text-xs text-muted-foreground">Cargando plantillas…</p>}
      {isError && (
        <p role="alert" className="text-xs text-destructive">
          No se pudo leer el estado de las plantillas: {crmError(error).message}
        </p>
      )}
      {data && (
        <p className="text-xs text-muted-foreground">
          <b className="text-foreground">{counts.approved}</b> aprobadas ·{" "}
          <b className="text-foreground">{counts.pending}</b> en revisión ·{" "}
          <b className="text-foreground">{counts.rejected}</b> rechazadas
        </p>
      )}
    </div>
  );
}

/**
 * Conecta el número de WhatsApp Business del negocio con ms-integrations.
 * Guarda en la misma conexión que usan la Bandeja y las notificaciones (por tienda o de
 * toda la empresa). Dos caminos: «Conectar con Facebook» (Embedded Signup) o datos manuales.
 */
export default function AjustesWhatsAppCard() {
  const { auth, selectedStoreId } = useAuth();
  const stores = auth?.company?.stores ?? [];
  const defaultStoreId =
    stores.find((s) => s.id === selectedStoreId)?.id ?? stores[0]?.id ?? "";

  const [form, setForm] = useState(EMPTY);
  const [storeId, setStoreId] = useState(defaultStoreId);
  const [asCompanyDefault, setAsCompanyDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingUp, setSigningUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<string | null>(null);
  const [signupConfig, setSignupConfig] = useState<EmbeddedSignupConfig | null>(null);
  const [signupConfigError, setSignupConfigError] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId && defaultStoreId) setStoreId(defaultStoreId);
  }, [defaultStoreId, storeId]);

  useEffect(() => {
    let alive = true;
    getEmbeddedSignupConfig()
      .then((cfg) => alive && setSignupConfig(cfg))
      .catch((err) => alive && setSignupConfigError(integrationsErrorMessage(err)));
    return () => {
      alive = false;
    };
  }, []);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const complete = Boolean(storeId) && Object.values(form).every((v) => v.trim().length > 0);

  const submit = async () => {
    const body = {
      storeId,
      wabaId: form.wabaId.trim(),
      phoneNumberId: form.phoneNumberId.trim(),
      businessPhoneNumber: form.businessPhoneNumber.trim(),
      accessToken: form.accessToken.trim(),
      ...(asCompanyDefault ? { asCompanyDefault: true } : {}),
    };
    setSaving(true);
    setError(null);
    setConnected(null);
    // El token no se conserva tras enviar, salga bien o mal.
    setForm((f) => ({ ...f, accessToken: "" }));
    try {
      const res = await connectCustomWaba(body);
      setConnected(res.data?.businessPhoneNumber || body.businessPhoneNumber);
      setForm(EMPTY);
    } catch (err) {
      setError(integrationsErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const connectWithFacebook = async () => {
    if (!signupConfig || !storeId) return;
    setSigningUp(true);
    setError(null);
    setConnected(null);
    try {
      const shared = await launchEmbeddedSignup(signupConfig);
      const res = await completeEmbeddedSignup({
        storeId,
        ...shared,
        ...(asCompanyDefault ? { asCompanyDefault: true } : {}),
      });
      setConnected(res.data?.businessPhoneNumber || "número de WhatsApp");
    } catch (err) {
      setError(
        err instanceof EmbeddedSignupCancelledError ? err.message : integrationsErrorMessage(err),
      );
    } finally {
      setSigningUp(false);
    }
  };

  return (
    <AjustesCard
      id="whatsapp"
      title="WhatsApp del negocio"
      description={
        <>
          Conecta el número con el que el negocio atiende por WhatsApp. Es el mismo número que usan
          la Bandeja y las notificaciones. Lo más simple es «Conectar con Facebook»; también puedes
          pegar los datos de WhatsApp Business de Meta (ID de la cuenta, ID del número y un token
          de acceso del usuario del sistema). Powip los valida con Meta antes de guardarlos.
        </>
      }
      canSave={complete}
      saving={saving}
      onSave={submit}
      error={error}
      saveLabel="Conectar número"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="waba-store">Tienda</Label>
          <select
            id="waba-store"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            checked={asCompanyDefault}
            onChange={(e) => setAsCompanyDefault(e.target.checked)}
          />
          Usar como número de toda la empresa
        </label>
      </div>
      <div className="space-y-2 rounded-md border p-3" data-testid="embedded-signup">
        <p className="text-xs font-medium">Conectar con Facebook</p>
        <p className="text-xs text-muted-foreground">
          Abre la ventana de Meta, elige o crea la cuenta de WhatsApp Business y el número. Powip
          guarda la conexión solo.
        </p>
        {signupConfig && !signupConfig.enabled && (
          <p className="text-xs text-muted-foreground" data-testid="embedded-signup-disabled">
            Falta configurar la app de Meta en el servidor (WHATSAPP_META_APP_ID,
            WHATSAPP_META_APP_SECRET y WHATSAPP_META_EMBEDDED_SIGNUP_CONFIG_ID). Mientras tanto usa
            los datos manuales.
          </p>
        )}
        {signupConfigError && (
          <p className="text-xs text-destructive">
            No se pudo leer la configuración: {signupConfigError}
          </p>
        )}
        {signupConfig?.simulated && (
          <p className="text-xs text-muted-foreground">Modo simulador local: no se abre Meta.</p>
        )}
        <Button
          type="button"
          onClick={() => void connectWithFacebook()}
          disabled={!signupConfig?.enabled || !storeId || signingUp || saving}
        >
          {signingUp ? "Conectando…" : "Conectar con Facebook"}
        </Button>
      </div>
      <p className="text-xs font-medium">O con datos manuales</p>
      <form
        className="grid gap-3 sm:grid-cols-2"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          if (complete && !saving) void submit();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="waba-id">ID de la cuenta de WhatsApp Business (WABA)</Label>
          <Input id="waba-id" value={form.wabaId} onChange={set("wabaId")} autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="waba-phone-id">ID del número de teléfono</Label>
          <Input
            id="waba-phone-id"
            value={form.phoneNumberId}
            onChange={set("phoneNumberId")}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="waba-phone">Número de WhatsApp del negocio</Label>
          <Input
            id="waba-phone"
            type="tel"
            placeholder="+51 999 999 999"
            value={form.businessPhoneNumber}
            onChange={set("businessPhoneNumber")}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="waba-token">Token de acceso</Label>
          <Input
            id="waba-token"
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
          <CheckCircle2 className="h-4 w-4" /> Número conectado: {connected}
        </p>
      )}
      <TemplatesStatus />
    </AjustesCard>
  );
}
