"use client";
import Link from "next/link";
import { Lock, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CrmAccess } from "@/services/crmPlanService";

/** Texto de cada motivo de bloqueo. Sin respuesta del servidor se trata como «no pudimos confirmar». */
function copyFor(access: CrmAccess | undefined): { title: string; body: string; pay: boolean } {
  switch (access?.reason) {
    case "not_paid":
      return {
        title: "Activa Ventas por chat",
        body: "El CRM se activa cuando se confirma el pago. Elige CRM o CRM + Pau en Mi plan.",
        pay: true,
      };
    case "email":
      return {
        title: "Ventas por chat aún no está disponible para tu cuenta",
        body: "Por ahora solo algunas cuentas lo usan. Te avisaremos cuando se abra para tu empresa.",
        pay: false,
      };
    case "email_unverified":
      return {
        title: "Confirma tu correo",
        body: "Para entrar al CRM tu correo tiene que estar confirmado. Revisa tu bandeja y vuelve a entrar.",
        pay: false,
      };
    case "role":
    case "no_company":
      return {
        title: "No tienes acceso a Ventas por chat",
        body: "Pídele a quien administra tu empresa que te dé acceso.",
        pay: false,
      };
    default:
      return {
        title: "No pudimos confirmar tu plan",
        body: "Vuelve a intentar en unos minutos. Si ya pagaste, tu acceso no se pierde.",
        pay: false,
      };
  }
}

/** Pantalla de bloqueo del CRM: lleva a Mi plan cuando falta el pago. */
export function CrmPaywall({ access, loading }: { access?: CrmAccess; loading?: boolean }) {
  if (loading) {
    return (
      <p role="status" className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Revisando tu plan…
      </p>
    );
  }
  const copy = copyFor(access);
  return (
    <div className="flex justify-center p-6 md:p-10" data-testid="crm-paywall" data-reason={access?.reason ?? "unavailable"}>
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 text-center">
        <Lock className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
        <h1 className="text-lg font-semibold">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.body}</p>
        {copy.pay && (
          <Button asChild>
            <Link href="/configuracion/plan">Ver planes y pagar</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

/** Pestaña de Pau sin Pau pagado: el CRM sigue, Pau se agrega desde Mi plan. */
export function PauPaywall() {
  return (
    <div className="flex justify-center p-6 md:p-10" data-testid="pau-paywall">
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
        <h2 className="text-lg font-semibold">Pau no está en tu plan</h2>
        <p className="text-sm text-muted-foreground">
          Tu plan es solo CRM. Agrega Pau en Mi plan y se activa cuando se confirma el pago.
        </p>
        <Button asChild>
          <Link href="/configuracion/plan">Agregar Pau</Link>
        </Button>
      </div>
    </div>
  );
}
