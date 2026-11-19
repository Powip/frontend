"use client";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { crmError } from "@/services/crmService";
import { connectCustomWaba, integrationsErrorMessage } from "@/services/crmTeamService";
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

/** Conecta el número de WhatsApp Business del negocio con ms-integrations. */
export default function AjustesWhatsAppCard() {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<string | null>(null);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const complete = Object.values(form).every((v) => v.trim().length > 0);

  const submit = async () => {
    const body = {
      wabaId: form.wabaId.trim(),
      phoneNumberId: form.phoneNumberId.trim(),
      businessPhoneNumber: form.businessPhoneNumber.trim(),
      accessToken: form.accessToken.trim(),
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

  return (
    <AjustesCard
      id="whatsapp"
      title="WhatsApp del negocio"
      description={
        <>
          Conecta el número con el que el negocio atiende por WhatsApp. Necesitas los datos de
          WhatsApp Business de Meta del negocio (ID de la cuenta, ID del número y un token de acceso
          del usuario del sistema). Powip los valida con Meta antes de guardarlos.
        </>
      }
      canSave={complete}
      saving={saving}
      onSave={submit}
      error={error}
      saveLabel="Conectar número"
    >
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
