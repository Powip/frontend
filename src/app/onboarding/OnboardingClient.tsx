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
import { useOnboardingFlow } from "@/hooks/useOnboardingFlow";
import { GATEWAY } from "@/lib/gateway";
import axiosAuth from "@/lib/axiosAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import FlowWidgetStep from "@/components/onboarding/FlowWidgetStep";
import type { BackendAddOn, Invoice } from "@/types/onboarding";
import Image from "next/image";
import { toast } from "sonner";

interface OnboardingClientProps {
  planId: string;
  planName: string;
  price: number;
  isAnnual: boolean;
  initialAuth?: { accessToken: string; userId: string };
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
  { num: 2, name: "Add-ons" },
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
    headline: "Potencia tu plan",
    sub: "Los add-ons se integran perfectamente con tu plan base. Actívalos ahora o cuando los necesites.",
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

interface BrandPanelProps {
  currentStep: number;
  planName: string;
  price: number;
  isAnnual: boolean;
}

function BrandPanel({
  currentStep,
  planName,
  price,
  isAnnual,
}: BrandPanelProps) {
  const content = BRAND_PANEL_CONTENT[currentStep] ?? BRAND_PANEL_CONTENT[1];

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

        {/* Plan badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full self-start"
          style={{ background: "rgba(255,255,255,0.12)" }}
        >
          <div className="w-2 h-2 rounded-full bg-white/80" />
          <span className="text-white/90 text-sm font-medium">
            Plan {planName} — S/ {price}
            {isAnnual ? "/año" : "/mes"}
          </span>
        </div>

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

interface AccountFormValues {
  name: string;
  surname: string;
  email: string;
  password: string;
  phone: string;
}

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
  price: number;
  isAnnual: boolean;
  selectedAddons: string[];
  onToggleAddon: (id: string) => void;
  onNext: () => void;
  addOns: BackendAddOn[];
}

function Step2({
  price,
  isAnnual,
  selectedAddons,
  onToggleAddon,
  onNext,
  addOns,
}: Step2Props) {
  const addOnsTotal = selectedAddons.reduce((sum, id) => {
    const addon = addOns.find((a) => a.id === id);
    return sum + (addon?.amount ?? 0);
  }, 0);
  const total = price + addOnsTotal;
  const period = isAnnual ? "año" : "mes";

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="mb-1">
        <h3 className="font-bold text-xl text-gray-900">Add-ons opcionales</h3>
        <p className="text-sm text-gray-500 mt-1">
          S/ 29/mes cada uno — actívalos ahora o después desde{" "}
          <strong className="text-gray-700">Configuración</strong>.
        </p>
      </div>

      {/* Add-on grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {addOns.map((addon) => {
          const config = ADDON_MODAL_CONFIG[addon.name.toLowerCase()];
          if (!config) return null;
          const isSelected = selectedAddons.includes(addon.id);
          const isPopular = addon.name.toLowerCase() === "courier";

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
                + S/ {addon.amount}/mes
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
          Total {period}al
          <br />
          <span className="text-xs">
            Plan S/{price}
            {selectedAddons.length > 0 && ` + Add-ons S/${addOnsTotal}`}
          </span>
        </div>
        <div className="font-bold text-xl" style={{ color: "#4F3A96" }}>
          S/ {total}/{period}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 mt-1">
        <button
          type="button"
          onClick={onNext}
          className="w-full h-12 text-base rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-opacity"
          style={{ background: "#4F3A96" }}
        >
          <ArrowRight className="w-4 h-4" />
          {selectedAddons.length > 0
            ? `Continuar con ${selectedAddons.length} add-on${selectedAddons.length > 1 ? "s" : ""}`
            : "Continuar al pago"}
        </button>
        <button
          type="button"
          onClick={onNext}
          className="text-sm text-gray-400 hover:text-gray-600 font-medium py-2 transition-colors"
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
  selectedAddons: string[];
  allAddOns: BackendAddOn[];
  isLoading: boolean;
  showWidget: boolean;
  cardToken: string | null;
  onBack: () => void;
  onInitiate: () => Promise<void>;
  onSubscribe: () => Promise<void>;
  onError: (msg: string) => void;
}

function Step3({
  planName,
  price,
  isAnnual,
  selectedAddons,
  allAddOns,
  isLoading,
  showWidget,
  cardToken,
  onBack,
  onInitiate,
  onSubscribe,
  onError,
}: Step3Props) {
  const selectedFull = allAddOns.filter((a) => selectedAddons.includes(a.id));
  const addOnsTotal = selectedFull.reduce((sum, a) => sum + a.amount, 0);
  const total = price + addOnsTotal;
  const period = isAnnual ? "año" : "mes";

  if (showWidget && cardToken) {
    return (
      <FlowWidgetStep
        token={cardToken}
        onSuccess={onSubscribe}
        onError={onError}
      />
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
        {selectedFull.map((addon) => {
          const config = ADDON_MODAL_CONFIG[addon.name.toLowerCase()];
          return (
            <div
              key={addon.id}
              className="flex items-center justify-between mb-2"
            >
              <span className="text-gray-600 text-sm flex items-center gap-1.5">
                {config?.icon ?? "➕"} {config?.name ?? addon.name}
              </span>
              <span className="font-medium text-sm text-gray-800">
                +S/ {addon.amount}/mes
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
            S/ {total}/{period}
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
          <p className="font-semibold">Pago seguro</p>
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
  invoice: Invoice | null;
  onGoToDashboard: () => void;
}

function StepSuccess({
  planName,
  price,
  isAnnual,
  invoice,
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

  const isPaid = invoice?.status === "PAID";

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
          {invoice ? (
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
                  {formatDate(invoice.periodStart)} →{" "}
                  {formatDate(invoice.periodEnd)}
                </span>
              </div>

              {/* Invoice number */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Factura</span>
                <span className="text-sm text-gray-700">
                  #{invoice.externalInvoiceId}
                </span>
              </div>

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
  planId,
  planName,
  price,
  isAnnual,
  initialAuth,
  onGoToDashboard,
}: OnboardingClientProps) {
  const { auth, login } = useAuth();
  const router = useRouter();
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [addOns, setAddOns] = useState<BackendAddOn[]>([]);

  const {
    state: flowState,
    register,
    selectAddOns,
    initiateCardRegistration,
    subscribe,
    goBack,
    setError,
  } = useOnboardingFlow({ planId, planName, price, isAnnual, initialAuth }, login);

  const [devStepOverride, setDevStepOverride] = useState<number | null>(null);

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

  const handleGoToDashboard = onGoToDashboard ?? (() => router.push("/new-company"));

  useEffect(() => {
    const controller = new AbortController();
    axiosAuth
      .get(`${GATEWAY.subscriptionFlow}/api/v1/add-ons`, { signal: controller.signal })
      .then((r) => {
        if (Array.isArray(r.data)) setAddOns(r.data as BackendAddOn[]);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && (err as { code?: string }).code === "ERR_CANCELED") return;
        toast.error("No pudimos cargar los add-ons. Podés continuar sin ellos.");
      });
    return () => controller.abort();
  }, []);

 useEffect(() => {
 
  console.log("FLOW", flowState.step);
  
  if (
    !initialAuth &&
    auth?.subscription === true &&
    flowState.step !== "DONE"
  ) {
    router.replace("/dashboard");
  }
}, [
  auth?.subscription,
  flowState.step,
  initialAuth,
  router,
]);

  const handleStep1Next = async (data: AccountFormValues) => {
    await register(data);
  };
  const handleStep2Next = () => {
    selectAddOns(selectedAddons);
  };

  const handleGoBack = () => {
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
        <div className="ml-auto text-white/70 text-xs">
          Plan {planName} — S/ {price}/mes
        </div>
      </div>

      <div className="grid lg:grid-cols-2 flex-1 lg:overflow-hidden">
        {/* Brand panel — desktop only */}
        <div className="hidden lg:block">
          <BrandPanel
            currentStep={currentStep}
            planName={planName}
            price={price}
            isAnnual={isAnnual}
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
              Plan {planName} — S/ {price}
              {isAnnual ? "/año" : "/mes"}
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
                  price={price}
                  isAnnual={isAnnual}
                  selectedAddons={selectedAddons}
                  onToggleAddon={toggleAddon}
                  onNext={handleStep2Next}
                  addOns={addOns}
                />
              )}

              {currentStep === 3 && (
                <Step3
                  planName={planName}
                  price={price}
                  isAnnual={isAnnual}
                  selectedAddons={selectedAddons}
                  allAddOns={addOns}
                  isLoading={flowState.isLoading}
                  showWidget={flowState.step === "CARD_WIDGET"}
                  cardToken={flowState.cardToken}
                  onBack={handleGoBack}
                  onInitiate={initiateCardRegistration}
                  onSubscribe={subscribe}
                  onError={setError}
                />
              )}

              {(currentStep === 4 || flowState.step === "DONE") && (
                <StepSuccess
                  planName={planName}
                  price={price}
                  isAnnual={isAnnual}
                  invoice={flowState.invoices?.[0] ?? null}
                  onGoToDashboard={handleGoToDashboard}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Dev Mode Step Selector */}
      {process.env.NODE_ENV === "development" && (
        <div className="fixed bottom-4 left-4 z-50 bg-white/95 backdrop-blur-md border border-purple-200 p-3 rounded-2xl shadow-lg flex items-center gap-2">
          <span className="text-xs font-bold text-purple-900 mr-1">DEV MODE:</span>
          {[1, 2, 3, 4].map((stepNum) => (
            <button
              key={stepNum}
              onClick={() => setDevStepOverride(stepNum)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              style={{
                background: currentStep === stepNum ? "#4F3A96" : "#ede9ff",
                color: currentStep === stepNum ? "white" : "#4F3A96",
              }}
            >
              Step {stepNum}
            </button>
          ))}
          {devStepOverride !== null && (
            <button
              onClick={() => setDevStepOverride(null)}
              className="px-2 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
}
