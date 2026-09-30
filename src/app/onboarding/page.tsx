import OnboardingClient from './OnboardingClient';
import { resolveOnboardingPlanName } from '@/lib/onboardingPlan';

interface SearchParams {
  planName?: string;
  /** Alternativa a planName para links cortos desde la landing (?plan=Basic). */
  plan?: string;
  /** "true" = pago anual: se preselecciona el plan "<nombre> Anual". */
  annual?: string;
  /** Nombre usado por el onboarding de develop; equivale a annual. */
  isAnnual?: string;
}

interface OnboardingPageProps {
  searchParams: Promise<SearchParams>;
}

/**
 * Entrada pública del onboarding (FEAT-11), también desde "Registrarse" de /login.
 * El plan se elige en el paso 2, después del registro (el catálogo requiere JWT).
 * Si la landing manda uno (?plan=Basic[&annual=true]), queda preseleccionado y
 * se puede cambiar; el precio siempre sale del plan real de ms-subscription.
 */
export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = await searchParams;
  const isAnnual = params.annual === 'true' || params.isAnnual === 'true';
  const planName = resolveOnboardingPlanName(params.planName ?? params.plan, isAnnual);

  return <OnboardingClient planName={planName} />;
}
