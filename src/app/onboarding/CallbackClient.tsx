"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthPanel from "@/components/auth/AuthPanel";
import { AuthErrorNotice } from "@/components/forms/AuthFeedback";
import ExistingSubscriptionNotice from "@/components/onboarding/ExistingSubscriptionNotice";
import MigrationScheduledSuccess from "@/components/onboarding/MigrationScheduledSuccess";
import SubscriptionSuccess from "@/components/onboarding/SubscriptionSuccess";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingFlow } from "@/hooks/useOnboardingFlow";
import { getStoredOnboardingState } from "@/lib/onboardingStorage";

type InitStatus = "loading" | "no-session" | "missing-checkout" | "ready";

/** Flow returns through ms-integrations with a card token, never card details. */
export default function CallbackClient() {
  const { auth, loading, login, refreshSession } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = auth?.user.id ?? null;
  const queryToken = searchParams.get("token")?.trim() || null;
  const hasPlan =
    auth?.subscription?.status === "ACTIVE" || auth?.subscription?.status === "PENDING_RENEWAL";
  const [initStatus, setInitStatus] = useState<InitStatus>("loading");
  const [intent, setIntent] = useState<{ key: string; token: string | null } | null>(null);
  const initialized = useRef<string | null>(null);
  const started = useRef<string | null>(null);

  const { state, confirmPayment, checkPaymentAgain, restoreFromStorage } = useOnboardingFlow(
    { planId: "", planName: "", price: 0, initialUserId: userId },
    login,
    () => refreshSession(),
  );

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      initialized.current = null;
      started.current = null;
      setIntent(null);
      setInitStatus("no-session");
      return;
    }
    const stored = getStoredOnboardingState(userId);
    const token = queryToken ?? stored?.cardToken ?? null;
    const key = `${userId}:${queryToken ?? "stored"}`;
    if (initialized.current === key && !(initStatus === "missing-checkout" && hasPlan)) return;
    initialized.current = key;
    started.current = null;
    if (!token && !hasPlan) {
      setIntent(null);
      setInitStatus("missing-checkout");
      return;
    }
    if (token) {
      // Do not pair a new URL token with metadata from an older checkout.
      const matching = stored?.cardToken === token && stored.userId === userId ? stored : null;
      restoreFromStorage({
        planId: matching?.planId ?? "",
        planName: matching?.planName ?? "",
        price: matching?.price ?? 0,
        addOnIds: matching?.addOnIds ?? [],
        userId,
        cardToken: token,
        ...(matching?.subscriptionId ? { subscriptionId: matching.subscriptionId } : {}),
        // Checkout de "Pasate a Flow" (FEAT-25): el éxito puede ser una migración programada.
        ...(matching?.migrate ? { migrate: true as const } : {}),
      });
    }
    setIntent({ key, token });
    setInitStatus("ready");
  }, [loading, userId, queryToken, hasPlan, initStatus, restoreFromStorage]);

  useEffect(() => {
    if (
      loading ||
      initStatus !== "ready" ||
      !intent ||
      !userId ||
      !intent.key.startsWith(`${userId}:`)
    )
      return;
    if (started.current === intent.key) return;
    if (intent.token && (state.cardToken !== intent.token || state.userId !== userId)) return;
    started.current = intent.key;
    if (intent.token) void confirmPayment();
    else void checkPaymentAgain();
  }, [
    loading,
    userId,
    initStatus,
    intent,
    state.cardToken,
    state.userId,
    confirmPayment,
    checkPaymentAgain,
  ]);

  if (loading || initStatus === "loading") {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        role="status"
        aria-label="Recuperando tu sesión"
      >
        <Loader2 className="h-8 w-8 animate-spin text-[#4F3A96]" aria-hidden="true" />
      </div>
    );
  }

  if (!userId || initStatus === "no-session") {
    return (
      <AuthLayout>
        <AuthPanel
          onAuthenticated={() => undefined}
          notice={
            <AuthErrorNotice
              title="Retoma la activación de tu plan"
              message="Ingresa con la cuenta que usaste para elegir tu plan. Conservaremos el pago que estás verificando."
            />
          }
        />
      </AuthLayout>
    );
  }

  if (state.step === "EXISTING_SUBSCRIPTION" && state.subscription && initStatus === "ready") {
    return (
      <AuthLayout>
        <div className="w-full rounded-2xl border border-gray-200 bg-white p-8">
          <ExistingSubscriptionNotice
            subscription={state.subscription}
            continueHref={auth?.company || auth?.user?.companyId ? "/" : "/new-company"}
            refreshSession={refreshSession}
          />
        </div>
      </AuthLayout>
    );
  }

  // "Pasate a Flow" (FEAT-25): programada o cobrada en el momento, vuelve a Powip (ya tiene empresa).
  if (
    initStatus === "ready" &&
    ((state.step === "MIGRATION_SCHEDULED" && state.firstChargeDate) || (state.step === "DONE" && state.migrate))
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#f8f7fc]">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 p-8">
          <MigrationScheduledSuccess
            firstChargeDate={state.step === "MIGRATION_SCHEDULED" ? (state.firstChargeDate ?? null) : null}
            onGoToDashboard={() => {
              void refreshSession().finally(() => router.push("/"));
            }}
          />
        </div>
      </div>
    );
  }

  if (state.step === "DONE" && initStatus === "ready") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#f8f7fc]">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 p-8">
          <SubscriptionSuccess />
        </div>
      </div>
    );
  }

  const activeSubscription =
    state.subscription?.status === "ACTIVE" || state.subscription?.status === "PENDING_RENEWAL";
  const canRetry = Boolean(state.cardToken || activeSubscription);
  const choosePlanHref = state.migrate ? "/pasate-a-flow" : "/onboarding";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#f8f7fc]">
      <section
        className="w-full max-w-md bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-4"
        aria-live="polite"
      >
        {initStatus === "missing-checkout" ? (
          <>
            <h1 className="text-xl font-bold text-gray-900">
              No encontramos un pago para continuar
            </h1>
            <p className="text-sm text-gray-500">
              Tu cuenta sigue creada. Puedes retomar la elección de tu plan.
            </p>
            <Link href={choosePlanHref} className="text-[#4F3A96] underline text-sm font-medium">
              Elegir mi plan
            </Link>
          </>
        ) : state.step === "PAYMENT_PENDING" ? (
          <>
            <h1 className="text-xl font-bold text-gray-900">Tu pago está en proceso</h1>
            <p className="text-sm text-gray-500">
              Estamos esperando la confirmación de Flow. Puedes verificar otra vez sin iniciar un
              nuevo pago.
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
        ) : state.step === "ERROR" ? (
          <>
            <AuthErrorNotice
              title="No pudimos completar la activación"
              message={state.error ?? "Intenta nuevamente."}
            />
            {canRetry && (
              <button
                type="button"
                disabled={state.isLoading}
                onClick={() => void (activeSubscription ? checkPaymentAgain() : confirmPayment())}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#4F3A96] disabled:opacity-70"
              >
                {activeSubscription ? "Volver a verificar" : "Reintentar confirmación"}
              </button>
            )}
            {!canRetry && (
              <Link href={choosePlanHref} className="text-[#4F3A96] underline text-sm font-medium">
                Elegir mi plan
              </Link>
            )}
          </>
        ) : (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-[#4F3A96] mx-auto" aria-hidden="true" />
            <h1 className="text-xl font-bold text-gray-900">Confirmando tu pago</h1>
            <p className="text-sm text-gray-500">
              Estamos verificando tu tarjeta y activando tu suscripción.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
