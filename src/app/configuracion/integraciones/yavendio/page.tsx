"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  API_INTEGRATIONS,
  getYavendioConfig,
  saveYavendioConfig,
  testYavendioConnection,
  syncYavendioCatalog,
  listYavendioWebhooks,
  createYavendioWebhook,
  setYavendioWebhookActive,
  deleteYavendioWebhook,
  YavendioSafeConfig,
  CatalogSyncSummary,
  YavendioWebhook,
} from "@/services/yavendioService";
import YavendioProductPickerModal from "./_components/YavendioProductPickerModal";

/** Eventos con los que Powip registra su webhook de pedidos — sin formulario, valores fijos. */
const YAVENDIO_WEBHOOK_EVENTS = ["order.created", "order.status_changed"];
const YAVENDIO_WEBHOOK_DESCRIPTION = "Powip — recepción de pedidos";

const extractErrorMessage = (err: unknown, fallback: string): string => {
  const axiosError = err as { response?: { data?: { message?: string } }; message?: string };
  return axiosError?.response?.data?.message || axiosError?.message || fallback;
};

type SaveStep = "saving" | "testing" | "done";

interface StoreOption {
  id: string;
  name: string;
}

export default function YavendioConfigPage() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;
  const token = auth?.accessToken;

  const [credential, setCredential] = useState<YavendioSafeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tiendas disponibles para el selector de store destino
  const [stores, setStores] = useState<StoreOption[]>([]);

  // Form state
  const [apiKey, setApiKey] = useState("");
  const [importStoreId, setImportStoreId] = useState("");

  // Save flow state
  const [saving, setSaving] = useState(false);
  const [saveStep, setSaveStep] = useState<SaveStep | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  // Aviso "cuenta sin catálogo en YaVendió" (plan Free): lo devuelve el
  // connection-test cuando la conexión es válida pero no hay catálogo. No es un
  // error — la integración queda activa; solo el sync de productos no va a andar.
  // No se persiste server-side: desaparece si el usuario recarga la página.
  const [catalogWarning, setCatalogWarning] = useState<string | null>(null);

  // Sync de catálogo
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<CatalogSyncSummary | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Sync manual de productos elegidos a mano (activos e inactivos)
  const [pickerOpen, setPickerOpen] = useState(false);

  // Webhook de pedidos (Fase 5)
  const [webhooks, setWebhooks] = useState<YavendioWebhook[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [webhookActionBusy, setWebhookActionBusy] = useState(false);

  const loadCredential = useCallback(async () => {
    if (!companyId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const cred = await getYavendioConfig(token, companyId);
      setCredential(cred);
    } catch {
      setError("No se pudo cargar la configuración de Yavendio.");
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

  // URL del RECEPTOR de webhook (singular "webhook") — distinta de la ruta de
  // administración (plural "webhooks") que usa el service de arriba. Es la que
  // YaVendió va a llamar para avisarnos de pedidos nuevos.
  const webhookUrl = companyId ? `${API_INTEGRATIONS}/yavendio/webhook/${companyId}` : "";

  const loadWebhooks = useCallback(async () => {
    if (!companyId || !token) return;
    setLoadingWebhooks(true);
    setWebhookError(null);
    try {
      const list = await listYavendioWebhooks(token, companyId);
      setWebhooks(list);
    } catch (err: unknown) {
      setWebhookError(extractErrorMessage(err, "No se pudo cargar el estado del webhook de pedidos."));
    } finally {
      setLoadingWebhooks(false);
    }
  }, [token, companyId]);

  // Solo se consulta con la integración activa, mismo criterio que la sección
  // de catálogo (visible únicamente cuando `credential.isActive === true`).
  useEffect(() => {
    if (!credential?.isActive || !companyId || !token) return;
    loadWebhooks();
  }, [credential?.isActive, companyId, token, loadWebhooks]);

  // Mismo llamado que ya usa `configuracion/tiendas/page.tsx` para poblar el selector
  // de tiendas — no se crea un servicio nuevo solo para esto.
  useEffect(() => {
    if (!companyId) return;
    axios
      .get<{ stores: StoreOption[] }>(`${process.env.NEXT_PUBLIC_API_COMPANY}/company/${companyId}`)
      .then((response) => setStores(response.data?.stores || []))
      .catch(() => setStores([]));
  }, [companyId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !importStoreId || !companyId || !token) return;

    setSaving(true);
    setSaveError(null);
    setConnectionOk(null);
    setCatalogWarning(null);

    try {
      // Paso 1: guardar config
      setSaveStep("saving");
      await saveYavendioConfig(token, {
        companyId,
        apiKey,
        importStoreId,
      });

      // Paso 2: test de conexión — Yavendio rechaza con 401 (no devuelve { ok:false })
      // si la Api-Key es inválida; se captura acá para no romper el flujo de guardado
      // (la config ya quedó persistida).
      setSaveStep("testing");
      try {
        const result = await testYavendioConnection(token, companyId);
        setConnectionOk(true);
        setCatalogWarning(result.catalogWarning ?? null);
      } catch {
        setConnectionOk(false);
        setCatalogWarning(null);
      }

      setSaveStep("done");
      setApiKey("");
      setImportStoreId("");
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } }; message?: string };
      setSaveError(
        axiosError?.response?.data?.message ||
          axiosError?.message ||
          "Error al guardar la configuración",
      );
      setSaveStep(null);
      setSaving(false);
      return;
    }

    // Paso 3: recargar config para reflejar isActive actualizado por el backend.
    // Va en su propio try/catch: el guardado y el test de conexión ya tuvieron
    // éxito acá, así que un fallo transitorio de este GET no debe reportarse
    // como si el guardado hubiera fallado.
    try {
      const refreshed = await getYavendioConfig(token, companyId);
      setCredential(refreshed);
    } catch {
      // No se pudo refrescar la config recién guardada. No es un error de
      // guardado — se deja la página en el estado post-"done" y el usuario
      // puede refrescar manualmente para ver el estado real.
    } finally {
      setSaving(false);
    }
  };

  const handleReconfigure = () => {
    setSaveStep(null);
    setSaveError(null);
    setConnectionOk(null);
    setCatalogWarning(null);
    setApiKey("");
    setImportStoreId("");
    setCredential(null);
    setSyncResult(null);
    setSyncError(null);
    setSyncing(false);
  };

  const handleSyncCatalog = async () => {
    if (!companyId || !token) return;
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const summary = await syncYavendioCatalog(token, companyId);
      setSyncResult(summary);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } }; message?: string };
      setSyncError(
        axiosError?.response?.data?.message ||
          axiosError?.message ||
          "Error al sincronizar el catálogo",
      );
    } finally {
      setSyncing(false);
    }
  };

  const handlePickerComplete = (summary: CatalogSyncSummary) => {
    setSyncError(null);
    setSyncResult(summary);
  };

  const handleRegisterWebhook = async () => {
    if (!companyId || !token || !webhookUrl) return;
    setWebhookActionBusy(true);
    setWebhookError(null);
    try {
      await createYavendioWebhook(token, companyId, {
        url: webhookUrl,
        events: YAVENDIO_WEBHOOK_EVENTS,
        description: YAVENDIO_WEBHOOK_DESCRIPTION,
      });
      toast.success("Webhook de pedidos registrado");
      // Recarga SOLO si la escritura tuvo éxito — si falló, el estado del lado
      // de YaVendió no cambió, y recargar acá borraría el error seteado abajo.
      await loadWebhooks();
    } catch (err: unknown) {
      setWebhookError(extractErrorMessage(err, "Error al registrar el webhook de pedidos."));
    } finally {
      setWebhookActionBusy(false);
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!companyId || !token) return;
    const confirmed = window.confirm(
      "¿Eliminar el webhook de pedidos? YaVendió dejará de avisarnos de pedidos nuevos hasta que lo vuelvas a registrar.",
    );
    if (!confirmed) return;

    setWebhookActionBusy(true);
    setWebhookError(null);
    try {
      await deleteYavendioWebhook(token, companyId, webhookId);
      toast.success("Webhook de pedidos eliminado");
      // Recarga SOLO si la escritura tuvo éxito — si falló, el estado del lado
      // de YaVendió no cambió, y recargar acá borraría el error seteado abajo.
      await loadWebhooks();
    } catch (err: unknown) {
      setWebhookError(extractErrorMessage(err, "Error al eliminar el webhook de pedidos."));
    } finally {
      setWebhookActionBusy(false);
    }
  };

  const handleReactivateWebhook = async (webhookId: string) => {
    if (!companyId || !token) return;
    setWebhookActionBusy(true);
    setWebhookError(null);
    try {
      await setYavendioWebhookActive(token, companyId, webhookId, true);
      toast.success("Webhook de pedidos reactivado");
      // Recarga SOLO si la escritura tuvo éxito — si falló, el estado del lado
      // de YaVendió no cambió, y recargar acá borraría el error seteado abajo.
      await loadWebhooks();
    } catch (err: unknown) {
      setWebhookError(extractErrorMessage(err, "Error al reactivar el webhook de pedidos."));
    } finally {
      setWebhookActionBusy(false);
    }
  };

  const stepLabel: Record<SaveStep, string> = {
    saving: "Guardando configuración...",
    testing: "Verificando conexión con Yavendio...",
    done: "¡Configuración guardada!",
  };

  const storeName = (storeId: string | null): string => {
    if (!storeId) return "Sin tienda asignada";
    const match = stores.find((s) => s.id === storeId);
    return match?.name ?? storeId;
  };

  // Puede haber webhooks ajenos (creados a mano desde el dashboard de
  // YaVendió) en la lista — el nuestro es exclusivamente el que matchea la
  // URL del receptor que arma esta página. Los demás se ignoran del todo.
  const ourWebhook = webhooks.find((w) => w.url === webhookUrl) ?? null;

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

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold dark:text-slate-100">Integración Yavendio</h1>
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
          Conectá tu cuenta de Yavendio para vender tu catálogo por WhatsApp/IA
          y recibir automáticamente en Powip los pedidos que se cierren ahí.
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
                <p className="text-xs text-green-600 dark:text-emerald-400">Conexión verificada con Yavendio</p>
              )}
              {connectionOk === null && (
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {credential.isActive
                    ? "La integración está activa. Ya podés sincronizar tu catálogo."
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
                {credential.apiKey || "—"}
              </p>
            </div>
            <div>
              <p className="text-gray-400 dark:text-slate-500 uppercase font-bold text-[10px] mb-1">
                Tienda destino
              </p>
              <p className="text-gray-700 dark:text-slate-200 break-all">
                {storeName(credential.importStoreId)}
              </p>
            </div>
          </div>

          {/* Aviso: cuenta de YaVendió sin catálogo (plan Free) — ámbar, NO error:
              la integración está activa y el inbound de pedidos funciona; solo el
              sync de productos no va a andar hasta que la cuenta tenga catálogo. */}
          {credential.isActive && catalogWarning !== null && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              {catalogWarning}
            </div>
          )}

          {/* Sincronización de catálogo — solo con integración activa */}
          {credential.isActive && (
            <div className="border-t border-gray-200 dark:border-slate-700 pt-4 space-y-3">
              <p className="text-xs font-bold text-gray-700 dark:text-slate-200 uppercase tracking-wide">
                Catálogo de productos
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Empujá tu catálogo de Powip hacia Yavendio para poder venderlo
                por WhatsApp/IA. Podés correrlo las veces que quieras: es
                idempotente y solo crea o actualiza lo que cambió.
              </p>

              {syncing && (
                <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-3">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <p className="text-xs text-gray-600 dark:text-slate-300">
                    Sincronizando catálogo... esto puede tardar unos minutos.
                  </p>
                </div>
              )}

              {syncError && (
                <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-400">
                  {syncError}
                </div>
              )}

              {syncResult && (
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg py-2">
                      <p className="text-lg font-bold text-gray-800 dark:text-slate-100">{syncResult.created}</p>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase">Creados</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg py-2">
                      <p className="text-lg font-bold text-gray-800 dark:text-slate-100">{syncResult.updated}</p>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase">Actualizados</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg py-2">
                      <p className="text-lg font-bold text-gray-800 dark:text-slate-100">{syncResult.skipped}</p>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase">Omitidos</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg py-2">
                      <p className={`text-lg font-bold ${syncResult.failed > 0 ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-slate-100"}`}>
                        {syncResult.failed}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase">Fallidos</p>
                    </div>
                  </div>

                  {syncResult.errors.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 space-y-1 max-h-40 overflow-y-auto">
                      {syncResult.errors.map((item, idx) => (
                        <p key={`${item.productId}-${idx}`} className="text-xs text-red-700 dark:text-red-400">
                          <span className="font-mono">{item.productId}</span>
                          {item.sku && <span className="font-mono"> ({item.sku})</span>}
                          {": "}
                          {item.message}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleSyncCatalog}
                  disabled={syncing}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  {syncing ? "Sincronizando..." : "Sincronizar catálogo de productos"}
                </button>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  disabled={syncing}
                  className="flex-1 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 py-2 rounded-lg text-xs font-medium hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Elegir productos a sincronizar →
                </button>
              </div>
            </div>
          )}

          {/* Webhook de pedidos — solo con integración activa */}
          {credential.isActive && (
            <div className="border-t border-gray-200 dark:border-slate-700 pt-4 space-y-3">
              <p className="text-xs font-bold text-gray-700 dark:text-slate-200 uppercase tracking-wide">
                Webhook de pedidos
              </p>

              {loadingWebhooks && (
                <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-3">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <p className="text-xs text-gray-600 dark:text-slate-300">
                    Consultando el estado del webhook...
                  </p>
                </div>
              )}

              {webhookError && (
                <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-400">
                  {webhookError}
                </div>
              )}

              {!loadingWebhooks && !ourWebhook && !webhookError && (
                <>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Sin este webhook, los pedidos que se cierren en Yavendio no
                    van a llegar automáticamente a Powip. Registralo para que
                    se importen como borradores apenas se confirmen.
                  </p>
                  <button
                    type="button"
                    onClick={handleRegisterWebhook}
                    disabled={webhookActionBusy}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    {webhookActionBusy ? "Registrando..." : "Registrar webhook de pedidos"}
                  </button>
                </>
              )}

              {!loadingWebhooks && ourWebhook && ourWebhook.isActive && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-emerald-900/40 px-3 py-1 text-xs font-semibold text-green-700 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      Activo
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 space-y-1">
                    <p>
                      Eventos:{" "}
                      <span className="font-mono text-gray-700 dark:text-slate-200">
                        {ourWebhook.events.join(", ")}
                      </span>
                    </p>
                    <p>
                      Registrado el{" "}
                      {new Date(ourWebhook.createdAt).toLocaleDateString("es-PE")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteWebhook(ourWebhook.id)}
                    disabled={webhookActionBusy}
                    className="w-full bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 py-2 rounded-lg text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    {webhookActionBusy ? "Eliminando..." : "Eliminar webhook"}
                  </button>
                </div>
              )}

              {!loadingWebhooks && ourWebhook && !ourWebhook.isActive && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Inactivo
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Yavendio suele desactivar un webhook automáticamente
                    después de fallos repetidos de entrega. Mientras esté
                    inactivo, los pedidos nuevos no van a llegar a Powip.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleReactivateWebhook(ourWebhook.id)}
                    disabled={webhookActionBusy}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    {webhookActionBusy ? "Reactivando..." : "Reactivar"}
                  </button>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-gray-500 dark:text-slate-400 border-t dark:border-slate-700 pt-3">
            Los pedidos cerrados en Yavendio se importan automáticamente como
            borradores en Powip.
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

      {/* Estado NO CONFIGURADO — sin cuenta de Yavendio todavía */}
      {!saving && !credential && (
        <div className="bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-teal-800 dark:text-teal-300">
            ¿Todavía no tenés cuenta en Yavendio? Creala con nuestro link de referidos.
          </p>
          <a
            href="https://ya.onl/sign-up?plan_id=365&frequency=QUARTERLY&ref=62939&utm_source=partner&utm_medium=partner_program_v1"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-teal-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-teal-700 transition whitespace-nowrap"
          >
            Crear cuenta en Yavendio ↗
          </a>
        </div>
      )}

      {/* Estado NO CONFIGURADO — formulario */}
      {!saving && !credential && (
        <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-5 space-y-4">
          <form onSubmit={handleSave} className="space-y-4">
            <h2 className="text-sm font-semibold dark:text-slate-100">Credenciales Yavendio</h2>

            {saveError && (
              <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-400">
                {saveError}
              </div>
            )}

            <div>
              <label
                htmlFor="yavendio-api-key"
                className="block text-xs font-medium mb-1 text-gray-600 dark:text-slate-300"
              >
                Api-Key de Yavendio
              </label>
              <input
                id="yavendio-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                required
                className="w-full border dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="yavendio-import-store"
                className="block text-xs font-medium mb-1 text-gray-600 dark:text-slate-300"
              >
                Tienda destino de los pedidos importados
              </label>
              <select
                id="yavendio-import-store"
                value={importStoreId}
                onChange={(e) => setImportStoreId(e.target.value)}
                required
                className="w-full border dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" disabled>
                  Seleccioná una tienda
                </option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                Los pedidos que YaVendió reciba por WhatsApp/IA se crearán como
                borradores en esta tienda.
              </p>
            </div>

            <button
              type="submit"
              disabled={!apiKey || !importStoreId}
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

      {companyId && (
        <YavendioProductPickerModal
          open={pickerOpen}
          companyId={companyId}
          onClose={() => setPickerOpen(false)}
          onComplete={handlePickerComplete}
        />
      )}
    </div>
  );
}
