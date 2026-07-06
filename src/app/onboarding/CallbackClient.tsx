'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboardingFlow } from '@/hooks/useOnboardingFlow';
import { getStoredOnboardingState } from '@/lib/onboardingStorage';
import { StoredOnboardingState } from '@/types/onboarding';
import CardVerifyStep from '@/components/onboarding/CardVerifyStep';
import SubscriptionSuccess from '@/components/onboarding/SubscriptionSuccess';
import { Loader2 } from 'lucide-react';

type InitStatus = 'loading' | 'no-session' | 'ready';

export default function CallbackClient() {
  const { login } = useAuth();
  const [initStatus, setInitStatus] = useState<InitStatus>('loading');
  const restored = useRef(false);

  const { state, verifyCard, subscribe, restoreFromStorage, retry } = useOnboardingFlow(
    { planId: '', planName: '', price: 0, isAnnual: false },
    login,
  );

  useEffect(() => {
    if (restored.current) return;

    const stored: StoredOnboardingState | null = getStoredOnboardingState();

    if (!stored) {
      setInitStatus('no-session');
      return;
    }

    restored.current = true;
    restoreFromStorage(stored);
    setInitStatus('ready');
  }, [restoreFromStorage]);

  useEffect(() => {
    if (state.step === 'SUBSCRIBE') {
      void subscribe();
    }
  }, [state.step, subscribe]);

  if (initStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#4F3A96]" />
      </div>
    );
  }

  if (initStatus === 'no-session') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
        <div className="text-4xl">⏱️</div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Sesión expirada</h2>
          <p className="text-sm text-gray-500 mt-2">
            No encontramos tu sesión de registro. Por favor, vuelve a iniciar el proceso.
          </p>
        </div>
        <a
          href={process.env.NEXT_PUBLIC_LANDING_URL ?? 'https://powip.lat'}
          className="text-[#4F3A96] underline text-sm font-medium hover:opacity-80"
        >
          Volver a la página principal
        </a>
      </div>
    );
  }

  if (state.step === 'DONE') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <SubscriptionSuccess />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 text-center">Procesando pago</h1>
          <p className="text-sm text-gray-500 mt-1 text-center">
            Estamos verificando tu tarjeta y activando tu suscripción.
          </p>
        </div>
        <CardVerifyStep
          step={state.step}
          isLoading={state.isLoading}
          error={state.error}
          onVerify={verifyCard}
          onRetry={retry}
        />
      </div>
    </div>
  );
}
