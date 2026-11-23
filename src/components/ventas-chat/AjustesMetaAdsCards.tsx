"use client";
import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { crmError } from "@/services/crmService";
import { useCrmMe } from "@/hooks/useCrmMe";
import {
  useAudienceExports,
  useAudienceSegments,
  useCapiEvents,
  useExportAudience,
  useMetaAdAccounts,
  useMetaAdsSettings,
  useUpdateMetaAdsSettings,
} from "@/hooks/useCrmMetaAds";
import type {
  AudienceSegment,
  CapiEventItem,
  MetaAdsSettings,
} from "@/services/crmMetaAdsService";
import AjustesCard, { useDraft } from "./AjustesCard";
import { NATIVE_SELECT_CLASS } from "./format";

export const CAPI_STATUS_LABEL: Record<CapiEventItem["status"], string> = {
  pending: "Pendiente",
  sent: "Enviado",
  failed: "Falló",
  skipped: "No enviado",
};

const CAPI_STATUS_CLASS: Record<CapiEventItem["status"], string> = {
  pending: "bg-muted text-muted-foreground",
  sent: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
  skipped: "bg-amber-50 text-amber-700",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: currency || "PEN" }).format(value);

export function CapiStatusBadge({ status }: { status: CapiEventItem["status"] }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", CAPI_STATUS_CLASS[status])}>
      {CAPI_STATUS_LABEL[status]}
    </span>
  );
}

function MissingKeys({ settings }: { settings: MetaAdsSettings }) {
  const missing = [
    !settings.capiTokenConfigured && "META_CAPI_ACCESS_TOKEN",
    !settings.effectivePixelId && "META_CAPI_PIXEL_ID",
  ].filter(Boolean) as string[];
  if (settings.simulated) {
    return (
      <p className="text-xs text-amber-700">
        Modo de prueba: Meta está simulado en este servidor (META_GRAPH_ORIGIN). Nada sale a Meta.
      </p>
    );
  }
  if (missing.length === 0) return null;
  return (
    <p className="text-xs text-amber-700">
      Falta configurar en el servidor: {missing.join(", ")}. Sin eso las ventas no se envían.
    </p>
  );
}

/** Pixel y Conversions API: cada pedido verificado de un chat que vino de un anuncio se manda como Purchase. */
export function MetaCapiCard() {
  const settings = useMetaAdsSettings();
  const events = useCapiEvents();
  const update = useUpdateMetaAdsSettings();
  const server = {
    pixelId: settings.data?.pixelId ?? "",
    capiEnabled: settings.data?.capiEnabled ?? true,
  };
  const { draft, setDraft, dirty } = useDraft(server);
  const pixelValid = /^\d{0,30}$/.test(draft.pixelId.trim());

  if (settings.isLoading) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando Meta Ads…
      </p>
    );
  }
  if (settings.isError || !settings.data) {
    return (
      <p role="alert" className="text-sm text-destructive" data-testid="card-meta-capi">
        {crmError(settings.error).message}
      </p>
    );
  }
  const items = events.data ?? [];

  return (
    <AjustesCard
      id="meta-capi"
      title="Ventas a Meta (Conversions API)"
      description={
        <>
          Cuando un chat llega desde un anuncio de clic a WhatsApp y su pedido queda verificado,
          avisamos a Meta con un evento Purchase por el total del pedido. Así Meta optimiza tus
          anuncios para ventas y no solo para mensajes.
        </>
      }
      canSave={dirty && pixelValid}
      saving={update.isPending}
      hint={!pixelValid ? "El pixel es solo números." : null}
      onSave={() =>
        update.mutate({ pixelId: draft.pixelId.trim() || null, capiEnabled: draft.capiEnabled })
      }
    >
      <div className="flex items-center gap-2">
        <Switch
          id="capi-enabled"
          checked={draft.capiEnabled}
          onCheckedChange={(v) => setDraft((c) => ({ ...c, capiEnabled: v }))}
        />
        <Label htmlFor="capi-enabled">Enviar ventas a Meta</Label>
      </div>
      <div className="space-y-1">
        <Label htmlFor="capi-pixel" className="text-xs">
          Pixel o dataset de Meta (opcional)
        </Label>
        <Input
          id="capi-pixel"
          inputMode="numeric"
          className="max-w-xs"
          placeholder={settings.data.effectivePixelId ?? "123456789012345"}
          value={draft.pixelId}
          onChange={(e) => setDraft((c) => ({ ...c, pixelId: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          Vacío usa el pixel del servidor
          {settings.data.effectivePixelId && !draft.pixelId ? ` (${settings.data.effectivePixelId})` : ""}.
        </p>
      </div>
      <MissingKeys settings={settings.data} />

      <div className="space-y-2 border-t pt-3">
        <h3 className="text-xs font-semibold">Últimas ventas enviadas</h3>
        {events.isLoading ? (
          <p role="status" className="text-xs text-muted-foreground">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Todavía no hay ventas de chats que vinieron de anuncios.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs" data-testid="capi-log">
              <thead className="bg-muted/40">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Fecha</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Pedido</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Valor</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                      {formatDateTime(e.sentAt ?? e.createdAt)}
                    </td>
                    <td className="px-3 py-2">{e.orderNumber ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(Number(e.value), e.currency)}</td>
                    <td className="px-3 py-2" title={e.lastError ?? undefined}>
                      <CapiStatusBadge status={e.status} />
                      {e.lastError && e.status !== "sent" && (
                        <span className="ml-2 text-muted-foreground">{e.lastError}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AjustesCard>
  );
}

/** «Públicos para anuncios»: sube a Meta los teléfonos (cifrados) de un grupo de clientes. */
export function MetaAudienceCard() {
  const { stores } = useCrmMe();
  const [storeId, setStoreId] = useState("");
  const segments = useAudienceSegments(storeId);
  const accounts = useMetaAdAccounts();
  const history = useAudienceExports();
  const send = useExportAudience();
  const settings = useMetaAdsSettings();
  const [accountId, setAccountId] = useState("");
  const [sending, setSending] = useState<AudienceSegment | null>(null);

  const accountList = accounts.data?.items ?? [];
  const chosenAccount =
    accountId || settings.data?.defaultAdAccountId || accountList[0]?.id || "";
  const storeName = (id: string | null) =>
    id ? stores.find((s) => s.id === id)?.name ?? id : "Todas las tiendas";

  const run = (segment: AudienceSegment, label: string) => {
    if (!chosenAccount) return;
    setSending(segment);
    const day = new Date().toISOString().slice(0, 10);
    send.mutate(
      {
        segment,
        adAccountId: chosenAccount,
        name: `POWIP · ${label} · ${day}`,
        ...(storeId ? { storeId } : {}),
      },
      { onSettled: () => setSending(null) },
    );
  };

  const rows = history.data ?? [];
  return (
    <section
      aria-labelledby="meta-audience-title"
      className="space-y-3 rounded-md border bg-card p-4"
      data-testid="card-meta-audience"
    >
      <div className="space-y-1">
        <h2 id="meta-audience-title" className="text-sm font-semibold">
          Públicos para anuncios
        </h2>
        <p className="text-xs text-muted-foreground">
          Manda a Meta Ads un público personalizado con los teléfonos de estos clientes. Los
          teléfonos viajan cifrados (SHA-256) y nunca se incluye a quien pidió no recibir
          publicidad.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Cuenta publicitaria
          {accounts.isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <select
              aria-label="Cuenta publicitaria"
              value={chosenAccount}
              onChange={(e) => setAccountId(e.target.value)}
              className={cn(NATIVE_SELECT_CLASS, "w-auto min-w-48")}
              disabled={accountList.length === 0}
            >
              {accountList.length === 0 && <option value="">Sin cuentas</option>}
              {accountList.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.id})
                </option>
              ))}
            </select>
          )}
        </label>
        {stores.length > 1 && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Tienda
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className={cn(NATIVE_SELECT_CLASS, "w-auto min-w-40")}
            >
              <option value="">Todas las tiendas</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {accounts.isError && (
        <p role="alert" className="text-xs text-destructive">
          {crmError(accounts.error).message}
        </p>
      )}
      {accounts.data?.simulated && (
        <p className="text-xs text-amber-700">
          Modo de prueba: Meta está simulado en este servidor. Nada sale a Meta.
        </p>
      )}

      {segments.isLoading ? (
        <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Contando clientes…
        </p>
      ) : segments.isError ? (
        <p role="alert" className="text-xs text-destructive">
          {crmError(segments.error).message}
        </p>
      ) : (
        <ul className="divide-y rounded-md border" data-testid="audience-segments">
          {(segments.data ?? []).map((s) => (
            <li key={s.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{s.label}</p>
                <p className="text-xs text-muted-foreground">
                  {s.count} {s.count === 1 ? "contacto" : "contactos"} · {s.hint}
                  {s.lastSentAt ? ` · Último envío ${formatDateTime(s.lastSentAt)}` : ""}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!chosenAccount || s.count === 0 || send.isPending}
                onClick={() => run(s.key, s.label)}
                aria-label={`Enviar a Meta: ${s.label}`}
              >
                {sending === s.key ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="mr-1 h-3.5 w-3.5" />
                )}
                Enviar a Meta
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 border-t pt-3">
        <h3 className="text-xs font-semibold">Registro de públicos enviados</h3>
        {history.isLoading ? (
          <p role="status" className="text-xs text-muted-foreground">Cargando registro…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Todavía no se envió ningún público.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs" data-testid="audience-log">
              <thead className="bg-muted/40">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Fecha</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Público</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Tienda</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Contactos</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatDateTime(r.createdAt)}</td>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{storeName(r.storeId)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.contactCount}</td>
                    <td className="px-3 py-2" title={r.lastError ?? undefined}>
                      {r.status === "sent" ? (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                          Enviado
                        </span>
                      ) : (
                        <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
                          Falló
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
