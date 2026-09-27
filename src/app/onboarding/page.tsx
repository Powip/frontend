import { redirect } from 'next/navigation';
import OnboardingClient from './OnboardingClient';
import { resolveOnboardingPlanName } from '@/lib/onboardingPlan';

interface SearchParams {
  planId?: string;
  planName?: string;
  /** Alternativa a planName para links cortos desde la landing (?plan=Basic). */
  plan?: string;
  price?: string;
  /** "true" = pago anual: se contrata el plan "<nombre> Anual" (365 días). */
  annual?: string;
  /** Nombre usado por el onboarding de develop; equivale a annual. */
  isAnnual?: string;
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
 * Pago mensual o anual (?annual=true).
 */
export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = await searchParams;
  const isAnnual = params.annual === 'true' || params.isAnnual === 'true';
  const planName = resolveOnboardingPlanName(params.planName ?? params.plan, isAnnual);
  const parsedPrice = params.price ? parseFloat(params.price) : NaN;

  if (!planName || isNaN(parsedPrice)) {
    redirect(process.env.NEXT_PUBLIC_LANDING_URL ?? 'https://powip.lat');
  }

  return (
    <OnboardingClient
      planId={params.planId ?? ''}
      planName={planName}
      price={parsedPrice}
      isAnnual={isAnnual}
    />
  );
}
