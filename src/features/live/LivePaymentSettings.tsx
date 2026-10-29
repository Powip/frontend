"use client";

import { ImagePlus, Loader2 } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { LiveErrorBanner, LivePanel } from "./LiveShared";
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
      setErrors({ yape: "" });
    } catch (cause) {
      if (!isCurrent() || request !== sequence.current) return;
      setConfig(null);
      setErrors({ yape: liveError(cause) });
    }
  }, [storeId, isCurrent]);
  useEffect(() => {
    active.current = true;
    lock.current = false;
    setBusy("");
    setConfig(null);
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
  const valid =
    !!config &&
    /^9\d{8}$/.test(config.phone) &&
    !!config.holder.trim() &&
    Number.isInteger(config.reviewHours) &&
    config.reviewHours >= 1 &&
    config.reviewHours <= 72;
  return (
    <div className="space-y-5">
      <LivePanel
        title="Yape del negocio"
        description="El cliente envía su comprobante y tu equipo valida el pago antes de confirmar el pedido."
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
        {!config ? (
          !errors.yape ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando Yape…
            </p>
          ) : null
        ) : (
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (valid)
                void run("yape", async () => {
                  const { qrUrl: _qrUrl, ...input } = config;
                  const result = await updateLiveYapeConfig(storeId, input);
                  if (isCurrent()) {
                    setConfig(result.config);
                    setNotice("Configuración de Yape guardada.");
                    onSaved?.();
                  }
                });
            }}
          >
            <label
              htmlFor="live-yape-enabled"
              className="flex items-center justify-between gap-4 text-sm font-semibold"
            >
              Permitir pagar por Yape
              <Switch
                id="live-yape-enabled"
                checked={config.enabled}
                disabled={!canManage || !!busy}
                onCheckedChange={(enabled) =>
                  setConfig((value) => (value ? { ...value, enabled } : value))
                }
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label htmlFor="live-yape-phone" className="grid gap-2 text-sm font-medium">
                Número Yape
                <Input
                  id="live-yape-phone"
                  inputMode="numeric"
                  maxLength={9}
                  placeholder="9 dígitos"
                  disabled={!canManage || !!busy}
                  value={config.phone}
                  onChange={(event) =>
                    setConfig((value) =>
                      value ? { ...value, phone: event.target.value.replace(/\D/g, "") } : value,
                    )
                  }
                />
              </label>
              <label htmlFor="live-yape-holder" className="grid gap-2 text-sm font-medium">
                Titular de la cuenta
                <Input
                  id="live-yape-holder"
                  maxLength={150}
                  disabled={!canManage || !!busy}
                  value={config.holder}
                  onChange={(event) =>
                    setConfig((value) => (value ? { ...value, holder: event.target.value } : value))
                  }
                />
              </label>
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
            <label
              htmlFor="live-yape-review-hours"
              className="grid max-w-sm gap-2 text-sm font-medium"
            >
              Plazo de revisión (horas)
              <Input
                id="live-yape-review-hours"
                type="number"
                min={1}
                max={72}
                step={1}
                disabled={!canManage || !!busy}
                value={config.reviewHours}
                onChange={(event) =>
                  setConfig((value) =>
                    value ? { ...value, reviewHours: Number(event.target.value) } : value,
                  )
                }
              />
              <span className="text-xs font-normal leading-relaxed text-muted-foreground">
                Al recibir el comprobante, el stock espera la revisión del negocio. Los pagos fuera
                de plazo siguen pendientes de una decisión.
              </span>
            </label>
            <Button type="submit" disabled={!canManage || !!busy || !valid}>
              {busy === "yape" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Guardar Yape
            </Button>
          </form>
        )}
      </LivePanel>
    </div>
  );
}
