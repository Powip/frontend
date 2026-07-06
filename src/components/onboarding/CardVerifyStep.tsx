'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { OnboardingStep } from '@/types/onboarding';

interface CardVerifyStepProps {
  step: OnboardingStep;
  isLoading: boolean;
  error: string | null;
  onVerify: () => Promise<void>;
  onRetry: () => void;
}

export default function CardVerifyStep({
  step,
  isLoading,
  error,
  onVerify,
  onRetry,
}: CardVerifyStepProps) {
  const hasStarted = useRef(false);

  useEffect(() => {
    if (step === 'CARD_VERIFY' && !hasStarted.current) {
      hasStarted.current = true;
      void onVerify();
    }
  }, [step, onVerify]);

  if (step === 'ERROR') {
    return (
      <div className="text-center space-y-4 py-6">
        <div className="text-4xl">❌</div>
        <div>
          <p className="font-semibold text-gray-900">No se pudo verificar la tarjeta</p>
          <p className="text-sm text-gray-500 mt-1">
            {error ?? 'Ocurrió un error inesperado. Intentalo nuevamente.'}
          </p>
        </div>
        <Button
          onClick={onRetry}
          variant="outline"
          className="border-[#4F3A96] text-[#4F3A96] hover:bg-purple-50"
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4 py-6">
      <Loader2 className="h-10 w-10 animate-spin text-[#4F3A96] mx-auto" />
      <div>
        <p className="font-semibold text-gray-900">Verificando tu tarjeta...</p>
        <p className="text-sm text-gray-500 mt-1">
          {isLoading
            ? 'Estamos confirmando el registro. Esto puede tomar unos segundos.'
            : 'Iniciando verificación...'}
        </p>
      </div>
    </div>
  );
}
