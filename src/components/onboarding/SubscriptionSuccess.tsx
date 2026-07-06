'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Building2 } from 'lucide-react';

export default function SubscriptionSuccess() {
  const router = useRouter();

  return (
    <div className="text-center space-y-6 py-8">
      <div className="flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#008a7b]/10">
          <span className="text-4xl">🎉</span>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">¡Suscripción activada!</h2>
        <p className="text-gray-500 max-w-sm mx-auto">
          Tu cuenta está lista. Ahora configura los datos de tu empresa para empezar a usar Powip.
        </p>
      </div>

      <Button
        onClick={() => router.push('/new-company')}
        className="bg-[#008a7b] hover:bg-[#006d61] text-white px-8 h-11"
      >
        <Building2 className="h-4 w-4" />
        Configurar mi empresa
      </Button>
    </div>
  );
}
