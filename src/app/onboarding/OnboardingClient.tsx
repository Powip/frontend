"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  Shield,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthPanel from "@/components/auth/AuthPanel";
import RegisterForm from "@/components/forms/RegisterForm";
import EnterpriseContactModal from "@/components/modals/EnterpriseContactModal";
import ExistingSubscriptionNotice from "@/components/onboarding/ExistingSubscriptionNotice";
import FlowWidgetStep from "@/components/onboarding/FlowWidgetStep";
import MigrationScheduledSuccess from "@/components/onboarding/MigrationScheduledSuccess";
import PlanPicker from "@/components/onboarding/PlanPicker";
import { useAuth } from "@/contexts/AuthContext";
import { type RegisterData, useOnboardingFlow } from "@/hooks/useOnboardingFlow";
import { firstChargePreview, formatLimaDate, limaToday } from "@/lib/flowMigration";
import { basePlanName, counterpartPlan, isAnnualPlanName } from "@/lib/onboardingPlan";
import { fetchAddOns, fetchPlans } from "@/services/onboardingService";
import {
  addOnPrice,
  type BackendAddOn,
  type BackendPlan,
  type OnboardingStep,
  type SubscriptionMe,
  type SubscriptionSummary,
  summarizeSubscription,
} from "@/types/onboarding";
import styles from "../../components/onboarding/onboarding-layout.module.css";
import {
  DEMO_ADD_ONS,
  DEMO_PLANS,
  demoSubscription,
  OnboardingDevPanel,
} from "./_components/OnboardingDevPanel";

interface OnboardingClientProps {
  /** Plan preseleccionado (desde la landing o /sin-plan); se cambia en el paso 2. */
  planId?: string;
  planName?: string;
  price?: number;
  /** Usuario ya logueado (viene de /sin-plan): se saltea el registro. */
  initialAuth?: { userId: string };
  onGoToDashboard?: () => void;
  /**
   * "migration" = pantalla "Pasate a Flow" (FEAT-25): sin registro, checkout con migrate, primer
   * cobro al vencer lo ya pagado y éxito programado. Por defecto, el onboarding de siempre.
   */
  mode?: "signup" | "migration";
  /** Add-ons contratados hoy (por code): vienen marcados en el paso del plan. */
  initialAddOnCodes?: string[];
  /** Último día pagado del plan actual (yyyy-MM-dd), si sigue vigente. */
  paidUntil?: string | null;
  /** La empresa ya está bloqueada: el encabezado lo explica. */
  blocked?: boolean;
}

const ADDON_MODAL_CONFIG: Record<
  string,
  { name: string; desc: string; icon: string; tags: string[] }
> = {
  courier: {
    name: "Integración Courier",
    desc: "Conecta Shalom y Olva. Genera guías, rastrea envíos y liquida COD sin salir de Powip.",
    icon: "🚚",
    tags: ["Shalom", "Olva", "Guías automáticas", "Liquidaciones COD"],
  },
  sunat: {
    name: "Integración SUNAT",
    desc: "Emite boletas y facturas electrónicas. Envío automático al cliente por email y WhatsApp.",
    icon: "🧾",
    tags: ["Boletas", "Facturas", "Notas de crédito", "Envío auto"],
  },
  marketplace: {
    name: "Integración Marketplace",
    desc: "Conecta Falabella, Ripley y Mercado Libre. Gestiona pedidos de todos en un solo panel.",
    icon: "🏪",
    tags: ["Falabella", "Ripley", "Mercado Libre", "Stock sync"],
  },
};

const STEPS = [
  { num: 1, name: "Cuenta" },
  { num: 2, name: "Plan" },
  { num: 3, name: "Pago" },
  { num: 4, name: "¡Listo!" },
];

/** "Pasate a Flow" (FEAT-25): ya tienen cuenta, así que no hay paso de registro. */
const MIGRATION_STEPS = [
  { num: 2, name: "Plan" },
  { num: 3, name: "Tarjeta" },
  { num: 4, name: "¡Listo!" },
];

const BRAND_PANEL_CONTENT: Record<
  number,
  { headline: string; sub: string; mascot: string; viewBox: string }
> = {
  1: {
    headline: "Bienvenido a Powip",
    sub: "Crea tu cuenta en segundos y accede inmediatamente a todas las herramientas de tu plan.",
    mascot: "/mascota-saludando.svg",
    viewBox: "426 240 592 970",
  },
  2: {
    headline: "Elige tu plan",
    sub: "Selecciona tu plan y las integraciones que necesitas para gestionar tu negocio.",
    mascot: "/mascota-idea.svg",
    viewBox: "467 234 515 962",
  },
  3: {
    headline: "¡Casi listo!",
    sub: "Revisa el total de tu suscripción y registra tu tarjeta con Flow.",
    mascot: "/mascota-pc-2.svg",
    viewBox: "413 267 701 931",
  },
  4: {
    headline: "¡Todo listo!",
    sub: "Configura tu empresa para empezar a gestionar tus pedidos.",
    mascot: "/mascota-silla.svg",
    viewBox: "425 263 646 964",
  },
};

// ---------------------------------------------------------------------------
// BrandPanel
// ---------------------------------------------------------------------------

function planLabel(planName: string, price: number, isAnnual: boolean): string {
  if (!planName) return "Elige tu plan";
  return `Plan ${basePlanName(planName)} — S/ ${price}/${isAnnual ? "año" : "mes"}`;
}

/** Igual que planLabel, pero con el total cuando hay add-ons (encabezado mobile del paso Pago). */
function summaryLabel(planName: string, summary: SubscriptionSummary, isAnnual: boolean): string {
  const count = summary.addOns.length;
  if (!planName || count === 0) return planLabel(planName, summary.total, isAnnual);
  return `Plan ${basePlanName(planName)} + ${count} add-on${count > 1 ? "s" : ""} — S/ ${summary.total}/${isAnnual ? "año" : "mes"}`;
}

function addOnDisplay(addOn: BackendAddOn): { name: string; icon: string } {
  const config = ADDON_MODAL_CONFIG[addOn.code];
  return { name: config?.name ?? addOn.name, icon: config?.icon ?? "➕" };
}

interface BrandPanelProps {
  currentStep: number;
  planName: string;
  price: number;
  isAnnual: boolean;
  summary: SubscriptionSummary;
}

function BrandPanel({ currentStep, planName, price, isAnnual, summary }: BrandPanelProps) {
  const content = BRAND_PANEL_CONTENT[currentStep] ?? BRAND_PANEL_CONTENT[1];
  const period = isAnnual ? "año" : "mes";
  const showSummary = currentStep === 3 && planName !== "";

  return (
    <aside className={styles.brand} aria-label="Tu suscripción en Powip">
      <Image
        src="/logo-powip-text.svg"
        alt="Powip"
        width={160}
        height={52}
        priority
        className={styles.brandLogo}
      />
      <div>
        <h2 className={styles.brandTitle}>{content.headline}</h2>
        <p className={styles.brandDescription}>{content.sub}</p>
      </div>
      <div>
        {showSummary ? (
          <section aria-label="Resumen de tu suscripción" className={styles.brandSummary}>
            <dl>
              <div>
                <dt>Plan {basePlanName(planName)}</dt>
                <dd>
                  S/ {price}/{period}
                </dd>
              </div>
              {summary.addOns.map(({ addOn, price: addOnAmount }) => {
                const { name, icon } = addOnDisplay(addOn);
                return (
                  <div key={addOn.id}>
                    <dt>
                      <span aria-hidden="true">{icon}</span> {name}
                    </dt>
                    <dd>
                      +S/ {addOnAmount}/{period}
                    </dd>
                  </div>
                );
              })}
              <div className={styles.brandTotal}>
                <dt>Total {period === "año" ? "anual" : "mensual"}</dt>
                <dd>
                  S/ {summary.total}/{period}
                </dd>
              </div>
            </dl>
          </section>
        ) : planName ? (
          <p className={styles.brandPlan}>{planLabel(planName, price, isAnnual)}</p>
        ) : null}
      </div>
      <div className={styles.brandArt} aria-hidden="true">
        <svg
          viewBox={content.viewBox}
          className={styles.mascot}
          focusable="false"
          aria-hidden="true"
        >
          <image href={content.mascot} width={1500} height={1500} />
        </svg>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// OnboardingProgress
// ---------------------------------------------------------------------------

function OnboardingProgress({
  currentStep,
  steps = STEPS,
}: {
  currentStep: number;
  steps?: { num: number; name: string }[];
}) {
  return (
    <nav aria-label="Progreso de la suscripción">
      <ol className={styles.progress}>
        {steps.map((step) => {
          const isCompleted = step.num < currentStep;
          const isCurrent = step.num === currentStep;
          return (
            <li
              key={step.num}
              className={`${styles.progressStep} ${isCurrent ? styles.progressCurrent : ""} ${isCompleted ? styles.progressComplete : ""}`}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span className={styles.progressIndex} aria-hidden="true">
                {isCompleted ? <Check size={15} aria-hidden="true" /> : step.num}
              </span>
              <span>
                {step.name}
                <span className="sr-only">{isCompleted ? ", completado" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Step2
// ---------------------------------------------------------------------------

interface Step2Props {
  plans: BackendPlan[];
  planId: string;
  onSelectPlan: (plan: BackendPlan) => void;
  onCycleChange: (isAnnual: boolean) => void;
  onEnterprise: () => void;
  price: number;
  isAnnual: boolean;
  selectedAddons: string[];
  onToggleAddon: (id: string) => void;
  onNext: () => void;
  onSkipAddOns: () => void;
  plansLoading: boolean;
  plansError: string | null;
  onRetryPlans: () => void;
  addOnsLoading: boolean;
  addOnsError: string | null;
  onRetryAddOns: () => void;
  addOns: BackendAddOn[];
  summary: SubscriptionSummary;
}

function Step2({
  plans,
  planId,
  onSelectPlan,
  onCycleChange,
  onEnterprise,
  price,
  isAnnual,
  selectedAddons,
  onToggleAddon,
  onNext,
  onSkipAddOns,
  plansLoading,
  plansError,
  onRetryPlans,
  addOnsLoading,
  addOnsError,
  onRetryAddOns,
  addOns,
  summary,
}: Step2Props) {
  const hasPlan = !plansLoading && !plansError && plans.some((plan) => plan.id === planId);
  const canContinue =
    hasPlan &&
    !addOnsLoading &&
    !selectedAddons.some((id) => !addOns.some((addOn) => addOn.id === id));
  const period = isAnnual ? "año" : "mes";
  const addOnPrices = addOns.map((a) => addOnPrice(a, isAnnual));
  const minAddOnPrice = Math.min(...addOnPrices);
  const samePrice = addOnPrices.every((p) => p === minAddOnPrice);

  return (
    <div className="flex flex-col gap-4">
      <PlanPicker
        plans={plans}
        selectedPlanId={planId}
        isAnnual={isAnnual}
        onSelect={onSelectPlan}
        onCycleChange={onCycleChange}
        onEnterprise={onEnterprise}
        isLoading={plansLoading}
        error={plansError}
        onRetry={onRetryPlans}
      />

      {/* Header */}
      <div className="mb-1 mt-2">
        <h3 className="font-bold text-xl text-gray-900">Add-ons opcionales</h3>
        <p className="text-sm text-gray-500 mt-1">
          {addOns.length > 0
            ? `${samePrice ? "" : "Desde "}S/ ${minAddOnPrice}/${period} cada uno`
            : "Opcionales"}{" "}
          — actívalos ahora o después desde <strong className="text-gray-700">Configuración</strong>
          .
        </p>
      </div>

      {/* Add-on grid */}
      {addOnsLoading && (
        <p role="status" className="text-sm text-gray-500">
          Cargando add-ons...
        </p>
      )}
      {addOnsError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <p>{addOnsError} Puedes omitirlos y activarlos después.</p>
          <button type="button" onClick={onRetryAddOns} className="mt-2 font-semibold underline">
            Reintentar carga de add-ons
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {addOns.map((addon) => {
          const config = ADDON_MODAL_CONFIG[addon.code] ?? {
            name: addon.name,
            desc: addon.description ?? "",
            icon: "➕",
            tags: [],
          };
          const isSelected = selectedAddons.includes(addon.id);
          const isPopular = addon.code === "courier";

          return (
            <button
              key={addon.id}
              type="button"
              onClick={() => onToggleAddon(addon.id)}
              className="relative text-left rounded-2xl border-2 p-4 transition-all duration-200 cursor-pointer"
              style={{
                borderColor: isSelected ? "#4F3A96" : "#e5e7eb",
                background: isSelected ? "#f5f2ff" : "white",
                boxShadow: isSelected
                  ? "0 0 0 4px rgba(79,58,150,0.08), 0 1px 3px rgba(0,0,0,0.04)"
                  : "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              {/* Badge "Más popular" */}
              {isPopular && (
                <div
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
                  style={{ background: "#4F3A96", color: "white" }}
                >
                  Más popular
                </div>
              )}

              {/* Check icon */}
              {isSelected && (
                <div
                  className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: "#4F3A96" }}
                >
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}

              {/* Icon */}
              <div className="text-2xl mb-2">{config.icon}</div>

              {/* Name & desc */}
              <h4 className="font-bold text-gray-900 text-sm leading-tight">{config.name}</h4>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-3">
                {config.desc}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 mt-2">
                {config.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: "#f3f4f6", color: "#6b7280" }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Price */}
              <div className="font-bold text-sm mt-3" style={{ color: "#4F3A96" }}>
                + S/ {addOnPrice(addon, isAnnual)}/{period}
              </div>
            </button>
          );
        })}
      </div>

      {/* Total summary */}
      <div
        className="rounded-xl p-4 flex items-center justify-between mt-1"
        style={{ background: "#faf7ff", border: "1px solid #e4d8ff" }}
      >
        <div className="text-gray-500 text-sm">
          Total {isAnnual ? "anual" : "mensual"}
          <br />
          <span className="text-xs">
            {hasPlan ? `Plan S/${price}` : "Sin plan elegido"}
            {summary.addOns.length > 0 && ` + Add-ons S/${summary.addOnsTotal}`}
          </span>
        </div>
        <div className="font-bold text-xl" style={{ color: "#4F3A96" }}>
          S/ {summary.total}/{period}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 mt-1">
        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          className="w-full h-12 text-base rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "#4F3A96" }}
        >
          <ArrowRight className="w-4 h-4" />
          {!hasPlan
            ? "Elige un plan para continuar"
            : selectedAddons.length > 0
              ? `Continuar con ${selectedAddons.length} add-on${selectedAddons.length > 1 ? "s" : ""}`
              : "Continuar al pago"}
        </button>
        <button
          type="button"
          onClick={onSkipAddOns}
          disabled={!hasPlan}
          className="text-sm text-gray-400 hover:text-gray-600 font-medium py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Omitir por ahora — activo después desde Configuración
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step3
// ---------------------------------------------------------------------------

interface Step3Props {
  planName: string;
  price: number;
  isAnnual: boolean;
  summary: SubscriptionSummary;
  isLoading: boolean;
  step: string;
  error: string | null;
  cardToken: string | null;
  redirectUrl: string | null;
  onBack: () => void;
  onInitiate: () => Promise<void>;
  onSubscribe: () => Promise<void>;
  onCheckAgain: () => Promise<void>;
  onRetry: () => void;
  onError: (msg: string) => void;
  /** Migración a Flow (FEAT-25): cuándo se cobra, en lugar de "Acceso inmediato al activar". */
  firstChargeNotice?: string | null;
}

function Step3({
  planName,
  price,
  isAnnual,
  summary,
  isLoading,
  step,
  error,
  cardToken,
  redirectUrl,
  onBack,
  onInitiate,
  onSubscribe,
  onCheckAgain,
  onRetry,
  onError,
  firstChargeNotice,
}: Step3Props) {
  const period = isAnnual ? "año" : "mes";

  if (step === "CONFIRMING") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: "#4F3A96" }} />
        <p className="font-semibold text-gray-900">Confirmando tu pago...</p>
        <p className="text-sm text-gray-500">
          Estamos registrando tu tarjeta y procesando el primer cobro. Puede tardar unos segundos.
        </p>
      </div>
    );
  }

  if (step === "PAYMENT_PENDING") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="text-4xl">⏳</div>
        <div>
          <p className="font-semibold text-gray-900">Tu pago está en proceso</p>
          <p className="text-sm text-gray-500 mt-1">
            Flow todavía no confirmó el primer cobro. Apenas se confirme vas a poder entrar a Powip.
          </p>
        </div>
        <button
          type="button"
          onClick={onCheckAgain}
          disabled={isLoading}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-70"
          style={{ background: "#4F3A96" }}
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          Volver a verificar
        </button>
      </div>
    );
  }

  if (step === "ERROR") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="text-4xl">❌</div>
        <p className="text-sm text-gray-700">{error ?? "Ocurrió un error inesperado."}</p>
        <button
          type="button"
          onClick={onRetry}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "#4F3A96" }}
        >
          Volver a intentar
        </button>
      </div>
    );
  }

  if (step === "CARD_WIDGET" && cardToken) {
    return (
      <div className="flex flex-col gap-3">
        <FlowWidgetStep token={cardToken} onSuccess={onSubscribe} onError={onError} />
        {redirectUrl && (
          <a
            href={redirectUrl}
            className="text-xs text-center text-gray-400 hover:text-gray-600 underline"
          >
            ¿No carga el formulario? Registrá tu tarjeta en la página de Flow
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="mb-1">
        <h3 className="font-bold text-xl text-gray-900">Resumen de tu suscripción</h3>
        <p className="text-sm text-gray-500 mt-1">
          Revisa los detalles antes de registrar tu tarjeta.
        </p>
      </div>

      {/* Plan summary card */}
      <div
        className="rounded-xl p-4"
        style={{ background: "#f5f2ff", border: "1px solid #e8e0ff" }}
      >
        {/* Plan row */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-gray-800 text-sm">Plan {planName}</span>
          <span className="font-bold text-sm" style={{ color: "#4F3A96" }}>
            S/ {price}/{period}
          </span>
        </div>

        {/* Add-on rows */}
        {summary.addOns.map(({ addOn: addon, price: addOnAmount }) => {
          const { name, icon } = addOnDisplay(addon);
          return (
            <div key={addon.id} className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm flex items-center gap-1.5">
                {icon} {name}
              </span>
              <span className="font-medium text-sm text-gray-800">
                +S/ {addOnAmount}/{period}
              </span>
            </div>
          );
        })}

        {/* Total */}
        <div
          className="flex items-center justify-between pt-3 mt-1"
          style={{ borderTop: "1px solid #e8e0ff", background: "transparent" }}
        >
          <span className="font-bold text-gray-900">Total</span>
          <span className="font-black text-xl" style={{ color: "#4F3A96" }}>
            S/ {summary.total}/{period}
          </span>
        </div>
      </div>

      {/* What's included */}
      <div
        className="rounded-xl p-4 flex items-start gap-3"
        style={{ background: "#f0fdf9", border: "1px solid #a7f3d0" }}
      >
        <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#008a7b" }} />
        <div className="text-sm" style={{ color: "#065f46" }}>
          {firstChargeNotice ? (
            <>
              <p className="font-semibold">Cuándo te cobramos</p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "#047857" }}>
                {firstChargeNotice}
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">Qué incluye tu plan</p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "#047857" }}>
                Acceso inmediato al activar — todas las herramientas del plan {planName} disponibles
                desde el primer día.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Payment info */}
      <div
        className="rounded-xl p-4 flex items-start gap-3"
        style={{ background: "#f0f4ff", border: "1px solid #c7d2fe" }}
      >
        <Shield className="w-5 h-5 shrink-0 mt-0.5 text-indigo-500" />
        <div className="text-sm text-indigo-900">
          <p className="font-semibold">Pago seguro con tarjeta</p>
          <p className="mt-1 text-xs leading-relaxed text-indigo-700">
            Registrarás tu tarjeta de débito o crédito directamente en Flow. Powip no almacena datos
            de tu tarjeta.
          </p>
        </div>
      </div>

      {/* Register card button */}
      <button
        type="button"
        onClick={onInitiate}
        disabled={isLoading}
        className="w-full h-12 rounded-xl font-semibold text-white flex items-center justify-center gap-2 mt-1 transition-opacity disabled:opacity-70"
        style={{ background: "#4F3A96" }}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Preparando registro...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4" />
            Registrar tarjeta
          </>
        )}
      </button>

      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center justify-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 font-medium py-1 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a add-ons
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StepSuccess
// ---------------------------------------------------------------------------

interface StepSuccessProps {
  planName: string;
  price: number;
  isAnnual: boolean;
  subscription: SubscriptionMe | null;
  onGoToDashboard: () => void;
}

function StepSuccess({
  planName,
  price,
  isAnnual,
  subscription,
  onGoToDashboard,
}: StepSuccessProps) {
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load CSS once
    if (!document.getElementById("gcal-css")) {
      const link = document.createElement("link");
      link.id = "gcal-css";
      link.rel = "stylesheet";
      link.href = "https://calendar.google.com/calendar/scheduling-button-script.css";
      document.head.appendChild(link);
    }

    const mountButton = () => {
      const w = window as typeof window & {
        calendar?: {
          schedulingButton: { load: (opts: Record<string, unknown>) => void };
        };
      };
      if (w.calendar?.schedulingButton && calendarRef.current) {
        calendarRef.current.innerHTML = ""; // Clear previously rendered buttons
        w.calendar.schedulingButton.load({
          url: "https://calendar.google.com/calendar/appointments/schedules/AcZssZ2iNRS7HzAPMxW6Q0K5ZVJWvujdZCCc1VNocEStpp5filq3ug2I523N8OzpfVqyMAb6o2M4IL93?gv=true",
          color: "#8E24AA",
          label: "Agendar reunión de onboarding",
          target: calendarRef.current,
        });
      }
    };

    if (!document.getElementById("gcal-script")) {
      const script = document.createElement("script");
      script.id = "gcal-script";
      script.src = "https://calendar.google.com/calendar/scheduling-button-script.js";
      script.async = true;
      script.onload = mountButton;
      document.head.appendChild(script);
    } else {
      mountButton();
      // Retry por si window.calendar aún no está listo
      const retryId = setTimeout(mountButton, 400);
      return () => clearTimeout(retryId);
    }
  }, []);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const isPaid = subscription?.status === "ACTIVE";
  const receiptPlanName = subscription?.plan.name ?? planName;
  const receiptPrice = subscription?.plan.price ?? price;
  const receiptIsAnnual = subscription ? subscription.plan.durationInDays >= 300 : isAnnual;

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <div className="flex flex-col items-center text-center gap-3 pt-2">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: "#dcfce7" }}
        >
          <Check className="w-8 h-8" style={{ color: "#16a34a" }} />
        </div>
        <div>
          <h3 className="font-bold text-xl text-gray-900">¡Cuenta activada!</h3>
          <p className="text-sm text-gray-500 mt-1">Tu plan está activo. Bienvenido a Powip.</p>
        </div>
      </div>

      {/* Receipt ticket */}
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 overflow-hidden">
        {/* Ticket header */}
        <div className="px-5 py-3 flex items-center gap-2" style={{ background: "#f5f2ff" }}>
          <span className="text-base">🎫</span>
          <span className="text-sm font-semibold" style={{ color: "#4F3A96" }}>
            Comprobante de suscripción
          </span>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          {subscription ? (
            <>
              {/* Plan & price */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Plan {receiptPlanName}</span>
                <span className="text-sm font-bold" style={{ color: "#4F3A96" }}>
                  S/ {receiptPrice}/{receiptIsAnnual ? "año" : "mes"}
                </span>
              </div>

              {/* Period */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Período</span>
                <span className="text-sm text-gray-700">
                  {subscription.startDate ? formatDate(subscription.startDate) : "—"} →{" "}
                  {subscription.endDate ? formatDate(subscription.endDate) : "—"}
                </span>
              </div>

              {/* Add-ons contratados */}
              {subscription.addOns.map((addOn) => (
                <div key={addOn.code} className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{addOn.name}</span>
                  <span className="text-sm text-gray-700">+S/ {addOn.amount}</span>
                </div>
              ))}

              {/* Status badge */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Estado</span>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    background: isPaid ? "#dcfce7" : "#fef9c3",
                    color: isPaid ? "#166534" : "#854d0e",
                  }}
                >
                  {isPaid
                    ? "Pagado"
                    : subscription.status === "PENDING_RENEWAL"
                      ? "Renovación pendiente"
                      : "Pendiente"}
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 text-center py-2">
              Tu suscripción está siendo procesada, recibirás confirmación.
            </p>
          )}
        </div>
      </div>

      {/* What's included */}
      <div className="flex flex-col gap-2.5">
        {[
          "Acceso inmediato a tu panel",
          "Onboarding guiado por Powip",
          "Soporte por WhatsApp",
          "Cancela cuando quieras",
        ].map((item) => (
          <div key={item} className="flex items-center gap-2.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "#dcfce7" }}
            >
              <Check className="w-3 h-3" style={{ color: "#16a34a" }} />
            </div>
            <span className="text-sm text-gray-600">{item}</span>
          </div>
        ))}
      </div>

      {/* Onboarding meeting CTA */}
      <div
        className="rounded-xl border p-4 flex flex-col gap-3"
        style={{ background: "#faf7ff", borderColor: "#e4d8ff" }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-base"
            style={{ background: "#ede9ff" }}
          >
            📅
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              ¿Querés sacarle el máximo a Powip?
            </p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Agendá una reunión de onboarding gratuita — un especialista te guiará por las
              funciones clave de tu plan.
            </p>
          </div>
        </div>
        {/* Google Calendar button se monta aquí */}
        <div ref={calendarRef} />
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={onGoToDashboard}
        className="w-full h-12 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-opacity"
        style={{ background: "#4F3A96" }}
      >
        Configurar mi empresa
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OnboardingClient
// ---------------------------------------------------------------------------

export default function OnboardingClient({
  planId = "",
  planName = "",
  price = 0,
  initialAuth,
  onGoToDashboard,
  mode = "signup",
  initialAddOnCodes,
  paidUntil = null,
  blocked = false,
}: OnboardingClientProps) {
  const isMigration = mode === "migration";
  const { auth, login, refreshSession } = useAuth();
  const router = useRouter();
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [addOns, setAddOns] = useState<BackendAddOn[]>([]);
  const [plans, setPlans] = useState<BackendPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [plansRevision, setPlansRevision] = useState(0);
  const [addOnsLoading, setAddOnsLoading] = useState(false);
  const [addOnsError, setAddOnsError] = useState<string | null>(null);
  const [addOnsRevision, setAddOnsRevision] = useState(0);
  const [enterpriseOpen, setEnterpriseOpen] = useState(false);

  const {
    state: flowState,
    setPlan,
    register,
    selectAddOns,
    initiateCardRegistration,
    confirmPayment,
    checkPaymentAgain,
    retry,
    goBack,
    setError,
    resumeSession,
  } = useOnboardingFlow(
    {
      planId,
      planName,
      price,
      initialUserId: initialAuth?.userId ?? auth?.user?.id ?? null,
      migrate: isMigration,
    },
    login,
    // Al pagar, ms-subscription pasa al usuario a ADMINISTRADOR en ms-auth: hace
    // falta un token nuevo con ese rol (y la suscripción ACTIVE en el contexto).
    () => refreshSession(),
  );

  // Refresh can finish after this public page mounts. An existing account
  // continues with its plan instead of being asked to register again.
  const sessionUserId = auth?.user?.id;
  useEffect(() => {
    if (sessionUserId) resumeSession(sessionUserId);
  }, [sessionUserId, resumeSession]);

  // El plan elegido manda; sin plan, el ciclo lo marca el toggle del paso 2.
  const [annualView, setAnnualView] = useState(isAnnualPlanName(planName));
  const isAnnual = flowState.planName ? isAnnualPlanName(flowState.planName) : annualView;

  // Modo desarrollo: forzar paso y estado del pago, y cargar datos demo sin sesión.
  const isDev = process.env.NODE_ENV === "development";
  const [devStepOverride, setDevStepOverride] = useState<number | null>(null);
  const [devPaymentStep, setDevPaymentStep] = useState<OnboardingStep | null>(null);
  const [devDemoLoaded, setDevDemoLoaded] = useState(false);

  const currentStep =
    devStepOverride !== null
      ? devStepOverride
      : flowState.step === "REGISTRATION"
        ? 1
        : flowState.step === "ADDONS"
          ? 2
          : flowState.step === "DONE" || flowState.step === "MIGRATION_SCHEDULED"
            ? 4
            : 3;

  // Ya en el pago: lo que se va a cobrar (guardado en el flujo). Antes: la selección en curso.
  const isBeforePayment = flowState.step === "REGISTRATION" || flowState.step === "ADDONS";
  const summary = summarizeSubscription(
    flowState.price,
    addOns,
    isBeforePayment ? selectedAddons : flowState.addOnIds,
    isAnnual,
  );

  const paymentStep = devPaymentStep ?? (isBeforePayment ? "CARD_REDIRECT" : flowState.step);
  const subscription =
    flowState.subscription ??
    (devDemoLoaded && flowState.planId
      ? demoSubscription(
          { id: flowState.planId, name: flowState.planName, price: flowState.price },
          summary.addOns,
          isAnnual,
        )
      : null);
  const completedPlan = flowState.step === "DONE" ? subscription?.plan : null;
  const displayPlanName = completedPlan?.name ?? flowState.planName;
  const displayPrice = completedPlan?.price ?? flowState.price;
  const displayAnnual = completedPlan ? completedPlan.durationInDays >= 300 : isAnnual;

  const loadDevDemo = () => {
    setPlans(DEMO_PLANS);
    setAddOns(DEMO_ADD_ONS);
    setPlansLoading(false);
    setPlansError(null);
    setAddOnsLoading(false);
    setAddOnsError(null);
    if (!flowState.planId) setPlan(DEMO_PLANS.find((p) => p.name === "Medium") ?? DEMO_PLANS[0]);
    setDevDemoLoaded(true);
  };

  const resetDev = () => {
    setDevStepOverride(null);
    setDevPaymentStep(null);
  };

  const handleGoToDashboard = onGoToDashboard ?? (() => router.push("/new-company"));

  // Catálogo y plan se leen con el JWT (el gateway lo exige): recién hay sesión
  // después del registro, o de entrada si viene de /sin-plan.
  const accessToken = auth?.accessToken;
  // biome-ignore lint/correctness/useExhaustiveDependencies: The revision reloads the same catalog after an explicit retry.
  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    setAddOnsLoading(true);
    setAddOnsError(null);
    fetchAddOns(controller.signal)
      .then((catalog) => {
        if (!controller.signal.aborted) setAddOns(catalog);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setAddOns([]);
        setAddOnsError("No pudimos cargar los add-ons.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setAddOnsLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, addOnsRevision]);

  // Catálogo de planes para el paso 2. Si la landing mandó un plan (?plan=Basic),
  // queda preseleccionado con su id y precio reales; si no existe, no se elige nada.
  const hintAppliedRef = useRef(false);
  const latestFlow = useRef(flowState);
  latestFlow.current = flowState;
  // biome-ignore lint/correctness/useExhaustiveDependencies: The revision reloads the same catalog after an explicit retry.
  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    setPlansLoading(true);
    setPlansError(null);
    fetchPlans(controller.signal)
      .then((catalog) => {
        if (controller.signal.aborted) return;
        setPlans(catalog);
        if (hintAppliedRef.current) return;
        hintAppliedRef.current = true;
        const current = latestFlow.current;
        if (current.planId || (current.step !== "ADDONS" && current.step !== "REGISTRATION"))
          return;
        const hint = planName.toLowerCase();
        const match = hint && catalog.find((p) => p.name.toLowerCase() === hint);
        if (match) setPlan(match);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setPlansError("No pudimos cargar los planes. Intenta nuevamente.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setPlansLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, planName, setPlan, plansRevision]);

  // Migración (FEAT-25): sus add-ons de hoy vienen marcados, una sola vez y si no eligió otros.
  const addOnHintAppliedRef = useRef(false);
  useEffect(() => {
    if (!isMigration || addOnHintAppliedRef.current || addOns.length === 0 || !initialAddOnCodes?.length) return;
    addOnHintAppliedRef.current = true;
    if (latestFlow.current.step !== "ADDONS") return;
    const ids = addOns.filter((a) => initialAddOnCodes.includes(a.code)).map((a) => a.id);
    setSelectedAddons((prev) => (prev.length > 0 ? prev : ids));
  }, [addOns, initialAddOnCodes, isMigration]);

  const firstChargeNotice = isMigration
    ? (() => {
        const period = isAnnual ? "año" : "mes";
        const date = firstChargePreview(paidUntil, limaToday());
        return date
          ? `Hoy no te cobramos nada. Tu primer cobro será el ${formatLimaDate(date)}: S/ ${summary.total}/${period}. Hasta entonces sigues con tu plan actual.`
          : `Se cobra hoy al registrar la tarjeta: S/ ${summary.total}/${period}.`;
      })()
    : null;

  const handleCycleChange = (annual: boolean) => {
    setAnnualView(annual);
    if (!flowState.planName || isAnnualPlanName(flowState.planName) === annual) return;
    setPlan(counterpartPlan(plans, flowState.planName, annual) ?? { id: "", name: "", price: 0 });
  };

  const handleStep1Next = async (data: RegisterData) => {
    await register(data);
  };
  const handleStep2Next = () => {
    if (!flowState.planId) return;
    resetDev();
    selectAddOns(selectedAddons);
  };
  const handleSkipAddOns = () => {
    if (!flowState.planId) return;
    resetDev();
    setSelectedAddons([]);
    selectAddOns([]);
  };

  const handleGoBack = () => {
    resetDev();
    setSelectedAddons(flowState.addOnIds);
    goBack();
  };

  const toggleAddon = (id: string) => {
    setSelectedAddons((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  };

  const devPanel = isDev ? (
    <OnboardingDevPanel
      currentStep={currentStep}
      isOverriding={devStepOverride !== null || devPaymentStep !== null}
      paymentStep={paymentStep}
      demoLoaded={devDemoLoaded}
      onStep={(step) => {
        setDevStepOverride(step);
        setDevPaymentStep(null);
      }}
      onPaymentStep={(step) => {
        setDevStepOverride(3);
        setDevPaymentStep(step);
      }}
      onLoadDemo={loadDevDemo}
      onReset={resetDev}
    />
  ) : null;

  const pageRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const screenKey = `${currentStep}:${paymentStep}`;
  const previousScreenRef = useRef<string | null>(null);
  useEffect(() => {
    const page = pageRef.current;
    if (!page || previousScreenRef.current === screenKey) return;
    previousScreenRef.current = screenKey;
    const scroller = page.closest("main");
    if (typeof scroller?.scrollTo === "function") scroller.scrollTo({ top: 0, left: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [screenKey]);

  if (isMigration && flowState.step === "EXISTING_SUBSCRIPTION") {
    // Con migrate solo da ALREADY_SUBSCRIBED quien ya tiene Flow vigente.
    return (
      <AuthLayout>
        <div className={`${styles.stepCard} space-y-4 text-center`}>
          <p className="text-lg font-semibold text-gray-900">Ya estás en Flow.</p>
          <button
            type="button"
            onClick={handleGoToDashboard}
            className="text-sm font-medium text-[#4F3A96] underline"
          >
            Ir a Powip
          </button>
        </div>
      </AuthLayout>
    );
  }

  if (flowState.step === "EXISTING_SUBSCRIPTION" && flowState.subscription) {
    return (
      <AuthLayout>
        <div className={styles.stepCard}>
          <ExistingSubscriptionNotice
            subscription={flowState.subscription}
            continueHref={auth?.company || auth?.user?.companyId ? "/" : "/new-company"}
            refreshSession={refreshSession}
          />
        </div>
      </AuthLayout>
    );
  }

  if (currentStep === 1 && !initialAuth) {
    return (
      <>
        <AuthLayout>
          <AuthPanel
            registration={
              <RegisterForm
                isLoading={flowState.isLoading}
                error={flowState.error}
                onNext={handleStep1Next}
              />
            }
          />
        </AuthLayout>
        {devPanel}
      </>
    );
  }

  return (
    <div ref={pageRef} className={styles.page} data-onboarding-layout="subscription">
      <header className={styles.mobileHeader}>
        <Link
          href={isMigration ? "/" : "https://powip.lat"}
          className={styles.back}
          aria-label="Volver a la página principal"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <Image
          src="/logo-powip-text.svg"
          alt="Powip"
          width={150}
          height={48}
          className={styles.mobileLogo}
        />
      </header>
      <div className={styles.layout}>
        <BrandPanel
          currentStep={currentStep}
          planName={displayPlanName}
          price={displayPrice}
          isAnnual={displayAnnual}
          summary={summary}
        />
        <div className={styles.content}>
          <header className={styles.flowHeader}>
            <h1 ref={headingRef} tabIndex={-1} className={styles.heading}>
              {isMigration ? "Pasate a Flow" : "Configura tu cuenta"}
            </h1>
            {blocked && (
              <p role="alert" className="text-sm font-medium text-red-700">
                Tu acceso a Powip está suspendido. Registra tu tarjeta para volver a usarlo.
              </p>
            )}
            <p className={styles.stepCaption}>
              {currentStep === 3
                ? summaryLabel(flowState.planName, summary, isAnnual)
                : planLabel(displayPlanName, displayPrice, displayAnnual)}
            </p>
            <OnboardingProgress currentStep={currentStep} steps={isMigration ? MIGRATION_STEPS : STEPS} />
          </header>
          <div className={styles.stepCard}>
            {currentStep === 2 && (
              <Step2
                plans={plans}
                planId={flowState.planId}
                onSelectPlan={setPlan}
                onCycleChange={handleCycleChange}
                onEnterprise={() => setEnterpriseOpen(true)}
                price={flowState.price}
                isAnnual={isAnnual}
                selectedAddons={selectedAddons}
                onToggleAddon={toggleAddon}
                onNext={handleStep2Next}
                onSkipAddOns={handleSkipAddOns}
                plansLoading={plansLoading}
                plansError={plansError}
                onRetryPlans={() => setPlansRevision((revision) => revision + 1)}
                addOnsLoading={addOnsLoading}
                addOnsError={addOnsError}
                onRetryAddOns={() => setAddOnsRevision((revision) => revision + 1)}
                addOns={addOns}
                summary={summary}
              />
            )}

            {currentStep === 3 && (
              <Step3
                planName={flowState.planName}
                price={flowState.price}
                isAnnual={isAnnual}
                summary={summary}
                isLoading={flowState.isLoading}
                step={paymentStep}
                error={flowState.error}
                cardToken={flowState.cardToken}
                redirectUrl={flowState.redirectUrl}
                onBack={handleGoBack}
                onInitiate={initiateCardRegistration}
                onSubscribe={confirmPayment}
                onCheckAgain={checkPaymentAgain}
                onRetry={retry}
                onError={setError}
                firstChargeNotice={firstChargeNotice}
              />
            )}

            {isMigration && currentStep === 4 && (
              <MigrationScheduledSuccess
                firstChargeDate={flowState.step === "MIGRATION_SCHEDULED" ? (flowState.firstChargeDate ?? null) : null}
                onGoToDashboard={handleGoToDashboard}
              />
            )}

            {!isMigration && (currentStep === 4 || flowState.step === "DONE") && (
              <StepSuccess
                planName={flowState.planName}
                price={flowState.price}
                isAnnual={isAnnual}
                subscription={subscription}
                onGoToDashboard={handleGoToDashboard}
              />
            )}
          </div>
        </div>
      </div>
      <EnterpriseContactModal open={enterpriseOpen} onClose={() => setEnterpriseOpen(false)} />
      {devPanel}
    </div>
  );
}
