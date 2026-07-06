'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

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

type WidgetStatus = 'loading' | 'ready' | 'error';

export default function FlowWidgetStep({ token, onSuccess, onError }: FlowWidgetStepProps) {
  const [status, setStatus] = useState<WidgetStatus>('loading');
  const [localError, setLocalError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const mountedRef = useRef(false);

  const baseUrl =
    process.env.NEXT_PUBLIC_FLOW_ENV === 'production'
      ? 'https://www.flow.cl'
      : 'https://sandbox.flow.cl';
  const scriptSrc = `${baseUrl}/app/elements/flow-1.1.0.min.js?20241202`;

  useEffect(() => {
    mountedRef.current = false;
    setStatus('loading');
    setLocalError('');

    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const showLocalErr = (msg: string) => {
      setLocalError(msg);
      setStatus('error');
      toast.error(msg);
    };

    const tryMount = () => {
      if (mountedRef.current || !window.Flow) {
        showLocalErr('El widget de pago no está disponible. Intenta nuevamente.');
        return;
      }
      mountedRef.current = true;

      try {
        const flow = window.Flow();
        const subscribe = flow.elements().create('subscribe', {
          style: { backgroundColor: '#f8f9fa' },
        });
        subscribe.mount('#flow-subscribe-container', token);
        setStatus('ready');

        Promise.resolve(flow.handleCardSubscribed(subscribe))
          .then(() => onSuccess())
          .catch(() => {
            mountedRef.current = false;
            showLocalErr(
              'Hubo un error al procesar tu tarjeta. Verifica los datos e intenta nuevamente.',
            );
          });
      } catch {
        mountedRef.current = false;
        showLocalErr('No se pudo iniciar el widget de pago. Intenta nuevamente.');
      }
    };

    // Espera hasta 3 s a que window.Flow esté disponible antes de montar
    const waitForFlow = () => {
      if (window.Flow) {
        tryMount();
        return;
      }
      let attempts = 0;
      pollInterval = setInterval(() => {
        attempts++;
        if (window.Flow) {
          clearInterval(pollInterval!);
          pollInterval = null;
          tryMount();
        } else if (attempts >= 30) {
          clearInterval(pollInterval!);
          pollInterval = null;
          showLocalErr(
            'El widget tardó demasiado en cargar. Verifica tu conexión e intenta nuevamente.',
          );
        }
      }, 100);
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${scriptSrc}"]`,
    );

    if (existing) {
      waitForFlow();
    } else {
      const script = document.createElement('script');
      script.src = scriptSrc;
      script.async = true;
      script.onload = waitForFlow;
      script.onerror = () =>
        onError(
          'No se pudo cargar el widget de pago. Verifica tu conexión a internet.',
        );
      document.head.appendChild(script);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [retryCount, token, onSuccess, onError, scriptSrc]);

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: '#fef2f2' }}
        >
          <AlertCircle className="w-6 h-6" style={{ color: '#ef4444' }} />
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
          style={{ background: '#4F3A96' }}
        >
          <RefreshCw className="w-4 h-4" />
          Intentar nuevamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {status === 'loading' && (
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#4F3A96' }} />
          <p className="text-sm text-gray-400">Cargando widget de pago...</p>
        </div>
      )}
      <div
        id="flow-subscribe-container"
        style={{ minHeight: status === 'ready' ? 250 : 0 }}
      />
      {status === 'ready' && (
        <p className="text-xs text-gray-400 text-center">
          Pago procesado de forma segura con Flow
        </p>
      )}
    </div>
  );
}
