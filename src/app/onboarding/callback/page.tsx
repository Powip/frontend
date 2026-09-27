import { Suspense } from 'react';
import CallbackClient from '../CallbackClient';

export default function OnboardingCallbackPage() {
  // useSearchParams en un Client Component exige un Suspense boundary en build.
  return (
    <Suspense fallback={null}>
      <CallbackClient />
    </Suspense>
  );
}
