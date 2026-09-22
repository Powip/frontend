import type { ReferralStatus } from "../models/referral-status.enum";

export type ReferralTimelineStepState = "done" | "active" | "pending" | "bad";

export interface ReferralTimelineStep {
  label: string;
  description: string;
  state: ReferralTimelineStepState;
}

const STEPS: { label: string; description: string }[] = [
  { label: "Registrado", description: "El referido quedó registrado" },
  { label: "Correo de activación enviado", description: "Al email del negocio" },
  { label: "Cuenta creada", description: "El negocio activó su cuenta" },
  { label: "Activó un plan", description: "Eligió un plan de Powip" },
  { label: "Pagó · comisión activa", description: "1er mes + recurrente" },
];

const CURRENT_STEP_INDEX: Record<Exclude<ReferralStatus, "cancelado">, number> = {
  en_revision: 0,
  correo_enviado: 1,
  cuenta_creada: 2,
  activo_sin_pago: 3,
  pagando: 4,
};

export function getReferralTimeline(status: ReferralStatus): ReferralTimelineStep[] {
  if (status === "cancelado") {
    return [
      ...STEPS.slice(0, 3).map((step) => ({ ...step, state: "done" as const })),
      {
        label: "Canceló · comisión detenida",
        description: "El negocio dio de baja o se revirtió el pago",
        state: "bad" as const,
      },
    ];
  }

  const currentIndex = CURRENT_STEP_INDEX[status];

  return STEPS.map((step, index) => {
    let state: ReferralTimelineStepState;
    if (index < currentIndex) {
      state = "done";
    } else if (index === currentIndex) {
      state = status === "pagando" ? "done" : "active";
    } else {
      state = "pending";
    }
    return { ...step, state };
  });
}
