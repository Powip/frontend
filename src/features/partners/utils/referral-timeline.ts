import type { ReferralStatus } from "../models/referral-status.enum";

export type ReferralTimelineStepState = "done" | "active" | "pending" | "bad";

export interface ReferralTimelineStep {
  label: string;
  description: string;
  state: ReferralTimelineStepState;
}

const CURRENT_STATE: Record<ReferralStatus, ReferralTimelineStep> = {
  registrado: {
    label: "Registrado",
    description: "El backend informa el registro del referido",
    state: "active",
  },
  en_revision: {
    label: "En revisión",
    description: "El referido está en revisión",
    state: "active",
  },
  correo_enviado: {
    label: "Invitación enviada",
    description: "El backend informa el envío de una invitación",
    state: "active",
  },
  cuenta_creada: {
    label: "Cuenta creada",
    description: "El backend informa una cuenta creada",
    state: "active",
  },
  activo_sin_pago: {
    label: "Empresa creada",
    description: "Este estado no confirma un plan ni un pago",
    state: "active",
  },
  pagando: {
    label: "Pago calificado registrado",
    description: "Este estado no informa una comisión",
    state: "active",
  },
  cancelado: {
    label: "Referido cancelado",
    description: "El backend informa la cancelación del referido",
    state: "bad",
  },
  desconocido: {
    label: "Estado no disponible",
    description: "Todavía no podemos mostrar el estado reportado de este referido",
    state: "pending",
  },
};

export function getReferralTimeline(status: ReferralStatus): ReferralTimelineStep[] {
  // The API reports one current state, not the events or transitions that preceded it.
  return [{ ...CURRENT_STATE[status] }];
}
