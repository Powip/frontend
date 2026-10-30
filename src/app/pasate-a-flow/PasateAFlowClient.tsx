"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import OnboardingClient from "@/app/onboarding/OnboardingClient";
import { PowipPulseLoader } from "@/components/shared/PowipPulseLoader";
import { useAuth } from "@/contexts/AuthContext";
import { formatLimaDate, limaToday } from "@/lib/flowMigration";
import { fetchMySubscription } from "@/services/onboardingService";
import type { SubscriptionMe } from "@/types/onboarding";

const HAS_PLAN = new Set(["ACTIVE", "PENDING_RENEWAL"]);

type MeState = { status: "loading" } | { status: "error" } | { status: "ready"; me: SubscriptionMe | null };

/**
 * "Pasate a Flow" (FEAT-25): el dueño de una empresa sin Flow registra su tarjeta o Yape con su plan
 * actual marcado. Llega desde el banner (AVISO) o lo trae el gate (BLOQUEADO).
 */
export default function PasateAFlowClient() {
  const { auth, logout, refreshSubscription, refreshSession } = useAuth();
  const router = useRouter();
  const [meState, setMeState] = useState<MeState>({ status: "loading" });
  const [revision, setRevision] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: The revision reloads /me after an explicit retry.
  useEffect(() => {
    let active = true;
    setMeState({ status: "loading" });
    fetchMySubscription()
      .then((me) => {
        if (active) setMeState({ status: "ready", me });
      })
      .catch(() => {
        if (active) setMeState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, [revision]);

  const signOut = async () => {
    await logout();
    router.push("/login");
  };
  const goToPowip = useCallback(async () => {
    await refreshSession();
    router.push("/");
  }, [refreshSession, router]);

  const frame = (content: ReactNode) => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#f8f7fc] px-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-gray-200 bg-white p-8 text-center">
        {content}
      </div>
      <button type="button" onClick={() => void signOut()} className="text-sm text-gray-500 underline">
        Cerrar sesión
      </button>
    </div>
  );
  // Recarga la sesión antes de entrar: el acceso guardado puede estar viejo (pagó en otra pestaña)
  // y el gate lo devolvería acá.
  const goHomeLink = (label: string) => (
    <button
      type="button"
      onClick={() => void goToPowip()}
      className="text-sm font-medium text-[#4F3A96] underline"
    >
      {label}
    </button>
  );

  const access = auth?.access;
  if (!auth || meState.status === "loading") {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <PowipPulseLoader label="Cargando..." />
      </div>
    );
  }
  if (!access) {
    return frame(
      <>
        <p className="text-gray-900">No pudimos verificar tu cuenta.</p>
        <button
          type="button"
          onClick={() => void refreshSubscription()}
          className="rounded-xl bg-[#4F3A96] px-5 py-2 text-sm font-semibold text-white"
        >
          Reintentar
        </button>
      </>,
    );
  }
  if (!access.owner) {
    return frame(
      <>
        <p className="text-gray-900">Solo el dueño de la cuenta puede registrar el medio de pago.</p>
        {goHomeLink("Ir al inicio")}
      </>,
    );
  }
  if (meState.status === "error") {
    return frame(
      <>
        <p className="text-gray-900">No pudimos cargar tu plan.</p>
        <button
          type="button"
          onClick={() => setRevision((r) => r + 1)}
          className="rounded-xl bg-[#4F3A96] px-5 py-2 text-sm font-semibold text-white"
        >
          Reintentar
        </button>
      </>,
    );
  }

  const me = meState.me;
  if (me?.gateway === "FLOW" && HAS_PLAN.has(me.status)) {
    return frame(
      <>
        <p className="text-lg font-semibold text-gray-900">Ya estás en Flow.</p>
        {goHomeLink("Ir a Powip")}
      </>,
    );
  }
  if (me?.scheduledFlow) {
    const firstCharge = me.scheduledFlow.firstChargeDate;
    return frame(
      <>
        <p className="text-lg font-semibold text-gray-900">
          {firstCharge > limaToday()
            ? `Ya estás en Flow. Tu primer cobro es el ${formatLimaDate(firstCharge)}.`
            : "Estamos procesando tu primer cobro."}
        </p>
        {goHomeLink("Ir a Powip")}
      </>,
    );
  }

  const paidUntil = me && HAS_PLAN.has(me.status) ? me.endDate : null;
  return (
    <>
      <OnboardingClient
        mode="migration"
        initialAuth={{ userId: auth.user.id }}
        planId={me?.plan.id ?? ""}
        planName={me?.plan.name ?? ""}
        price={me?.plan.price ?? 0}
        initialAddOnCodes={me?.addOns.map((a) => a.code) ?? []}
        paidUntil={paidUntil}
        blocked={access.state === "BLOQUEADO"}
        onGoToDashboard={() => void goToPowip()}
      />
      <div className="flex justify-center pb-6">
        <button type="button" onClick={() => void signOut()} className="text-sm text-gray-500 underline">
          Cerrar sesión
        </button>
      </div>
    </>
  );
}
