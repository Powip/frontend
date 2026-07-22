"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getEvaCredentials,
  saveEvaCredentials,
  testEvaConnection,
  EvaCredentialSafe,
  EvaClientType,
} from "@/services/evaService";

const API_INTEGRATIONS = (
  process.env.NEXT_PUBLIC_API_INTEGRATIONS || "http://localhost:3004"
).replace(/\/$/, "");

type SaveStep = "saving" | "testing" | "done";

const CLIENT_TYPE_OPTIONS: {
  value: EvaClientType;
  label: string;
  description: string;
}[] = [
  {
    value: "RECOJO",
    label: "Recojo",
    description: "EVA recoge el producto en tu almacén o punto de entrega.",
  },
  {
    value: "ALMACEN",
    label: "Almacén",
    description:
      "El producto ya está almacenado en el almacén de EVA (se identifica por SKU).",
  },
];

export default function EvaConfigPage() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;
  const token = auth?.accessToken;

  const [credential, setCredential] = useState<EvaCredentialSafe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [clientType, setClientType] = useState<EvaClientType>("RECOJO");

  // Save flow state
  const [saving, setSaving] = useState(false);
  const [saveStep, setSaveStep] = useState<SaveStep | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);

  // Copy feedback
  const [copied, setCopied] = useState(false);

  const loadCredential = useCallback(async () => {
    if (!companyId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const cred = await getEvaCredentials(token, companyId);
      setCredential(cred);
    } catch {
      setError("No se pudo cargar la configuración de EVA.");
    } finally {
      setLoading(false);
    }
  }, [token, companyId]);

  useEffect(() => {
    if (!companyId || !token) {
      // El auth aún no resolvió: no dejar el skeleton colgado indefinidamente.
      setLoading(false);
      return;
    }
    loadCredential();
  }, [companyId, token, loadCredential]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !companyId || !token) return;

    setSaving(true);
    setSaveError(null);
    setConnectionOk(null);

    try {
      // Paso 1: guardar credenciales
      setSaveStep("saving");
      await saveEvaCredentials(token, {
        companyId,
        apiKey,
        baseUrl: baseUrl.trim() || undefined,
        clientType,
      });

      // Paso 2: test de conexión — a diferencia de Aliclik, EVA rechaza con 401
      // (no devuelve { ok:false }) si la Api-Key es inválida; se captura acá para
      // no romper el flujo de guardado (la credencial ya quedó persistida).
      setSaveStep("testing");
      try {
        await testEvaConnection(token, companyId);
        setConnectionOk(true);
      } catch {
        setConnectionOk(false);
      }

      setSaveStep("done");
      setApiKey("");
      setBaseUrl("");

      // Paso 3: recargar credencial para reflejar isActive actualizado por el backend
      const refreshed = await getEvaCredentials(token, companyId);
      setCredential(refreshed);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } }; message?: string };
      setSaveError(
        axiosError?.response?.data?.message ||
          axiosError?.message ||
          "Error al guardar la configuración",
      );
      setSaveStep(null);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyWebhook = async () => {
    if (!companyId) return;
    const url = `${API_INTEGRATIONS}/eva/webhook/${companyId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback silencioso
    }
  };

  const handleReconfigure = () => {
    setSaveStep(null);
    setSaveError(null);
    setConnectionOk(null);
    setApiKey("");
    setBaseUrl("");
    setCredential(null);
  };

  const stepLabel: Record<SaveStep, string> = {
    saving: "Guardando credenciales...",
    testing: "Verificando conexión con EVA...",
    done: "¡Configuración guardada!",
  };

  if (!companyId) return null;

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        <div className="h-8 w-48 bg-gray-100 dark:bg-slate-700 rounded animate-pulse mb-4" />
        <div className="h-32 bg-gray-50 dark:bg-slate-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  const webhookUrl = `${API_INTEGRATIONS}/eva/webhook/${companyId}`;

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold dark:text-slate-100">Integración EVA Courier</h1>
          {credential !== null && (
            credential.isActive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-emerald-900/40 px-3 py-1 text-xs font-semibold text-green-700 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Integración activa
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Integración inactiva
              </span>
            )
          )}
          {credential === null && !loading && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-slate-700 px-3 py-1 text-xs font-semibold text-gray-500 dark:text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
              No configurada
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Conectá tu cuenta de EVA Courier (Fly Express) para despachar pedidos
          directamente desde Powip y recibir actualizaciones de estado por webhook.
        </p>
      </div>

      {/* Loading durante el guardado — visible independientemente del estado de credencial */}
      {saving && (
        <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-5">
          <div className="py-6 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-gray-700 dark:text-slate-200">
              {saveStep ? stepLabel[saveStep] : "Guardando..."}
            </p>
            <div className="flex gap-2">
              {(["saving", "testing"] as SaveStep[]).map((step) => (
                <div
                  key={step}
                  className={`h-1.5 w-8 rounded-full transition-all ${
                    saveStep === step ||
                    (saveStep === "testing" && step === "saving") ||
                    saveStep === "done"
                      ? "bg-blue-500"
                      : "bg-gray-200 dark:bg-slate-700"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Estado CONFIGURADO */}
      {!saving && credential && (
        <div className={`bg-white dark:bg-slate-800 border rounded-xl p-5 space-y-4 ${credential.isActive ? "border-green-200 dark:border-emerald-800" : "border-amber-200 dark:border-amber-800"}`}>
          {/* Alerta de conexión fallida — solo visible justo después de guardar con fallo */}
          {connectionOk === false && (
            <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-400">
              La conexión falló: revisá la Api-Key. La integración queda inactiva.
            </div>
          )}

          {/* Badge configurado */}
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${credential.isActive ? "bg-green-100 dark:bg-emerald-900/40" : "bg-amber-100 dark:bg-amber-900/40"}`}>
              {credential.isActive ? (
                <svg
                  className="w-5 h-5 text-green-600 dark:text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-amber-500 dark:text-amber-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  />
                </svg>
              )}
            </div>
            <div>
              <p className={`text-sm font-semibold ${credential.isActive ? "text-green-800 dark:text-emerald-400" : "text-amber-800 dark:text-amber-400"}`}>
                {credential.isActive ? "Cuenta conectada" : "Credenciales guardadas"}
              </p>
              {connectionOk === true && (
                <p className="text-xs text-green-600 dark:text-emerald-400">Conexión verificada con EVA</p>
              )}
              {connectionOk === null && (
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {credential.isActive
                    ? "La integración está activa. Ya podés enviar pedidos a EVA."
                    : "Actualizá la Api-Key y verificá la conexión para activar la integración."}
                </p>
              )}
            </div>
          </div>

          {/* Detalle de configuración */}
          <div className="border-t border-gray-200 dark:border-slate-700 pt-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-gray-400 dark:text-slate-500 uppercase font-bold text-[10px] mb-1">
                Api-Key
              </p>
              <p className="font-mono text-gray-700 dark:text-slate-200">
                {credential.maskedApiKey}
              </p>
            </div>
            <div>
              <p className="text-gray-400 dark:text-slate-500 uppercase font-bold text-[10px] mb-1">
                Tipo de cuenta
              </p>
              <p className="text-gray-700 dark:text-slate-200">
                {credential.clientType === "RECOJO" ? "Recojo" : "Almacén"}
              </p>
            </div>
            <div>
              <p className="text-gray-400 dark:text-slate-500 uppercase font-bold text-[10px] mb-1">
                Webhook secret
              </p>
              <p className="text-gray-700 dark:text-slate-200">
                {credential.hasWebhookSecret ? "Configurado" : "No configurado"}
              </p>
            </div>
            <div>
              <p className="text-gray-400 dark:text-slate-500 uppercase font-bold text-[10px] mb-1">
                URL base
              </p>
              <p className="text-gray-700 dark:text-slate-200 break-all">
                {credential.baseUrl || "Por defecto"}
              </p>
            </div>
          </div>

          {/* Sección Webhook */}
          <div className="border-t border-gray-200 dark:border-slate-700 pt-4 space-y-2">
            <p className="text-xs font-bold text-gray-700 dark:text-slate-200 uppercase tracking-wide">
              Webhook URL para EVA
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Copiá esta URL y configurala en el panel de EVA Courier como destino
              de notificaciones de estado de pedidos. La firma se valida con el
              webhook secret generado automáticamente al guardar la credencial.
            </p>
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2">
              <code className="text-xs text-gray-700 dark:text-slate-200 break-all flex-1">
                {webhookUrl}
              </code>
              <button
                type="button"
                aria-label="Copiar URL del webhook"
                onClick={handleCopyWebhook}
                className="flex-shrink-0 text-xs font-medium px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition"
              >
                {copied ? "¡Copiado!" : "Copiar"}
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-slate-400 border-t dark:border-slate-700 pt-3">
            Ya podés enviar pedidos a EVA directamente desde las vistas de
            Operaciones y CC.
          </p>

          <button
            type="button"
            onClick={handleReconfigure}
            className="text-xs text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition"
          >
            Actualizar credenciales →
          </button>
        </div>
      )}

      {/* Estado NO CONFIGURADO — formulario */}
      {!saving && !credential && (
        <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-5 space-y-4">
          <form onSubmit={handleSave} className="space-y-4">
            <h2 className="text-sm font-semibold dark:text-slate-100">Credenciales EVA</h2>

            {saveError && (
              <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-400">
                {saveError}
              </div>
            )}

            <div>
              <label
                htmlFor="eva-api-key"
                className="block text-xs font-medium mb-1 text-gray-600 dark:text-slate-300"
              >
                Api-Key de EVA
              </label>
              <input
                id="eva-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Api-Key de autenticación EVA"
                required
                className="w-full border dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="eva-base-url"
                className="block text-xs font-medium mb-1 text-gray-600 dark:text-slate-300"
              >
                URL base de la API{" "}
                <span className="text-gray-400 dark:text-slate-500 font-normal">(opcional)</span>
              </label>
              <input
                id="eva-base-url"
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.evacourier.pe (dejar vacío para usar la URL por defecto)"
                className="w-full border dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="eva-client-type"
                className="block text-xs font-medium mb-1 text-gray-600 dark:text-slate-300"
              >
                Tipo de cuenta EVA
              </label>
              <select
                id="eva-client-type"
                value={clientType}
                onChange={(e) => setClientType(e.target.value as EvaClientType)}
                className="w-full border dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CLIENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                {CLIENT_TYPE_OPTIONS.find((opt) => opt.value === clientType)?.description}
              </p>
            </div>

            <button
              type="submit"
              disabled={!apiKey}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Guardar y verificar conexión
            </button>

            <p className="text-xs text-gray-400 dark:text-slate-500 text-center">
              La Api-Key se almacena de forma segura y nunca se expone en la
              interfaz.
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
