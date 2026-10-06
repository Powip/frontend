"use client";

import type {
  BackendAddOn,
  BackendPlan,
  OnboardingStep,
  SubscriptionMe,
} from "@/types/onboarding";

/**
 * Datos de ejemplo para recorrer el onboarding en desarrollo sin sesión ni
 * backend. Solo los usa el panel de desarrollo (NODE_ENV=development).
 */
export const DEMO_PLANS: BackendPlan[] = [
  { id: "demo-basic", name: "Basic", price: 99, durationInDays: 30 },
  { id: "demo-medium", name: "Medium", price: 189, durationInDays: 30 },
  { id: "demo-scale", name: "Scale", price: 269, durationInDays: 30 },
  { id: "demo-enterprise", name: "Enterprise", price: 0, durationInDays: 30 },
  { id: "demo-basic-anual", name: "Basic Anual", price: 799, durationInDays: 365 },
  { id: "demo-medium-anual", name: "Medium Anual", price: 1399, durationInDays: 365 },
  { id: "demo-scale-anual", name: "Scale Anual", price: 2099, durationInDays: 365 },
];

const demoAddOn = (code: string, name: string): BackendAddOn => ({
  id: `demo-${code}`,
  code,
  name,
  amount: 29,
  annualAmount: 348,
  currency: "PEN",
  active: true,
});

export const DEMO_ADD_ONS: BackendAddOn[] = [
  demoAddOn("courier", "Integración Courier"),
  demoAddOn("marketplace", "Integración Marketplace"),
  demoAddOn("sunat", "Integración SUNAT"),
];

/** Suscripción activa de ejemplo para el paso "¡Listo!", armada con la selección actual. */
export function demoSubscription(
  plan: { id: string; name: string; price: number },
  addOns: { addOn: BackendAddOn; price: number }[],
  isAnnual: boolean,
): SubscriptionMe {
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + (isAnnual ? 365 : 30));
  return {
    id: "demo-subscription",
    status: "ACTIVE",
    gateway: "FLOW",
    autoRenewal: true,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    plan: { id: plan.id, name: plan.name, price: plan.price, durationInDays: isAnnual ? 365 : 30 },
    addOns: addOns.map(({ addOn, price }) => ({ code: addOn.code, name: addOn.name, amount: price })),
  };
}

/** Estados del paso Pago que se pueden previsualizar (el widget de Flow necesita un token real). */
const PAYMENT_STATES: { step: OnboardingStep; label: string }[] = [
  { step: "CARD_REDIRECT", label: "Resumen" },
  { step: "CONFIRMING", label: "Confirmando" },
  { step: "PAYMENT_PENDING", label: "Pendiente" },
  { step: "ERROR", label: "Error" },
];

interface OnboardingDevPanelProps {
  currentStep: number;
  isOverriding: boolean;
  paymentStep: OnboardingStep;
  demoLoaded: boolean;
  onStep: (step: number) => void;
  onPaymentStep: (step: OnboardingStep) => void;
  onLoadDemo: () => void;
  onReset: () => void;
}

const chip = (active: boolean) =>
  `px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
    active ? "bg-[#4F3A96] text-white" : "bg-[#ede9ff] text-[#4F3A96] hover:bg-[#ddd5ff]"
  }`;

export function OnboardingDevPanel({
  currentStep,
  isOverriding,
  paymentStep,
  demoLoaded,
  onStep,
  onPaymentStep,
  onLoadDemo,
  onReset,
}: OnboardingDevPanelProps) {
  return (
    <div
      role="toolbar"
      aria-label="Modo desarrollo del onboarding"
      className="fixed bottom-4 left-16 z-50 flex max-w-[calc(100vw-5rem)] flex-col gap-2 rounded-2xl border border-purple-200 bg-white/95 p-3 shadow-lg backdrop-blur-md"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-bold text-purple-900">DEV MODE:</span>
        {[1, 2, 3, 4].map((step) => (
          <button
            key={step}
            type="button"
            onClick={() => onStep(step)}
            aria-pressed={currentStep === step}
            className={chip(currentStep === step)}
          >
            Step {step}
          </button>
        ))}
        <button
          type="button"
          onClick={onLoadDemo}
          disabled={demoLoaded}
          className="cursor-pointer rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-default disabled:opacity-60"
        >
          {demoLoaded ? "Datos demo ✓" : "Cargar datos demo"}
        </button>
        {isOverriding && (
          <button
            type="button"
            onClick={onReset}
            className="cursor-pointer rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
          >
            Reset
          </button>
        )}
      </div>

      {currentStep === 3 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-medium text-purple-900">Pago:</span>
          {PAYMENT_STATES.map(({ step, label }) => (
            <button
              key={step}
              type="button"
              onClick={() => onPaymentStep(step)}
              aria-pressed={paymentStep === step}
              className={chip(paymentStep === step)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
