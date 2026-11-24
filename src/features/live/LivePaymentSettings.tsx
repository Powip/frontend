"use client";

import { ImagePlus, Loader2 } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { LiveErrorBanner, LiveFieldError, LivePanel, LiveSaveState } from "./LiveShared";
import {
  type LiveYapeDraft,
  type LiveYapeErrors,
  liveYapeDraft,
  liveYapeErrors,
  liveYapeInput,
  sameYapeDraft,
  savedAtLabel,
} from "./liveSettingsForm";
import {
  getLiveYapeConfig,
  liveError,
  removeLiveYapeQr,
  safeLiveUrl,
  updateLiveYapeConfig,
  uploadLiveYapeQr,
  validateLivePaymentImage,
} from "./liveService";
import type { LiveYapeConfig } from "./types";

export default function LivePaymentSettings({
  storeId,
  canManage,
  onSaved,
}: {
  storeId: string;
  canManage: boolean;
  onSaved?: () => void;
}) {
  const [config, setConfig] = useState<LiveYapeConfig | null>(null);
  // FEAT-33 A1: borrador aparte de lo guardado, para saber qué cambió y poder descartarlo.
  const [draft, setDraft] = useState<LiveYapeDraft | null>(null);
  const [fieldErrors, setFieldErrors] = useState<LiveYapeErrors>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [errors, setErrors] = useState({ yape: "" });
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [qr, setQr] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const active = useRef(true);
  const lock = useRef(false);
  const scope = useRef(storeId);
  scope.current = storeId;
  const sequence = useRef(0);
  const isCurrent = useCallback(() => active.current && scope.current === storeId, [storeId]);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const result = await getLiveYapeConfig(storeId);
      if (!isCurrent() || request !== sequence.current) return;
      setConfig(result.config);
      setDraft(liveYapeDraft(result.config));
      setErrors({ yape: "" });
    } catch (cause) {
      if (!isCurrent() || request !== sequence.current) return;
      setConfig(null);
      setDraft(null);
      setErrors({ yape: liveError(cause) });
    }
  }, [storeId, isCurrent]);
  useEffect(() => {
    active.current = true;
    lock.current = false;
    setBusy("");
    setConfig(null);
    setDraft(null);
    setFieldErrors({});
    setSavedAt(null);
    setQr(null);
    setNotice("");
    if (inputRef.current) inputRef.current.value = "";
    void load();
    return () => {
      active.current = false;
      sequence.current += 1;
    };
  }, [load]);
  async function run(key: "yape", callback: () => Promise<void>) {
    if (lock.current || !canManage) return;
    lock.current = true;
    setBusy(key);
    setErrors({ yape: "" });
    setNotice("");
    try {
      await callback();
    } catch (cause) {
      if (isCurrent()) setErrors({ yape: liveError(cause) });
    } finally {
      if (isCurrent()) {
        lock.current = false;
        setBusy("");
      }
    }
  }
  const dirty = !!config && !!draft && !sameYapeDraft(draft, liveYapeDraft(config));
  const edit = <K extends keyof LiveYapeDraft>(key: K, value: LiveYapeDraft[K]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };
  function save() {
    if (!draft) return;
    const found = liveYapeErrors(draft);
    setFieldErrors(found);
    if (Object.keys(found).length) {
      toast.error("Revisa los campos marcados");
      return;
    }
    void run("yape", async () => {
      const result = await updateLiveYapeConfig(storeId, liveYapeInput(draft));
      if (!isCurrent()) return;
      setConfig(result.config);
      setDraft(liveYapeDraft(result.config));
      setSavedAt(savedAtLabel());
      toast.success(
        `✓ Yape guardado · el catálogo ya muestra ${result.config.phone.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")}`,
      );
      onSaved?.();
    });
  }
  return (
    <div id="live-yape-settings" tabIndex={-1} className="space-y-5">
      <LivePanel
        title="Yape del negocio"
        description="El cliente yapea a este número y envía su número de operación. Tu equipo valida el ingreso antes de confirmar el pedido."
        aside={<LiveSaveState dirty={dirty} savedAt={savedAt} />}
      >
        {errors.yape ? (
          <div className="mb-4">
            <LiveErrorBanner message={errors.yape} onRetry={() => void load()} />
          </div>
        ) : null}
        {notice ? (
          <p role="status" className="mb-4 rounded-xl bg-teal-50 p-3 text-sm text-teal-900">
            {notice}
          </p>
        ) : null}
        {!config || !draft ? (
          !errors.yape ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando Yape…
            </p>
          ) : null
        ) : (
          <form
            noValidate
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <label
              htmlFor="live-yape-enabled"
              className="flex items-center justify-between gap-4 text-sm font-semibold"
            >
              Permitir pagar por Yape
              <Switch
                id="live-yape-enabled"
                checked={draft.enabled}
                disabled={!canManage || !!busy}
                onCheckedChange={(enabled) => edit("enabled", enabled)}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid content-start gap-2 text-sm font-medium">
                <label htmlFor="live-yape-phone">Número Yape</label>
                <Input
                  id="live-yape-phone"
                  inputMode="tel"
                  maxLength={16}
                  placeholder="9 dígitos"
                  disabled={!canManage || !!busy}
                  value={draft.phone}
                  aria-invalid={fieldErrors.phone ? true : undefined}
                  aria-describedby={fieldErrors.phone ? "live-yape-phone-error" : undefined}
                  onChange={(event) => edit("phone", event.target.value)}
                />
                <LiveFieldError id="live-yape-phone-error" message={fieldErrors.phone} />
              </div>
              <div className="grid content-start gap-2 text-sm font-medium">
                <label htmlFor="live-yape-holder">Titular de la cuenta</label>
                <Input
                  id="live-yape-holder"
                  maxLength={150}
                  disabled={!canManage || !!busy}
                  value={draft.holder}
                  aria-invalid={fieldErrors.holder ? true : undefined}
                  aria-describedby={fieldErrors.holder ? "live-yape-holder-error" : undefined}
                  onChange={(event) => edit("holder", event.target.value)}
                />
                <LiveFieldError id="live-yape-holder-error" message={fieldErrors.holder} />
              </div>
            </div>
            <div className="flex flex-wrap items-start gap-4 rounded-xl border bg-muted/20 p-4">
              {safeLiveUrl(config.qrUrl) ? (
                <Image
                  src={config.qrUrl ?? ""}
                  alt="QR Yape del negocio"
                  width={144}
                  height={144}
                  unoptimized
                  className="h-36 w-36 rounded-xl border bg-white object-contain p-2"
                />
              ) : (
                <div className="grid h-32 w-32 place-items-center rounded-xl border border-dashed text-xs text-muted-foreground">
                  Sin QR
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-3">
                <label htmlFor="live-yape-qr" className="grid gap-2 text-sm font-medium">
                  QR del negocio (opcional)
                  <Input
                    ref={inputRef}
                    id="live-yape-qr"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={!canManage || !!busy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      setQr(null);
                      if (!file) return;
                      try {
                        validateLivePaymentImage(file);
                        setQr(file);
                        setErrors((value) => ({ ...value, yape: "" }));
                      } catch (cause) {
                        setErrors((value) => ({ ...value, yape: liveError(cause) }));
                        event.target.value = "";
                      }
                    }}
                  />
                  <span className="text-xs font-normal text-muted-foreground">
                    Imagen JPG, PNG o WebP, hasta 5 MB. El cliente también puede copiar el número.
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canManage || !!busy || !qr}
                    onClick={() => {
                      if (qr)
                        void run("yape", async () => {
                          const result = await uploadLiveYapeQr(storeId, qr);
                          if (isCurrent()) {
                            setConfig((value) =>
                              value ? { ...value, qrUrl: result.config.qrUrl } : result.config,
                            );
                            setQr(null);
                            if (inputRef.current) inputRef.current.value = "";
                            setNotice("QR actualizado.");
                          }
                        });
                    }}
                  >
                    <ImagePlus className="h-4 w-4" />
                    Subir QR
                  </Button>
                  {config.qrUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!canManage || !!busy}
                      onClick={() =>
                        void run("yape", async () => {
                          const result = await removeLiveYapeQr(storeId);
                          if (isCurrent())
                            setConfig((value) =>
                              value ? { ...value, qrUrl: result.config.qrUrl } : result.config,
                            );
                        })
                      }
                    >
                      Quitar QR
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="grid max-w-sm gap-2 text-sm font-medium">
              <label htmlFor="live-yape-review-hours">Plazo de revisión (horas)</label>
              <Input
                id="live-yape-review-hours"
                inputMode="numeric"
                disabled={!canManage || !!busy}
                value={draft.reviewHours}
                aria-invalid={fieldErrors.reviewHours ? true : undefined}
                aria-describedby={
                  fieldErrors.reviewHours
                    ? "live-yape-hours-error live-yape-hours-help"
                    : "live-yape-hours-help"
                }
                onChange={(event) => edit("reviewHours", event.target.value)}
              />
              <LiveFieldError id="live-yape-hours-error" message={fieldErrors.reviewHours} />
              <span
                id="live-yape-hours-help"
                className="text-xs font-normal leading-relaxed text-muted-foreground"
              >
                Entre 1 y 72. El stock queda reservado mientras tu equipo revisa el comprobante. Si
                se vence, el pago sigue en la cola con «requiere una decisión».
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!canManage || !!busy || !dirty}>
                {busy === "yape" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Guardar Yape
              </Button>
              {dirty ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => {
                    setDraft(liveYapeDraft(config));
                    setFieldErrors({});
                  }}
                >
                  Descartar
                </Button>
              ) : null}
            </div>
          </form>
        )}
      </LivePanel>
    </div>
  );
}
