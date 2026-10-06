"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import {
  Check,
  Zap,
  ArrowRight,
  ArrowLeft,
  Lock,
  Shield,
  Users,
  CreditCard,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingFlow, type RegisterData } from "@/hooks/useOnboardingFlow";
import { fetchAddOns, fetchPlans } from "@/services/onboardingService";
import PlanPicker from "@/components/onboarding/PlanPicker";
import EnterpriseContactModal from "@/components/modals/EnterpriseContactModal";
import { basePlanName, counterpartPlan, isAnnualPlanName } from "@/lib/onboardingPlan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import FlowWidgetStep from "@/components/onboarding/FlowWidgetStep";
import {
  addOnPrice,
  summarizeSubscription,
  type BackendAddOn,
  type BackendPlan,
  type OnboardingStep,
  type SubscriptionMe,
  type SubscriptionSummary,
} from "@/types/onboarding";
import {
  DEMO_ADD_ONS,
  DEMO_PLANS,
  OnboardingDevPanel,
  demoSubscription,
} from "./_components/OnboardingDevPanel";
import Image from "next/image";
import { toast } from "sonner";

interface OnboardingClientProps {
  /** Plan preseleccionado (desde la landing o /sin-plan); se cambia en el paso 2. */
  planId?: string;
  planName?: string;
  price?: number;
  /** Usuario ya logueado (viene de /sin-plan): se saltea el registro. */
  initialAuth?: { userId: string };
  onGoToDashboard?: () => void;
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

const BRAND_PANEL_CONTENT: Record<number, { headline: string; sub: string; mascot: string }> = {
  1: {
    headline: "Bienvenido a Powip",
    sub: "Crea tu cuenta en segundos y accede inmediatamente a todas las herramientas de tu plan.",
    mascot: "/mascota-saludando.svg",
  },
  2: {
    headline: "Elige tu plan",
    sub: "Elige el plan que mejor se adapta a tu negocio y sumá los add-ons que necesites. Podés activar más add-ons después.",
    mascot: "/mascota-idea.svg",
  },
  3: {
    headline: "¡Casi listo!",
    sub: "Revisa tu suscripción y activa tu cuenta. Tu primer mes comienza hoy.",
    mascot: "/mascota-pc-2.svg",
  },
  4: {
    headline: "¡Todo listo!",
    sub: "Tu cuenta está activa. Ahora podés configurar tu empresa y empezar a gestionar tus pedidos.",
    mascot: "/mascota-silla.svg",
  },
};

const TRUST_SIGNALS = [
  { icon: Shield, text: "Pago 100% seguro" },
  { icon: Zap, text: "Acceso inmediato al activar" },
  { icon: Users, text: "+1,200 negocios confían en Powip" },
];

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

function BrandPanel({
  currentStep,
  planName,
  price,
  isAnnual,
  summary,
}: BrandPanelProps) {
  const content = BRAND_PANEL_CONTENT[currentStep] ?? BRAND_PANEL_CONTENT[1];
  const period = isAnnual ? "año" : "mes";
  const showSummary = currentStep === 3 && planName !== "";

  return (
    <div
      className="relative h-screen flex flex-col justify-between px-10 py-12 overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, #3d2d78 0%, #4F3A96 55%, #6a4fc4 100%)",
      }}
    >
      {/* Decorative circles */}
      <div
        className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-10"
        style={{ background: "rgba(255,255,255,0.3)" }}
      />
      <div
        className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full opacity-10"
        style={{ background: "rgba(255,255,255,0.2)" }}
      />

      {/* Logo */}
      <div className="flex justify-start items-center w-full z-10">
        <Image
          src="/logo-powip-text.svg"
          alt="Logo Powip"
          width={320}
          height={100}
          priority
          className="w-auto h-10 brightness-0 invert"
        />
      </div>

      {/* Main content */}
      <div className="mt-12 flex-1 flex flex-col justify-start gap-8 z-10">
        <div>
          <h2 className="text-white font-black text-4xl leading-tight mb-4">
            {content.headline}
          </h2>
          <p className="text-white/70 text-base leading-relaxed max-w-md">
            {content.sub}
          </p>
        </div>

        {showSummary ? (
          /* Resumen del pedido (paso Pago): mismo cálculo que el resumen principal */
          <section
            aria-label="Resumen de tu suscripción"
            className="w-full max-w-sm rounded-2xl px-5 py-4 backdrop-blur-sm"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-white/90 font-medium">Plan {basePlanName(planName)}</dt>
                <dd className="text-white font-semibold whitespace-nowrap">
                  S/ {price}/{period}
                </dd>
              </div>
              {summary.addOns.map(({ addOn, price: addOnAmount }) => {
                const { name, icon } = addOnDisplay(addOn);
                return (
                  <div key={addOn.id} className="flex items-center justify-between gap-4">
                    <dt className="text-white/75">
                      <span aria-hidden="true">{icon}</span> {name}
                    </dt>
                    <dd className="text-white/90 whitespace-nowrap">
                      +S/ {addOnAmount}/{period}
                    </dd>
                  </div>
                );
              })}
              <div
                className="flex items-center justify-between gap-4 pt-2 mt-1"
                style={{ borderTop: "1px solid rgba(255,255,255,0.2)" }}
              >
                <dt className="text-white font-bold">Total {period === "año" ? "anual" : "mensual"}</dt>
                <dd className="text-white font-black text-lg whitespace-nowrap">
                  S/ {summary.total}/{period}
                </dd>
              </div>
            </dl>
          </section>
        ) : (
          /* Plan badge */
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full self-start"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            <div className="w-2 h-2 rounded-full bg-white/80" />
            <span className="text-white/90 text-sm font-medium">
              {planLabel(planName, price, isAnnual)}
            </span>
          </div>
        )}

        {/* Trust signals */}
        <div className="flex flex-col gap-3">
          {TRUST_SIGNALS.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-white/80" />
              </div>
              <span className="text-white/75 text-sm">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mascot */}
      <Image
        src={content.mascot}
        alt=""
        aria-hidden="true"
        width={800}
        height={800}
        priority
        className="absolute -bottom-[80px] right-0 w-[500px] h-auto pointer-events-none select-none"
      />

      {/* Step dots */}
      <div className="flex items-center gap-2 z-10">
        {STEPS.map((step) => {
          const isActive = step.num === currentStep;
          return (
            <div
              key={step.num}
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: isActive ? 24 : 8,
                background: isActive ? "white" : "rgba(255,255,255,0.3)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OnboardingProgress
// ---------------------------------------------------------------------------

function OnboardingProgress({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, idx) => {
        const isCompleted = step.num < currentStep;
        const isCurrent = step.num === currentStep;

        return (
          <div
            key={step.num}
            className="flex items-center flex-1 last:flex-none"
          >
            {/* Step circle */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300"
                style={{
                  background: isCompleted
                    ? "#e9f5f3"
                    : isCurrent
                      ? "#4F3A96"
                      : "#f3f4f6",
                  color: isCompleted
                    ? "#008a7b"
                    : isCurrent
                      ? "white"
                      : "#9ca3af",
                  boxShadow: isCurrent
                    ? "0 0 0 4px rgba(79,58,150,0.12)"
                    : "none",
                }}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : step.num}
              </div>
              <span
                className="text-xs font-medium whitespace-nowrap"
                style={{
                  color: isCompleted
                    ? "#008a7b"
                    : isCurrent
                      ? "#4F3A96"
                      : "#9ca3af",
                }}
              >
                {step.name}
              </span>
            </div>

            {/* Connector */}
            {idx < STEPS.length - 1 && (
              <div
                className="flex-1 h-0.5 mb-5 mx-1 transition-all duration-300"
                style={{
                  background:
                    step.num < currentStep
                      ? "linear-gradient(90deg, #008a7b, #4F3A96)"
                      : "#e5e7eb",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step1
// ---------------------------------------------------------------------------

type AccountFormValues = RegisterData;

interface Step1Props {
  isLoading: boolean;
  error: string | null;
  onNext: (data: AccountFormValues) => Promise<void>;
}

function Step1({ isLoading, error, onNext }: Step1Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AccountFormValues>();

  return (
    <form onSubmit={handleSubmit(onNext)} className="flex flex-col gap-4">
      {/* Header */}
      <div className="mb-1">
        <h3 className="font-bold text-xl text-gray-900">Crea tu cuenta</h3>
        <p className="text-sm text-gray-500 mt-1">
          Completa los datos para empezar. Solo toma 1 minuto.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Label htmlFor="name">
            Nombre <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Juan"
            className="mt-1.5"
            {...register("name", {
              required: "Requerido",
              minLength: { value: 2, message: "Mínimo 2 caracteres" },
            })}
          />
          {errors.name && (
            <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
          )}
        </div>
        <div className="flex-1">
          <Label htmlFor="surname">
            Apellido <span className="text-red-500">*</span>
          </Label>
          <Input
            id="surname"
            placeholder="Pérez"
            className="mt-1.5"
            {...register("surname", {
              required: "Requerido",
              minLength: { value: 2, message: "Mínimo 2 caracteres" },
            })}
          />
          {errors.surname && (
            <p className="text-xs text-red-500 mt-1">
              {errors.surname.message}
            </p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="email">
          Email <span className="text-red-500">*</span>
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="tu@negocio.com"
          className="mt-1.5"
          {...register("email", {
            required: "Requerido",
            pattern: { value: /\S+@\S+\.\S+/, message: "Email inválido" },
          })}
        />
        {errors.email && (
          <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Label htmlFor="password">
            Contraseña <span className="text-red-500">*</span>
          </Label>
          <div className="relative mt-1.5">
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              className="pr-10"
              {...register("password", {
                required: "Requerido",
                minLength: { value: 6, message: "Mínimo 6 caracteres" },
                pattern: {
                  value: /(?=.*[a-z])(?=.*\d)/,
                  message: "Debe tener una letra minúscula y un número",
                },
              })}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <Lock className="w-4 h-4" />
            </span>
          </div>
          {errors.password && (
            <p className="text-xs text-red-500 mt-1">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="flex-1">
          <Label htmlFor="phone">
            WhatsApp <span className="text-red-500">*</span>
          </Label>
          <div className="flex mt-1.5">
            <div className="bg-gray-50 border border-gray-300 border-r-0 px-3 py-1 rounded-l-xl text-gray-500 text-sm flex items-center whitespace-nowrap">
              🇵🇪 +51
            </div>
            <Input
              id="phone"
              type="tel"
              placeholder="987 654 321"
              className="rounded-l-none"
              {...register("phone", {
                required: "Requerido",
                minLength: { value: 9, message: "Mínimo 9 dígitos" },
                maxLength: { value: 9, message: "Máximo 9 dígitos" },
                pattern: { value: /^\d+$/, message: "Solo números" },
              })}
            />
          </div>
          {errors.phone && (
            <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>
          )}
        </div>
      </div>

      {/* Datos que exige ms-auth (RegisterRequest): documento, dirección y distrito */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Label htmlFor="identityDocument">
            DNI / RUC <span className="text-red-500">*</span>
          </Label>
          <Input
            id="identityDocument"
            inputMode="numeric"
            placeholder="12345678"
            className="mt-1.5"
            {...register("identityDocument", {
              required: "Requerido",
              pattern: { value: /^(\d{8}|\d{11})$/, message: "DNI (8 dígitos) o RUC (11 dígitos)" },
            })}
          />
          {errors.identityDocument && (
            <p className="text-xs text-red-500 mt-1">{errors.identityDocument.message}</p>
          )}
        </div>
        <div className="flex-1">
          <Label htmlFor="district">
            Distrito <span className="text-red-500">*</span>
          </Label>
          <Input
            id="district"
            placeholder="Miraflores"
            className="mt-1.5"
            {...register("district", { required: "Requerido" })}
          />
          {errors.district && (
            <p className="text-xs text-red-500 mt-1">{errors.district.message}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="address">
          Dirección <span className="text-red-500">*</span>
        </Label>
        <Input
          id="address"
          placeholder="Av. Larco 123"
          className="mt-1.5"
          {...register("address", {
            required: "Requerido",
            minLength: { value: 5, message: "Mínimo 5 caracteres" },
          })}
        />
        {errors.address && (
          <p className="text-xs text-red-500 mt-1">{errors.address.message}</p>
        )}
      </div>

      {/* Trust banner */}
      <div
        className="rounded-xl p-4 flex items-center gap-3 mt-1 text-sm"
        style={{
          background: "#f0fdf9",
          border: "1px solid #a7f3d0",
          color: "#047857",
        }}
      >
        <Lock className="w-4 h-4 shrink-0" />
        <p>
          <strong>Acceso inmediato</strong> al activar tu plan. Configura tu
          empresa dentro de Powip.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-500 text-center bg-red-50 rounded-xl p-3">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full h-12 text-base rounded-xl font-semibold text-white flex items-center justify-center gap-2 mt-2 transition-opacity disabled:opacity-70"
        style={{ background: "#4F3A96" }}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Creando cuenta...
          </>
        ) : (
          <>
            Continuar
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
        <Lock className="w-3 h-3" /> SSL · Datos protegidos
      </p>
    </form>
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
  addOns,
  summary,
}: Step2Props) {
  const hasPlan = planId !== "";
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
      />

      {/* Header */}
      <div className="mb-1 mt-2">
        <h3 className="font-bold text-xl text-gray-900">Add-ons opcionales</h3>
        <p className="text-sm text-gray-500 mt-1">
          {addOns.length > 0
            ? `${samePrice ? "" : "Desde "}S/ ${minAddOnPrice}/${period} cada uno`
            : "Opcionales"} — actívalos ahora o después desde{" "}
          <strong className="text-gray-700">Configuración</strong>.
        </p>
      </div>

      {/* Add-on grid */}
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
              <h4 className="font-bold text-gray-900 text-sm leading-tight">
                {config.name}
              </h4>
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
              <div
                className="font-bold text-sm mt-3"
                style={{ color: "#4F3A96" }}
              >
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
          disabled={!hasPlan}
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
          onClick={onNext}
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
        <h3 className="font-bold text-xl text-gray-900">
          Resumen de tu suscripción
        </h3>
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
          <span className="font-semibold text-gray-800 text-sm">
            Plan {planName}
          </span>
          <span className="font-bold text-sm" style={{ color: "#4F3A96" }}>
            S/ {price}/{period}
          </span>
        </div>

        {/* Add-on rows */}
        {summary.addOns.map(({ addOn: addon, price: addOnAmount }) => {
          const { name, icon } = addOnDisplay(addon);
          return (
            <div
              key={addon.id}
              className="flex items-center justify-between mb-2"
            >
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
        <CheckCircle2
          className="w-5 h-5 shrink-0 mt-0.5"
          style={{ color: "#008a7b" }}
        />
        <div className="text-sm" style={{ color: "#065f46" }}>
          <p className="font-semibold">Qué incluye tu plan</p>
          <p
            className="mt-1 text-xs leading-relaxed"
            style={{ color: "#047857" }}
          >
            Acceso inmediato al activar — todas las herramientas del plan{" "}
            {planName} disponibles desde el primer día.
          </p>
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
            Registrarás tu tarjeta de débito o crédito directamente en Flow.
            Powip no almacena datos de tu tarjeta.
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
      link.href =
        "https://calendar.google.com/calendar/scheduling-button-script.css";
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
      script.src =
        "https://calendar.google.com/calendar/scheduling-button-script.js";
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
          <p className="text-sm text-gray-500 mt-1">
            Tu plan está activo. Bienvenido a Powip.
          </p>
        </div>
      </div>

      {/* Receipt ticket */}
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 overflow-hidden">
        {/* Ticket header */}
        <div
          className="px-5 py-3 flex items-center gap-2"
          style={{ background: "#f5f2ff" }}
        >
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
                <span className="text-sm text-gray-600">Plan {planName}</span>
                <span
                  className="text-sm font-bold"
                  style={{ color: "#4F3A96" }}
                >
                  S/ {price}/{isAnnual ? "año" : "mes"}
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
                  {isPaid ? "Pagado" : "Pendiente"}
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
              Agendá una reunión de onboarding gratuita — un especialista te
              guiará por las funciones clave de tu plan.
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
}: OnboardingClientProps) {
  const { auth, login, refreshSession } = useAuth();
  const router = useRouter();
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [addOns, setAddOns] = useState<BackendAddOn[]>([]);
  const [plans, setPlans] = useState<BackendPlan[]>([]);
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
  } = useOnboardingFlow(
    { planId, planName, price, initialUserId: initialAuth?.userId ?? null },
    login,
    // Al pagar, ms-subscription pasa al usuario a ADMINISTRADOR en ms-auth: hace
    // falta un token nuevo con ese rol (y la suscripción ACTIVE en el contexto).
    async () => {
      await refreshSession();
    },
  );

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
          : flowState.step === "DONE"
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

  const loadDevDemo = () => {
    setPlans(DEMO_PLANS);
    setAddOns(DEMO_ADD_ONS);
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
  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    fetchAddOns(controller.signal)
      .then(setAddOns)
      .catch((err: unknown) => {
        if ((err as { code?: string })?.code === "ERR_CANCELED") return;
        toast.error("No pudimos cargar los add-ons. Podés continuar sin ellos.");
      });
    return () => controller.abort();
  }, [accessToken]);

  // Catálogo de planes para el paso 2. Si la landing mandó un plan (?plan=Basic),
  // queda preseleccionado con su id y precio reales; si no existe, no se elige nada.
  const hintAppliedRef = useRef(false);
  useEffect(() => {
    if (!accessToken) return;
    fetchPlans()
      .then((catalog) => {
        setPlans(catalog);
        if (hintAppliedRef.current) return;
        hintAppliedRef.current = true;
        const hint = planName.toLowerCase();
        const match = hint && catalog.find((p) => p.name.toLowerCase() === hint);
        if (match) setPlan(match);
      })
      .catch(() => setError("No pudimos cargar los planes. Intentá nuevamente."));
  }, [accessToken, planName, setPlan, setError]);

  const handleCycleChange = (annual: boolean) => {
    setAnnualView(annual);
    if (!flowState.planName || isAnnualPlanName(flowState.planName) === annual) return;
    setPlan(counterpartPlan(plans, flowState.planName, annual) ?? { id: "", name: "", price: 0 });
  };

  const handleStep1Next = async (data: AccountFormValues) => {
    await register(data);
  };
  const handleStep2Next = () => {
    if (!flowState.planId) return;
    resetDev();
    selectAddOns(selectedAddons);
  };

  const handleGoBack = () => {
    resetDev();
    setSelectedAddons(flowState.addOnIds);
    goBack();
  };

  const toggleAddon = (id: string) => {
    setSelectedAddons((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  return (
    <div
      className="min-h-screen lg:h-screen flex flex-col lg:overflow-hidden"
      style={{ background: "#f7f5ff" }}
    >
      {/* Mobile header */}
      <div
        className="lg:hidden flex items-center gap-3 px-5 py-4"
        style={{ background: "#4F3A96" }}
      >
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
          <span className="text-white font-black text-sm">P</span>
        </div>
        <span className="text-white font-black tracking-widest text-base">
          POWIP
        </span>
        <div className="ml-auto min-w-0 truncate text-white/70 text-xs">
          {currentStep === 3
            ? summaryLabel(flowState.planName, summary, isAnnual)
            : planLabel(flowState.planName, flowState.price, isAnnual)}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 flex-1 lg:overflow-hidden">
        {/* Brand panel — desktop only */}
        <div className="hidden lg:block">
          <BrandPanel
            currentStep={currentStep}
            planName={flowState.planName}
            price={flowState.price}
            isAnnual={isAnnual}
            summary={summary}
          />
        </div>

        {/* Content panel */}
        <div className="flex flex-col items-center justify-start lg:justify-center px-5 py-8 lg:py-12 overflow-y-auto lg:h-full lg:min-h-0">
          <div className="w-full max-w-3xl">
            {/* Plan pill — desktop only */}
            <div
              className="hidden lg:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium mb-6"
              style={{ background: "#ede9ff", color: "#4F3A96" }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: "#4F3A96" }}
              />
              {planLabel(flowState.planName, flowState.price, isAnnual)}
            </div>

            {/* Progress */}
            <div className="mb-8">
              <OnboardingProgress currentStep={currentStep} />
            </div>

            {/* Step content card */}
            <div
              className="p-6 sm:p-8"
              style={{ borderColor: "rgba(79,58,150,0.08)" }}
            >
              {currentStep === 1 && !initialAuth && (
                <Step1
                  isLoading={flowState.isLoading}
                  error={flowState.error}
                  onNext={handleStep1Next}
                />
              )}

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
                />
              )}

              {(currentStep === 4 || flowState.step === "DONE") && (
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
      </div>
      <EnterpriseContactModal open={enterpriseOpen} onClose={() => setEnterpriseOpen(false)} />

      {isDev && (
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
      )}
    </div>
  );
}
