import { redirect } from 'next/navigation';
import OnboardingClient from './OnboardingClient';

interface SearchParams {
  planId?: string;
  planName?: string;
  price?: string;
  isAnnual?: string;
}

interface OnboardingPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = await searchParams;
  const { planId, planName, price, isAnnual } = params;

  const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL ?? 'https://powip.lat';

  if (!planId || !planName || !price) {
    redirect(landingUrl);
  }

  const parsedPrice = parseFloat(price);
  if (isNaN(parsedPrice)) {
    redirect(landingUrl);
  }

  return (
    <OnboardingClient
      planId={planId}
      planName={planName}
      price={parsedPrice}
      isAnnual={isAnnual === 'true'}
    />
  );
}
