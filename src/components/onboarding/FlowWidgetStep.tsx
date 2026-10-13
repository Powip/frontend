"use client";

import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

declare global {
  interface Window {
    Flow?: () => {
      elements: () => {
        create: (
          type: string,
          options?: Record<string, unknown>,
        ) => {
          mount: (selector: string, token: string) => void;
        };
      };
      handleCardSubscribed: (element: {
        mount: (selector: string, token: string) => void;
      }) => Promise<void>;
    };
  }
}

interface FlowWidgetStepProps {
  token: string;
  onSuccess: () => Promise<void>;
  onError: (msg: string) => void;
}

type WidgetStatus = "loading" | "ready" | "error";

export const FLOW_SCRIPT_TIMEOUT_MS = 20_000;

function createFlowScript(src: string): HTMLScriptElement {
  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.dataset.flowSdkState = "loading";
  // Shared loader bookkeeping never captures a mounted widget or its callbacks.
  // It records events even when the last widget unsubscribed before load finished.
  script.onload = () => {
    script.dataset.flowSdkState = typeof window.Flow === "function" ? "loaded" : "failed";
    script.dataset.loaded = String(typeof window.Flow === "function");
    script.onload = null;
    script.onerror = null;
  };
  script.onerror = () => {
    script.dataset.flowSdkState = "failed";
    script.onload = null;
    script.onerror = null;
  };
  return script;
}

export default function FlowWidgetStep({ token, onSuccess, onError }: FlowWidgetStepProps) {
  const [status, setStatus] = useState<WidgetStatus>("loading");
  const [localError, setLocalError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const containerId = `flow-subscribe-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const callbacksRef = useRef({ onSuccess, onError });
  useEffect(() => {
    callbacksRef.current = { onSuccess, onError };
  }, [onSuccess, onError]);

  const baseUrl =
    process.env.NEXT_PUBLIC_RUNTIME_ENV === "production"
      ? "https://www.flow.cl"
      : "https://sandbox.flow.cl";

  const scriptSrc = `${baseUrl}/app/elements/flow-1.1.0.min.js?20241202`;

  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry reinitializes the same token after a failed loader or SDK attempt.
  useEffect(() => {
    let cancelled = false;
    let mounted = false;
    let failed = false;
    let completed = false;
    let script: HTMLScriptElement | null = null;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const container = containerRef.current;
    container?.replaceChildren();
    setStatus("loading");
    setLocalError("");

    const stopLoading = () => {
      if (timeout !== undefined) clearTimeout(timeout);
      script?.removeEventListener("load", handleLoad);
      script?.removeEventListener("error", handleError);
    };

    const showError = (message: string) => {
      if (cancelled || failed || completed) return;
      failed = true;
      stopLoading();
      container?.replaceChildren();
      setLocalError(message);
      setStatus("error");
      toast.error(message, { id: "flow-widget-feedback" });
    };

    const mountWidget = () => {
      if (cancelled || failed || mounted) return;
      stopLoading();

      if (typeof window.Flow !== "function" || !container) {
        if (script) script.dataset.flowSdkState = "failed";
        showError("El widget de pago no está disponible. Intenta nuevamente.");
        return;
      }

      mounted = true;

      try {
        const flow = window.Flow();

        const subscribe = flow.elements().create("subscribe", {
          style: {
            backgroundColor: "#f8f9fa",
          },
        });

        subscribe.mount(`#${containerId}`, token);

        if (!cancelled) {
          setStatus("ready");
        }

        void Promise.resolve(flow.handleCardSubscribed(subscribe)).then(
          async () => {
            if (cancelled || failed || completed) return;
            completed = true;
            try {
              await callbacksRef.current.onSuccess();
            } catch {
              if (cancelled) return;
              const message =
                "No pudimos confirmar tu suscripción. Vuelve a verificar o intenta nuevamente.";
              toast.error(message, { id: "flow-widget-feedback" });
              callbacksRef.current.onError(message);
            }
          },
          () => {
            showError(
              "Hubo un error al procesar tu tarjeta. Verifica los datos e intenta nuevamente.",
            );
          },
        );
      } catch {
        showError("No se pudo iniciar el widget de pago. Intenta nuevamente.");
      }
    };

    function handleLoad() {
      if (cancelled) return;
      mountWidget();
    }
    function handleError() {
      if (cancelled) return;
      if (script) script.dataset.flowSdkState = "failed";
      showError("No se pudo cargar el widget de pago. Verifica tu conexión a internet.");
    }

    script = document.querySelector<HTMLScriptElement>(`script[src="${scriptSrc}"]`);
    if (typeof window.Flow === "function") {
      mountWidget();
    } else {
      // A failed/legacy inert tag cannot emit the event a retry is waiting for.
      if (script && script.dataset.flowSdkState !== "loading") {
        script.remove();
        script = null;
      }
      const isNew = !script;
      script ??= createFlowScript(scriptSrc);
      script.addEventListener("load", handleLoad, { once: true });
      script.addEventListener("error", handleError, { once: true });
      timeout = setTimeout(() => {
        if (cancelled) return;
        if (script) script.dataset.flowSdkState = "failed";
        showError(
          "El widget de pago tardó demasiado en cargar. Revisa tu conexión e intenta nuevamente.",
        );
      }, FLOW_SCRIPT_TIMEOUT_MS);
      if (isNew) document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      stopLoading();
      container?.replaceChildren();
    };
  }, [token, retryCount, containerId, scriptSrc]);

  return (
    <div className="space-y-4" aria-busy={status === "loading"}>
      {status === "error" && (
        <div className="flex flex-col items-center gap-4 py-8 text-center" role="alert">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: "#fef2f2" }}
          >
            <AlertCircle aria-hidden="true" className="w-6 h-6" style={{ color: "#ef4444" }} />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-800">{localError}</p>

            <p className="text-xs text-gray-400 mt-1">
              Si el problema continúa, contacta a soporte.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setRetryCount((c) => c + 1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "#4F3A96" }}
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Intentar nuevamente
          </button>
        </div>
      )}
      {status === "loading" && (
        <div className="flex flex-col items-center gap-3 py-10" role="status">
          <Loader2
            aria-hidden="true"
            className="h-8 w-8 animate-spin"
            style={{ color: "#4F3A96" }}
          />
          <p className="text-sm text-gray-400">Cargando widget de pago...</p>
        </div>
      )}

      <div
        ref={containerRef}
        id={containerId}
        hidden={status === "error"}
        style={{
          minHeight: status === "ready" ? 250 : 0,
        }}
      />

      {status === "ready" && (
        <p className="text-xs text-gray-400 text-center">Pago procesado de forma segura con Flow</p>
      )}
    </div>
  );
}
