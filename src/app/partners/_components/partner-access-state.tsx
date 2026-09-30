"use client";

import { Ban, Clock, Lock, type LucideIcon, ShieldAlert, UserX } from "lucide-react";
import Link from "next/link";
import { PartnerSectionError } from "@/components/partners/partner-section-error";
import { PowipPulseLoader } from "@/components/shared/PowipPulseLoader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PartnerAccess } from "@/features/partners/utils/partner-access";

export type PartnerAccessStateValue =
  | Exclude<PartnerAccess, { kind: "active" }>
  | { kind: "forbidden_section" };

interface PartnerAccessStateProps {
  state: PartnerAccessStateValue;
  onRetry?: () => void;
}

interface NoticeContent {
  icon: LucideIcon;
  title: string;
  description: string;
}

const INACTIVE_CONTENT: Record<
  Extract<PartnerAccess, { kind: "inactive" }>["status"],
  NoticeContent
> = {
  pending: {
    icon: Clock,
    title: "Tu solicitud de partner está en revisión",
    description: "Vas a poder usar el portal cuando tu cuenta de partner quede activa.",
  },
  rejected: {
    icon: UserX,
    title: "Tu solicitud de partner no fue aprobada",
    description: "Esta cuenta no tiene acceso al portal de partners.",
  },
  unknown: {
    icon: ShieldAlert,
    title: "Tu cuenta de partner no está activa",
    description: "Por ahora no podés usar el portal de partners con esta cuenta.",
  },
};

function AccessNotice({ icon: Icon, title, description }: NoticeContent) {
  return (
    <Card role="status" className="mx-auto max-w-lg rounded-2xl">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button asChild size="sm" variant="outline" className="rounded-xl">
          <Link href="/dashboard">Ir al Dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function PartnerAccessState({ state, onRetry }: PartnerAccessStateProps) {
  switch (state.kind) {
    case "loading":
      return (
        <div role="status" aria-live="polite">
          <PowipPulseLoader label="Verificando tu cuenta de partner…" />
        </div>
      );
    case "error":
      return (
        <div className="mx-auto max-w-lg space-y-2">
          <PartnerSectionError
            message="No pudimos verificar tu cuenta de partner. Revisá tu conexión e intentá de nuevo."
            onRetry={() => onRetry?.()}
          />
          {state.correlationId && (
            <p className="text-center text-xs text-muted-foreground">
              Código de referencia: {state.correlationId}
            </p>
          )}
        </div>
      );
    case "unauthorized":
      return (
        <div className="mx-auto max-w-lg">
          <PartnerSectionError
            message="No pudimos validar tu sesión para el programa de partners."
            onRetry={() => onRetry?.()}
          />
        </div>
      );
    case "no_profile":
      return (
        <AccessNotice
          icon={UserX}
          title="Esta cuenta no tiene un perfil de partner"
          description="El portal de partners está disponible solo para partners aprobados de Powip."
        />
      );
    case "suspended":
      return (
        <AccessNotice
          icon={Ban}
          title="Tu cuenta de partner está suspendida"
          description="Mientras la suspensión esté vigente no podés usar el portal. Contactá al equipo de Powip para más información."
        />
      );
    case "inactive":
      return <AccessNotice {...INACTIVE_CONTENT[state.status]} />;
    case "forbidden_section":
      return (
        <AccessNotice
          icon={Lock}
          title="No tenés acceso a esta sección"
          description="Tu perfil de partner no incluye permiso para ver esta información."
        />
      );
  }
}
