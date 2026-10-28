"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { QuotationPaymentDestination, QuotationSettings } from "@/types/quotations";
import {
  getQuotationSettings,
  saveQuotationSettings,
  uploadQuotationPaymentQr,
} from "@/services/quotationSettingsService";
import { quotationError } from "@/services/quotationService";

const field =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-60";
const button =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50";
export default function QuotationPaymentSettings({ storeId }: { storeId: string }) {
  const [settings, setSettings] = useState<QuotationSettings | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    setSettings(null);
    setError("");
    setNotice("");
    setBusy(false);
    getQuotationSettings(storeId, controller.signal)
      .then((value) => {
        if (current === generation.current) setSettings(value);
      })
      .catch((cause) => {
        if (!controller.signal.aborted && current === generation.current)
          setError(quotationError(cause));
      });
    return () => {
      generation.current++;
      controller.abort();
    };
  }, [storeId]);
  function update(id: string, values: Partial<QuotationPaymentDestination>) {
    setNotice("");
    setSettings((current) =>
      current
        ? {
            ...current,
            destinations: current.destinations.map((destination) =>
              destination.id === id ? { ...destination, ...values } : destination,
            ),
          }
        : current,
    );
  }
  function add(method: QuotationPaymentDestination["method"]) {
    if (!settings || settings.destinations.length >= 8) return;
    setSettings({
      ...settings,
      destinations: [
        ...settings.destinations,
        {
          id: crypto.randomUUID(),
          method,
          label: method === "YAPE_QR" ? "Yape" : "Transferencia bancaria",
          holder: "",
          enabled: true,
        },
      ],
    });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings || busy) return;
    const current = generation.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await saveQuotationSettings(
        storeId,
        settings.version,
        settings.destinations.map((destination) => ({
          ...destination,
          enabled: destination.enabled !== false,
        })),
      );
      if (current === generation.current) {
        setSettings(updated);
        setNotice(
          "Datos de pago guardados. Los enlaces de esta tienda mostrarán los destinos habilitados.",
        );
      }
    } catch (cause) {
      if (current === generation.current) setError(quotationError(cause));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  async function upload(id: string, file?: File) {
    if (!file) return;
    const current = generation.current;
    setBusy(true);
    setError("");
    try {
      const qrUrl = await uploadQuotationPaymentQr(storeId, file);
      if (current === generation.current) update(id, { qrUrl });
    } catch (cause) {
      if (current === generation.current) setError(quotationError(cause));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="space-y-4">
      <p className="text-sm text-slate-600">
        Configura los datos que verán los clientes de esta tienda. Guarda únicamente cuentas
        autorizadas por tu negocio.
      </p>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-teal-50 p-3 text-sm text-teal-800">
          {notice}
        </p>
      )}
      {!settings && !error && (
        <p role="status" className="text-sm">
          Cargando configuración…
        </p>
      )}
      {settings && (
        <>
          {!settings.canManage && (
            <p className="text-sm text-amber-800">
              Solo un administrador puede modificar los destinos de pago.
            </p>
          )}
          {!settings.destinations.length && (
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              Todavía no hay destinos de pago configurados para esta tienda.
            </p>
          )}
          <fieldset disabled={busy || !settings.canManage} className="space-y-4">
            {settings.destinations.map((destination, index) => (
              <section
                key={destination.id}
                className="space-y-3 rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">
                    {destination.method === "YAPE_QR" ? "Yape" : "Transferencia"} {index + 1}
                  </h3>
                  <button
                    type="button"
                    className={button}
                    aria-label={`Eliminar destino ${index + 1}`}
                    onClick={() =>
                      setSettings({
                        ...settings,
                        destinations: settings.destinations.filter(
                          (item) => item.id !== destination.id,
                        ),
                      })
                    }
                  >
                    Eliminar
                  </button>
                </div>
                <label className="block text-sm">
                  Nombre del destino
                  <input
                    required
                    maxLength={80}
                    className={field}
                    value={destination.label}
                    onChange={(event) => update(destination.id, { label: event.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  Titular
                  <input
                    required
                    maxLength={150}
                    className={field}
                    value={destination.holder}
                    onChange={(event) => update(destination.id, { holder: event.target.value })}
                  />
                </label>
                {destination.method === "YAPE_QR" ? (
                  <>
                    <label className="block text-sm">
                      Número Yape
                      <input
                        required
                        inputMode="tel"
                        pattern="9[0-9]{8}"
                        maxLength={9}
                        className={field}
                        value={destination.phone ?? ""}
                        onChange={(event) => update(destination.id, { phone: event.target.value })}
                      />
                    </label>
                    <label className="block text-sm">
                      QR opcional (PNG, JPG o WebP, hasta 2 MB)
                      <input
                        className={field}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => void upload(destination.id, event.target.files?.[0])}
                      />
                    </label>
                    {destination.qrUrl && (
                      <p className="text-xs text-teal-700">
                        QR cargado. Guarda los cambios para publicarlo.
                        <button
                          type="button"
                          className="ml-2 underline"
                          onClick={() => update(destination.id, { qrUrl: undefined })}
                        >
                          Quitar QR
                        </button>
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <label className="block text-sm">
                      Banco
                      <input
                        required
                        maxLength={100}
                        className={field}
                        value={destination.bank ?? ""}
                        onChange={(event) => update(destination.id, { bank: event.target.value })}
                      />
                    </label>
                    <label className="block text-sm">
                      Número de cuenta
                      <input
                        inputMode="numeric"
                        maxLength={30}
                        className={field}
                        value={destination.accountNumber ?? ""}
                        onChange={(event) =>
                          update(destination.id, { accountNumber: event.target.value })
                        }
                      />
                    </label>
                    <label className="block text-sm">
                      CCI (20 dígitos)
                      <input
                        inputMode="numeric"
                        pattern="[0-9]{20}"
                        maxLength={20}
                        className={field}
                        value={destination.cci ?? ""}
                        onChange={(event) => update(destination.id, { cci: event.target.value })}
                      />
                    </label>
                  </>
                )}
                <label className="block text-sm">
                  Instrucciones opcionales
                  <textarea
                    maxLength={500}
                    className={field}
                    value={destination.instructions ?? ""}
                    onChange={(event) =>
                      update(destination.id, { instructions: event.target.value })
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={destination.enabled !== false}
                    onChange={(event) => update(destination.id, { enabled: event.target.checked })}
                  />
                  Visible para clientes
                </label>
              </section>
            ))}
            {settings.canManage && (
              <div className="flex flex-wrap gap-2">
                <button
                  className={button}
                  type="button"
                  disabled={settings.destinations.length >= 8}
                  onClick={() => add("YAPE_QR")}
                >
                  Añadir Yape
                </button>
                <button
                  className={button}
                  type="button"
                  disabled={settings.destinations.length >= 8}
                  onClick={() => add("TRANSFERENCIA")}
                >
                  Añadir transferencia
                </button>
              </div>
            )}
          </fieldset>
          {settings.canManage && (
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Guardando…" : "Guardar datos de pago"}
            </button>
          )}
        </>
      )}
    </form>
  );
}
