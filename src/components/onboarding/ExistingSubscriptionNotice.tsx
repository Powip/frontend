"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SubscriptionMe } from "@/types/onboarding";

export default function ExistingSubscriptionNotice({
  subscription,
  continueHref,
  refreshSession,
}: {
  subscription: SubscriptionMe;
  continueHref: string;
  refreshSession: () => Promise<boolean>;
}) {
  const router = useRouter();
  const [isContinuing, setIsContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const continueWithPlan = async () => {
    if (isContinuing) return;
    setIsContinuing(true);
    setError(null);
    try {
      if (!(await refreshSession())) throw new Error("Session unavailable");
      router.push(continueHref);
    } catch {
      setError("No pudimos actualizar tu sesión. Intenta nuevamente o inicia sesión.");
    } finally {
      setIsContinuing(false);
    }
  };

  return (
    <section className="space-y-4 text-center" aria-labelledby="existing-subscription-title">
      <h2 id="existing-subscription-title" className="text-xl font-bold text-gray-900">
        Ya tienes una suscripción vigente
      </h2>
      <p className="text-sm text-gray-600">
        Tu cuenta ya tiene el plan <strong>{subscription.plan.name}</strong>.
      </p>
      {subscription.status === "PENDING_RENEWAL" && (
        <p className="text-sm text-amber-700">La renovación de tu plan está pendiente.</p>
      )}
      <p className="text-sm text-gray-500">
        Puedes continuar con tu plan actual o revisar tu suscripción desde tu cuenta.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void continueWithPlan()}
        disabled={isContinuing}
        className="w-full rounded-xl bg-[#4F3A96] px-5 py-3 text-sm font-semibold text-white disabled:opacity-70"
      >
        {isContinuing ? "Actualizando sesión..." : "Continuar con mi plan actual"}
      </button>
      {subscription.gateway !== "FLOW" && (
        <Link href="/pasate-a-flow" className="block text-sm font-medium text-[#4F3A96] underline">
          Pasarme a Flow
        </Link>
      )}
    </section>
  );
}
