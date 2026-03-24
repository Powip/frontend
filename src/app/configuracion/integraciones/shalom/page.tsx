"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getShalomConfig,
  saveShalomConfig,
  getShalomStatus,
  createShalomInstance,
  loginShalom,
  ShalomConfig,
} from "@/services/shalomService";

type ConnectStep = "saving" | "creating_instance" | "logging_in" | "done";

export default function ShalomConfigPage() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;

  const [config, setConfig] = useState<ShalomConfig | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state (solo visible cuando no hay sesión activa)
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Connect flow state
  const [connecting, setConnecting] = useState(false);
  const [connectStep, setConnectStep] = useState<ConnectStep | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !auth?.accessToken) return;
    loadStatus();
  }, [companyId]);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const cfg = await getShalomConfig(auth!.accessToken, companyId!);
      setConfig(cfg);
      if (cfg?.username) setUsername(cfg.username);

      if (cfg?.instanceId) {
        const st = await getShalomStatus(auth!.accessToken, companyId!);
        setIsConnected(st.isLoggedIn);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Flujo completo en un solo click:
   * 1. Guardar credenciales
   * 2. Crear instancia (o reusar si ya existe)
   * 3. Login
   */
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setConnecting(true);
    setError(null);

    try {
      // Paso 1: guardar credenciales
      setConnectStep("saving");
      const savedConfig = await saveShalomConfig(auth!.accessToken, {
        companyId: companyId!,
        username,
        password,
      });
      setConfig(savedConfig);

      // Paso 2: crear instancia (siempre recrea para estar seguro)
      setConnectStep("creating_instance");
      await createShalomInstance(auth!.accessToken, companyId!);

      // Paso 3: login
      setConnectStep("logging_in");
      const result = await loginShalom(auth!.accessToken, companyId!);

      if (result.success) {
        setConnectStep("done");
        setIsConnected(true);
        setPassword(""); // limpiar contraseña del estado
      } else {
        throw new Error(
          result.message ||
            "Las credenciales no son correctas. Verificá tu usuario y contraseña de Shalom Pro."
        );
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Error al conectar con Shalom Pro"
      );
      setConnectStep(null);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setConnectStep(null);
    setPassword("");
    setError(null);
  };

  const stepLabel: Record<ConnectStep, string> = {
    saving: "Guardando credenciales...",
    creating_instance: "Creando sesión en Shalom...",
    logging_in: "Iniciando sesión en Shalom Pro...",
    done: "¡Conectado!",
  };

  if (!companyId) return null;

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="h-32 bg-gray-50 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Integración Shalom</h1>
        <p className="text-sm text-gray-500 mt-1">
          Conectá tu cuenta Shalom Pro para registrar envíos directamente desde
          las guías de despacho.
        </p>
      </div>

      {/* Estado CONECTADO */}
      {isConnected && config ? (
        <div className="bg-white border border-green-200 rounded-xl p-5 space-y-4">
          {/* Badge conectado */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-5 h-5 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-green-800">
                Cuenta conectada
              </p>
              <p className="text-xs text-gray-500">{config.username}</p>
            </div>
          </div>

          <p className="text-xs text-gray-500 border-t pt-3">
            Ya podés enviar guías de despacho a Shalom Pro directamente desde
            el detalle de cada guía.
          </p>

          <button
            onClick={handleDisconnect}
            className="text-xs text-gray-400 hover:text-red-500 transition"
          >
            Reconectar con otra cuenta →
          </button>
        </div>
      ) : (
        /* Estado NO CONECTADO — formulario */
        <div className="bg-white border rounded-xl p-5 space-y-4">
          {connecting ? (
            /* Loading durante la conexión */
            <div className="py-6 flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-gray-700">
                {connectStep ? stepLabel[connectStep] : "Conectando..."}
              </p>
              <div className="flex gap-2">
                {(["saving", "creating_instance", "logging_in"] as ConnectStep[]).map(
                  (step) => (
                    <div
                      key={step}
                      className={`h-1.5 w-8 rounded-full transition-all ${
                        connectStep === step ||
                        (connectStep === "logging_in" &&
                          step !== "logging_in") ||
                        (connectStep === "creating_instance" &&
                          step === "saving") ||
                        connectStep === "done"
                          ? "bg-blue-500"
                          : "bg-gray-200"
                      }`}
                    />
                  )
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleConnect} className="space-y-4">
              <h2 className="text-sm font-semibold">
                Credenciales Shalom Pro
              </h2>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1 text-gray-600">
                  Usuario (email)
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="usuario@empresa.com"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-gray-600">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña de Shalom Pro"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={!username || !password}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Conectar con Shalom Pro
              </button>

              <p className="text-xs text-gray-400 text-center">
                Usá las credenciales con las que te logueas en{" "}
                <span className="font-medium">cliente.shalom.pe</span>
              </p>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
