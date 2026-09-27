'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboardingFlow } from '@/hooks/useOnboardingFlow';
import { getStoredOnboardingState } from '@/lib/onboardingStorage';
import SubscriptionSuccess from '@/components/onboarding/SubscriptionSuccess';

type InitStatus = 'loading' | 'no-session' | 'ready';

/**
 * Vuelta desde el formulario de Flow (flujo por redirección, FEAT-11).
 * Flow hace POST al url_return de ms-integrations, que redirige (303) acá con
 * ?token=<token del registro de tarjeta>. Con la sesión recuperada por la cookie
 * de refresh, se confirma el pago igual que desde el widget embebido.
 */
export default function CallbackClient() {
  const { auth, loading, login, refreshSubscription } = useAuth();
  const searchParams = useSearchParams();
  const [initStatus, setInitStatus] = useState<InitStatus>('loading');
  const started = useRef(false);

  const { state, confirmPayment, checkPaymentAgain, restoreFromStorage } = useOnboardingFlow(
    { planId: '', planName: '', price: 0 },
    login,
    refreshSubscription,
  );

  // 1) Recuperar el contexto del checkout: token de la URL (o del storage) + plan.
  useEffect(() => {
    if (loading || initStatus !== 'loading') return;
    const stored = getStoredOnboardingState();
    const token = searchParams.get('token') ?? stored?.cardToken ?? null;
    if (!auth || !token) {
      setInitStatus('no-session');
      return;
    }
    restoreFromStorage({
      planId: stored?.planId ?? '',
      planName: stored?.planName ?? '',
      price: stored?.price ?? 0,
      addOnIds: stored?.addOnIds ?? [],
      userId: stored?.userId ?? auth.user.id,
      cardToken: token,
    });
    setInitStatus('ready');
  }, [auth, loading, initStatus, searchParams, restoreFromStorage]);

  // 2) Confirmar una sola vez, ya con el token en el estado.
  useEffect(() => {
    if (initStatus === 'ready' && state.cardToken && !started.current) {
      started.current = true;
      void confirmPayment();
    }
  }, [initStatus, state.cardToken, confirmPayment]);

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
            Iniciá sesión para terminar de activar tu suscripción.
          </p>
        </div>
        <a href="/login" className="text-[#4F3A96] underline text-sm font-medium hover:opacity-80">
          Iniciar sesión
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
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center space-y-4">
        {state.step === 'PAYMENT_PENDING' ? (
          <>
            <div className="text-4xl">⏳</div>
            <p className="font-semibold text-gray-900">Tu pago está en proceso</p>
            <p className="text-sm text-gray-500">
              Flow todavía no confirmó el primer cobro. Apenas se confirme vas a poder entrar a Powip.
            </p>
            <button
              type="button"
              onClick={() => void checkPaymentAgain()}
              disabled={state.isLoading}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#4F3A96] disabled:opacity-70"
            >
              Volver a verificar
            </button>
          </>
        ) : state.step === 'ERROR' ? (
          <>
            <div className="text-4xl">❌</div>
            <p className="text-sm text-gray-700">{state.error}</p>
            <a href="/sin-plan" className="text-[#4F3A96] underline text-sm font-medium">
              Volver a intentar
            </a>
          </>
        ) : (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-[#4F3A96] mx-auto" />
            <p className="font-semibold text-gray-900">Confirmando tu pago...</p>
            <p className="text-sm text-gray-500">Estamos verificando tu tarjeta y activando tu suscripción.</p>
          </>
        )}
      </div>
    </div>
  );
}
