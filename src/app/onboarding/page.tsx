import { redirect } from 'next/navigation';
import OnboardingClient from './OnboardingClient';

interface SearchParams {
  planId?: string;
  planName?: string;
  /** Alternativa a planName para links cortos desde la landing (?plan=Basic). */
  plan?: string;
  price?: string;
}

interface OnboardingPageProps {
  searchParams: Promise<SearchParams>;
}

/**
 * Entrada pública del onboarding (FEAT-11). La landing manda el plan elegido;
 * planId es opcional: si no viene, se resuelve por nombre después del registro
 * (el catálogo requiere JWT). El precio es solo informativo: el cobro lo arma
 * ms-subscription con el plan real.
 *
 * Solo planes mensuales por ahora (ms-subscription no tiene planes anuales).
 */
export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = await searchParams;
  const planName = params.planName ?? params.plan;
  const parsedPrice = params.price ? parseFloat(params.price) : NaN;

  if (!planName || isNaN(parsedPrice)) {
    redirect(process.env.NEXT_PUBLIC_LANDING_URL ?? 'https://powip.lat');
  }

  return (
    <OnboardingClient
      planId={params.planId ?? ''}
      planName={planName}
      price={parsedPrice}
      isAnnual={false}
    />
  );
}
