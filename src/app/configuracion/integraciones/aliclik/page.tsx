"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAliclikCredentials,
  saveAliclikCredentials,
  testAliclikConnection,
  updateAliclikStore,
  AliclikCredentialSafe,
} from "@/services/aliclikService";
import { fetchCompanyById } from "@/services/companyService";

const API_INTEGRATIONS = (
  process.env.NEXT_PUBLIC_API_INTEGRATIONS || "http://localhost:3004"
).replace(/\/$/, "");

type SaveStep = "saving" | "testing" | "done";

export default function AliclikConfigPage() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;
  const token = auth?.accessToken;

  const [credential, setCredential] = useState<AliclikCredentialSafe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [bearerToken, setBearerToken] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  // Save flow state
  const [saving, setSaving] = useState(false);
  const [saveStep, setSaveStep] = useState<SaveStep | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);

  // Copy feedback
  const [copied, setCopied] = useState(false);

  // Store selector state
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [savingStore, setSavingStore] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [storeSaved, setStoreSaved] = useState(false);

  const loadCredential = useCallback(async () => {
    if (!companyId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const cred = await getAliclikCredentials(token, companyId);
      setCredential(cred);
    } catch {
      setError("No se pudo cargar la configuración de Aliclik.");
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

  useEffect(() => {
    if (!companyId || !token) return;
    fetchCompanyById(companyId, token)
      .then((company) => setStores(company?.stores ?? []))
      .catch(() => setStores([]));
  }, [companyId, token]);

  useEffect(() => {
    setSelectedStoreId(credential?.importStoreId ?? "");
  }, [credential]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bearerToken || !companyId || !token) return;

    setSaving(true);
    setSaveError(null);
    setConnectionOk(null);

    try {
      // Paso 1: guardar credenciales
      setSaveStep("saving");
      await saveAliclikCredentials(token, {
        companyId,
        token: bearerToken,
        baseUrl: baseUrl.trim() || undefined,
      });

      // Paso 2: test de conexión (el backend activa/desactiva isActive según resultado)
      setSaveStep("testing");
      const testResult = await testAliclikConnection(token, companyId);
      setConnectionOk(testResult.ok);

      setSaveStep("done");
      setBearerToken("");
      setBaseUrl("");

      // Paso 3: recargar credencial para reflejar isActive actualizado por el backend
      const refreshed = await getAliclikCredentials(token, companyId);
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
    if (!credential?.webhookSecret) return;
    const url = `${API_INTEGRATIONS}/aliclik/webhook/order-status/${credential.webhookSecret}`;
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
    setBearerToken("");
    setBaseUrl("");
    setCredential(null);
  };

  const handleSaveStore = async () => {
    if (!token || !companyId) return;
    setSavingStore(true);
    setStoreError(null);
    setStoreSaved(false);
    try {
      const updated = await updateAliclikStore(
        token,
        companyId,
        selectedStoreId || null,
      );
      setCredential(updated);
      setStoreSaved(true);
      setTimeout(() => setStoreSaved(false), 2500);
    } catch {
      setStoreError("No se pudo guardar el store. Intentá de nuevo.");
    } finally {
      setSavingStore(false);
    }
  };

  const stepLabel: Record<SaveStep, string> = {
    saving: "Guardando credenciales...",
    testing: "Verificando conexión con Aliclik...",
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

  const webhookUrl = credential?.webhookSecret
    ? `${API_INTEGRATIONS}/aliclik/webhook/order-status/${credential.webhookSecret}`
    : null;

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold dark:text-slate-100">Integración Aliclik</h1>
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
          Conectá tu cuenta Aliclik para despachar pedidos directamente desde
          Powip y recibir actualizaciones de estado por webhook.
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
              La conexión falló: revisá el token. La integración queda inactiva.
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
                <p className="text-xs text-green-600 dark:text-emerald-400">Conexión verificada con Aliclik</p>
              )}
              {connectionOk === null && (
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {credential.isActive
                    ? "La integración está activa. Los crons de catálogo e inbound están habilitados."
                    : "Actualizar el token y verificar la conexión para activar la integración."}
                </p>
              )}
            </div>
          </div>

          {/* Sección Webhook */}
          {webhookUrl && (
            <div className="border-t border-gray-200 dark:border-slate-700 pt-4 space-y-2">
              <p className="text-xs font-bold text-gray-700 dark:text-slate-200 uppercase tracking-wide">
                Webhook URL para Aliclik
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Copiá esta URL y configurala en el panel de Aliclik como destino
                de notificaciones de estado de pedidos.
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
          )}

          {/* Sección Store destino para pedidos importados */}
          <div className="border-t border-gray-200 dark:border-slate-700 pt-4 space-y-3">
            <p className="text-xs font-bold text-gray-700 dark:text-slate-200 uppercase tracking-wide">
              Store destino para pedidos importados
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Los pedidos creados directamente en Aliclik se importarán como
              borradores en este store. Dejá en blanco para no asignar store
              automáticamente.
            </p>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="aliclik-import-store"
                className="block text-xs font-medium text-gray-600 dark:text-slate-300"
              >
                Store destino
              </label>
              <select
                id="aliclik-import-store"
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                disabled={savingStore}
                className="w-full border dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">Sin store destino</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
              {storeError && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {storeError}
                </p>
              )}
              {storeSaved && (
                <p className="text-xs text-green-600 dark:text-emerald-400">
                  Store guardado correctamente.
                </p>
              )}
              <button
                type="button"
                onClick={handleSaveStore}
                disabled={
                  savingStore ||
                  selectedStoreId === (credential?.importStoreId ?? "")
                }
                className="self-start bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {savingStore ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-slate-400 border-t dark:border-slate-700 pt-3">
            Ya podés enviar pedidos a Aliclik directamente desde las vistas de
            Operaciones y CC.
          </p>

          <button
            type="button"
            onClick={handleReconfigure}
            className="text-xs text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition"
          >
            Actualizar token →
          </button>
        </div>
      )}

      {/* Estado NO CONFIGURADO — formulario */}
      {!saving && !credential && (
        <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-5 space-y-4">
          <form onSubmit={handleSave} className="space-y-4">
            <h2 className="text-sm font-semibold dark:text-slate-100">Credenciales Aliclik</h2>

            {saveError && (
              <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-400">
                {saveError}
              </div>
            )}

            <div>
              <label
                htmlFor="aliclik-token"
                className="block text-xs font-medium mb-1 text-gray-600 dark:text-slate-300"
              >
                Bearer Token de Aliclik
              </label>
              <input
                id="aliclik-token"
                type="password"
                value={bearerToken}
                onChange={(e) => setBearerToken(e.target.value)}
                placeholder="Token de autenticación Aliclik"
                required
                className="w-full border dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="aliclik-base-url"
                className="block text-xs font-medium mb-1 text-gray-600 dark:text-slate-300"
              >
                URL base de la API{" "}
                <span className="text-gray-400 dark:text-slate-500 font-normal">(opcional)</span>
              </label>
              <input
                id="aliclik-base-url"
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.aliclik.app (dejar vacío para usar la URL por defecto)"
                className="w-full border dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={!bearerToken}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Guardar y verificar conexión
            </button>

            <p className="text-xs text-gray-400 dark:text-slate-500 text-center">
              El token se almacena de forma segura y nunca se expone en la
              interfaz.
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
