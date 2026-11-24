"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  LiveFieldError,
  LivePanel,
  LiveSaveBar,
  LiveSaveState,
} from "./LiveShared";
import {
  type LiveConfigDraft,
  type LiveConfigErrors,
  liveConfigChanges,
  liveConfigDraft,
  liveConfigErrors,
  savedAtLabel,
} from "./liveSettingsForm";
import type { LiveConfig, LiveReadiness } from "./types";
import { liveLinks } from "./liveLinks";
import { LIVE_ACCENTS, liveAppearance, liveEffectiveAccent } from "./liveAppearance";
import { LiveLookPreview } from "./LiveBrand";

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
/** FEAT-33 B5: lo que el servidor también revisa (el cuadrado lo revisa solo el servidor). */
function logoError(file: File) {
  if (!LOGO_TYPES.includes(file.type)) return "El logo debe ser PNG, JPG, WebP o SVG.";
  if (file.size > 2 * 1024 * 1024) return "El logo debe pesar como máximo 2 MB.";
  return "";
}

type SwitchKey =
  | "showBackLink"
  | "hideSoldOut"
  | "allowAccumulation"
  | "allowReservations"
  | "combineShipping";

const SWITCHES: Record<SwitchKey, { title: string; text: string }> = {
  showBackLink: {
    title: "Mostrar “Volver al live”",
    text: "Lleva al cliente de vuelta a tu transmisión sin perder su pedido.",
  },
  hideSoldOut: {
    title: "Ocultar variantes sin stock",
    text: "Las tallas y colores agotados no aparecen en el catálogo del live.",
  },
  allowAccumulation: {
    title: "Clientes de confianza acumulan sin vencimiento",
    text: "Los marcas en Apartados › Separado sin pagar.",
  },
  allowReservations: {
    title: "Apartar productos",
    text: "Reserva stock mientras el cliente completa el pago.",
  },
  combineShipping: {
    title: "Juntar compras en un envío",
    text: "Suma las compras del día al pedido que aún no se despachó.",
  },
};

/**
 * FEAT-33 A1/B4: Configuración del catálogo del live. Error debajo de cada campo, nada se guarda
 * con errores, «● Cambios sin guardar» con barra fija y se manda solo lo que cambió.
 */
export default function LiveConfigPanel({
  config,
  storeName = "",
  readiness,
  onConsole,
  canManage,
  busy,
  onSave,
  onLogo,
}: {
  config: LiveConfig;
  /** Nombre de la tienda: el que ve el cliente si no se escribe otro. */
  storeName?: string;
  readiness?: LiveReadiness;
  onConsole: () => void;
  canManage: boolean;
  busy: boolean;
  onSave: (changes: Partial<LiveConfig>) => Promise<boolean>;
  /** FEAT-33 B5: sube (`File`) o quita (`null`) el logo; se llama al guardar. */
  onLogo?: (file: File | null) => Promise<boolean>;
}) {
  // Solo se guardan las ediciones: lo que no se tocó sigue al servidor en cada actualización.
  const [linkOrigin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  const [edits, setEdits] = useState<Partial<LiveConfigDraft>>({});
  const [errors, setErrors] = useState<LiveConfigErrors>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [logoEdit, setLogoEdit] = useState<{ file: File; url: string } | "remove" | null>(null);
  const [logoProblem, setLogoProblem] = useState("");
  const draft: LiveConfigDraft = { ...liveConfigDraft(config), ...edits };
  const changes = liveConfigChanges(config, draft);
  const dirty = Object.keys(changes).length > 0 || logoEdit !== null;
  const look = liveAppearance(
    {
      theme: draft.theme,
      color: /^#[0-9a-f]{6}$/i.test(draft.color.trim()) ? draft.color.trim() : undefined,
      displayName: draft.displayName,
      logoUrl:
        logoEdit === "remove"
          ? null
          : logoEdit
            ? logoEdit.url
            : config.appearance?.logoUrl,
    },
    storeName || "Tu tienda",
  );
  const accentWarning = liveEffectiveAccent(look).warning;
  const replaceLogo = (next: { file: File; url: string } | "remove" | null) => {
    setLogoEdit((current) => {
      if (current && current !== "remove") URL.revokeObjectURL(current.url);
      return next;
    });
  };
  const pickLogo = (file: File | undefined) => {
    if (!file) return;
    const problem = logoError(file);
    setLogoProblem(problem);
    if (!problem) replaceLogo({ file, url: URL.createObjectURL(file) });
  };
  const disabled = !canManage || busy;
  const set = <K extends keyof LiveConfigDraft>(
    key: K,
    value: LiveConfigDraft[K],
  ) => {
    setEdits((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      if (key === "showBackLink") delete next.liveUrl;
      return next;
    });
  };
  const discard = () => {
    setEdits({});
    setErrors({});
    replaceLogo(null);
    setLogoProblem("");
  };
  async function save() {
    const found = liveConfigErrors(config, draft);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error("Revisa los campos marcados");
      return;
    }
    if (!dirty) return;
    if (Object.keys(changes).length) {
      if (!(await onSave(changes))) return;
      setEdits({});
    }
    if (logoEdit && onLogo) {
      if (!(await onLogo(logoEdit === "remove" ? null : logoEdit.file))) return;
      replaceLogo(null);
    }
    setSavedAt(savedAtLabel());
  }

  const activationPending = draft.enabled && !config.enabled;
  const deactivationPending = !draft.enabled && config.enabled;
  const shippingPending = readiness?.checks.some(
    (check) => check.code === "SHIPPING" && !check.ready,
  );
  const activationMessage = activationPending
    ? "Activación sin guardar. Guarda esta configuración para habilitar las compras y poder abrir el catálogo."
    : deactivationPending
      ? "Desactivación sin guardar. Las compras siguen habilitadas hasta que guardes esta configuración."
      : readiness?.ready !== true
        ? shippingPending
          ? "Configura las tarifas en Configuración de tienda → Envíos. Después de completar los demás requisitos podrás habilitar las compras."
          : "Completa los requisitos pendientes de arriba. Puedes guardar esta configuración con las compras desactivadas."
        : config.enabled
          ? "Compras habilitadas. Vuelve a Consola en vivo para gestionar el catálogo."
          : "Todo listo. Activa «Habilitar compras del live» y guarda para poder abrir el catálogo.";
  const saveLabel = busy
    ? "Guardando configuración…"
    : activationPending
      ? "Guardar y habilitar compras"
      : deactivationPending
        ? "Guardar y desactivar compras"
        : "Guardar configuración";
  const describedBy = (...ids: (string | false)[]) =>
    ids.filter(Boolean).join(" ") || undefined;
  const toggle = (key: SwitchKey) => (
    <label
      key={key}
      htmlFor={`live-setting-${key}`}
      className="flex items-center justify-between gap-4 border-t py-4"
    >
      <span>
        <span className="block text-sm font-semibold">
          {SWITCHES[key].title}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {SWITCHES[key].text}
        </span>
      </span>
      <Switch
        id={`live-setting-${key}`}
        aria-label={SWITCHES[key].title}
        checked={draft[key]}
        disabled={disabled}
        onCheckedChange={(checked) => set(key, checked)}
      />
    </label>
  );

  return (
    <LivePanel
      title="Configura tu catálogo del live"
      description="El video se transmite en la red social. Aquí gestionas las compras y el stock."
      aside={<LiveSaveState dirty={dirty} savedAt={savedAt} />}
    >
      <form
        noValidate
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <label
          htmlFor="live-enabled"
          className="flex items-center justify-between gap-4 rounded-xl border p-4 text-sm font-semibold"
        >
          <span>
            Habilitar compras del live
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              Abre el catálogo del live para tu audiencia.
            </span>
          </span>
          <Switch
            id="live-enabled"
            checked={draft.enabled}
            aria-describedby="live-activation-help"
            disabled={disabled || (!draft.enabled && readiness?.ready !== true)}
            onCheckedChange={(enabled) => set("enabled", enabled)}
          />
        </label>
        <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
          <p
            id="live-activation-help"
            className="text-sm text-muted-foreground"
          >
            {activationMessage}
          </p>
          {config.enabled && draft.enabled && readiness?.ready && canManage ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onConsole}
              disabled={busy}
            >
              Ir a Consola en vivo
            </Button>
          ) : null}
        </div>
        <div className="grid gap-2 text-sm font-medium">
          <label htmlFor="live-url">Link de tu live o perfil</label>
          <Input
            id="live-url"
            inputMode="url"
            placeholder="https://www.tiktok.com/@tunegocio/live"
            value={draft.liveUrl}
            disabled={disabled}
            aria-invalid={errors.liveUrl ? true : undefined}
            aria-describedby={describedBy(
              !!errors.liveUrl && "live-url-error",
              "live-url-help",
            )}
            onChange={(event) => set("liveUrl", event.target.value)}
          />
          <LiveFieldError id="live-url-error" message={errors.liveUrl} />
          <span
            id="live-url-help"
            className="text-xs font-normal text-muted-foreground"
          >
            Enlace HTTPS de TikTok, Instagram, Facebook o YouTube.
          </span>
        </div>
        <div>
          {toggle("showBackLink")}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t py-4">
            <span>
              <span className="block text-sm font-semibold">Envío</span>
              <span
                id="live-shipping-settings"
                tabIndex={-1}
                className="mt-1 block text-xs text-muted-foreground"
              >
                Se usan las coberturas y tarifas de{" "}
                <a
                  className="font-medium text-teal-700 underline"
                  href="/configuracion/tiendas"
                >
                  Configuración de tienda → Envíos
                </a>
                .
              </span>
            </span>
          </div>
          {toggle("hideSoldOut")}
          {toggle("allowAccumulation")}
          {toggle("allowReservations")}
          {toggle("combineShipping")}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid content-start gap-2 text-sm font-medium">
            <label htmlFor="live-reservation-minutes">Minutos para pagar</label>
            <Input
              id="live-reservation-minutes"
              inputMode="numeric"
              value={draft.reservationMinutes}
              disabled={disabled}
              aria-invalid={errors.reservationMinutes ? true : undefined}
              aria-describedby={describedBy(
                !!errors.reservationMinutes && "live-minutes-error",
                "live-minutes-help",
              )}
              onChange={(event) =>
                set("reservationMinutes", event.target.value)
              }
            />
            <LiveFieldError
              id="live-minutes-error"
              message={errors.reservationMinutes}
            />
            <span
              id="live-minutes-help"
              className="text-xs font-normal text-muted-foreground"
            >
              Sugerido 15: entre elegir, poner su dirección y yapear, 5 minutos
              no alcanzan.
            </span>
          </div>
          <div className="grid content-start gap-2 text-sm font-medium">
            <label htmlFor="live-max-reserved">
              Máximo de unidades separadas
            </label>
            <Input
              id="live-max-reserved"
              inputMode="numeric"
              value={draft.maxReservedUnits}
              disabled={disabled}
              aria-invalid={errors.maxReservedUnits ? true : undefined}
              aria-describedby={describedBy(
                !!errors.maxReservedUnits && "live-max-error",
                "live-max-help",
              )}
              onChange={(event) => set("maxReservedUnits", event.target.value)}
            />
            <LiveFieldError
              id="live-max-error"
              message={errors.maxReservedUnits}
            />
            <span
              id="live-max-help"
              className="text-xs font-normal text-muted-foreground"
            >
              Entre 1 y 50 por cliente.
            </span>
          </div>
          <div className="grid content-start gap-2 text-sm font-medium">
            <label htmlFor="live-close-policy">Catálogo después del live</label>
            <select
              id="live-close-policy"
              className="h-9 rounded-lg border bg-background px-3 text-sm"
              value={draft.closePolicy}
              disabled={disabled}
              onChange={(event) =>
                set(
                  "closePolicy",
                  event.target.value as LiveConfig["closePolicy"],
                )
              }
            >
              <option value="END_OF_DAY">Hasta las 11:59 pm</option>
              <option value="24_HOURS">24 horas</option>
              <option value="MANUAL">Hasta que lo cierre</option>
            </select>
          </div>
        </div>
        <div className="grid gap-2 text-sm font-medium">
          <label htmlFor="live-slug">Nombre del enlace público</label>
          <Input
            id="live-slug"
            value={draft.slug}
            disabled={disabled}
            aria-invalid={errors.slug ? true : undefined}
            aria-describedby={describedBy(
              !!errors.slug && "live-slug-error",
              "live-slug-help",
            )}
            onChange={(event) => set("slug", event.target.value.toLowerCase())}
          />
          <LiveFieldError id="live-slug-error" message={errors.slug} />
          <span
            id="live-slug-help"
            className="text-xs font-normal text-muted-foreground"
          >
            {liveLinks({ origin: linkOrigin, slug: draft.slug.trim() || "tienda" }).displayUrl}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          El tope de unidades no aplica a clientes de confianza. El máximo por
          producto se configura en Productos del live.
        </p>
        <section aria-labelledby="live-look-title" className="grid gap-4 border-t pt-4">
          <div>
            <h3 id="live-look-title" className="font-semibold">
              Apariencia del catálogo
            </h3>
            <p className="text-sm text-muted-foreground">
              Cómo ve el cliente tu catálogo. Se guarda junto con la configuración.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_300px]">
            <div className="grid content-start gap-4">
              <div className="grid gap-2 text-sm font-medium">
                <span>Fondo</span>
                <div className="flex gap-2">
                  {(
                    [
                      ["dark", "Oscuro", "#0b0d11"],
                      ["light", "Claro", "#ffffff"],
                    ] as const
                  ).map(([value, label, swatch]) => (
                    <button
                      key={value}
                      type="button"
                      disabled={disabled}
                      aria-pressed={draft.theme === value}
                      onClick={() => set("theme", value)}
                      className="flex min-h-11 items-center gap-2 rounded-lg border px-3 aria-pressed:border-primary aria-pressed:bg-primary/5 aria-pressed:font-semibold"
                    >
                      <span
                        aria-hidden="true"
                        className="h-[18px] w-[18px] rounded border"
                        style={{ background: swatch }}
                      />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2 text-sm font-medium">
                <span>Color de tu marca</span>
                <div className="flex flex-wrap items-center gap-2">
                  {LIVE_ACCENTS.map((accent) => (
                    <button
                      key={accent.color}
                      type="button"
                      disabled={disabled}
                      aria-label={accent.label}
                      title={accent.label}
                      aria-pressed={draft.color.trim().toLowerCase() === accent.color}
                      onClick={() => set("color", accent.color)}
                      className="h-[34px] w-[34px] rounded-full border-2 border-white shadow-[0_0_0_1px_var(--border)] aria-pressed:shadow-[0_0_0_2px_var(--foreground)]"
                      style={{ background: accent.color }}
                    />
                  ))}
                  <label
                    title="Otro color"
                    className="relative grid h-[34px] w-[34px] cursor-pointer place-items-center overflow-hidden rounded-full border-2 border-white font-bold text-white shadow-[0_0_0_1px_var(--border)]"
                    style={{
                      background: "conic-gradient(#f37ea3,#ffb547,#72efe8,#8b6cff,#f37ea3)",
                    }}
                  >
                    +
                    <input
                      type="color"
                      aria-label="Otro color"
                      disabled={disabled}
                      value={/^#[0-9a-f]{6}$/i.test(draft.color.trim()) ? draft.color.trim() : "#72efe8"}
                      onChange={(event) => set("color", event.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>
                <LiveFieldError id="live-color-error" message={errors.color} />
                {accentWarning ? (
                  <p role="status" className="text-xs font-normal text-amber-700">
                    {accentWarning}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-2 text-sm font-medium">
                <span>Logo</span>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex min-h-10 cursor-pointer items-center rounded-md border px-3 text-sm">
                    ⬆ {look.logoUrl ? "Cambiar logo" : "Subir logo"}
                    <input
                      type="file"
                      hidden
                      aria-label="Subir logo"
                      aria-describedby="live-logo-help"
                      accept={LOGO_TYPES.join(",")}
                      disabled={disabled || !onLogo}
                      onChange={(event) => {
                        pickLogo(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  {look.logoUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={disabled || !onLogo}
                      onClick={() => {
                        setLogoProblem("");
                        replaceLogo(config.appearance?.logoUrl ? "remove" : null);
                      }}
                    >
                      Quitar logo
                    </Button>
                  ) : null}
                </div>
                <span id="live-logo-help" className="text-xs font-normal text-muted-foreground">
                  Cuadrado, PNG o SVG, hasta 2 MB. Sin logo se usan tus iniciales.
                </span>
                <LiveFieldError id="live-logo-error" message={logoProblem} />
              </div>
              <div className="grid gap-2 text-sm font-medium">
                <label htmlFor="live-display-name">Nombre que ve el cliente</label>
                <Input
                  id="live-display-name"
                  value={draft.displayName}
                  placeholder={storeName}
                  maxLength={80}
                  disabled={disabled}
                  aria-invalid={errors.displayName ? true : undefined}
                  aria-describedby={describedBy(!!errors.displayName && "live-display-name-error")}
                  onChange={(event) => set("displayName", event.target.value)}
                />
                <LiveFieldError id="live-display-name-error" message={errors.displayName} />
              </div>
            </div>
            <div className="grid content-start gap-2 text-sm font-medium">
              <span>Vista previa</span>
              <LiveLookPreview look={look} />
            </div>
          </div>
        </section>
        {dirty ? (
          <LiveSaveBar message="Tienes cambios sin guardar en el catálogo">
            <Button
              type="button"
              variant="outline"
              className="border-slate-600 bg-transparent text-white hover:bg-slate-800 hover:text-white"
              disabled={busy}
              onClick={discard}
            >
              Descartar
            </Button>
            <Button
              type="button"
              disabled={disabled}
              onClick={() => void save()}
            >
              Guardar cambios
            </Button>
          </LiveSaveBar>
        ) : null}
        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <Button type="submit" disabled={disabled || !dirty}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saveLabel}
          </Button>
        </div>
      </form>
    </LivePanel>
  );
}
