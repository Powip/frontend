import axios from "axios";

const MESSAGES_BY_CODE: Record<string, string> = {
  NOT_ADMIN: "Solo el administrador de la cuenta puede agregar RUC.",
  COMPANY_REQUIRED: "Tu usuario no pertenece a una empresa.",
  NO_FLOW_PLAN:
    "Para agregar un RUC extra tu cuenta necesita un plan activo con cobro automático (Flow).",
  NOT_PAID: "Ese RUC extra todavía no está pagado.",
  FLOW_UNAVAILABLE: "No pudimos comunicarnos con Flow. Intenta de nuevo en unos minutos.",
};

const FALLBACK = "No se pudo completar la operación. Intenta de nuevo.";

/** Código estable que devuelve ms-subscription, si lo hay. */
export function getExtraRucErrorCode(error: unknown): string | undefined {
  return axios.isAxiosError(error)
    ? (error.response?.data as { code?: string } | undefined)?.code
    : undefined;
}

/** La cuenta no está en Flow: hay que mandarla a /pasate-a-flow. */
export function needsFlowPlan(error: unknown): boolean {
  return getExtraRucErrorCode(error) === "NO_FLOW_PLAN";
}

export function getExtraRucErrorMessage(error: unknown): string {
  const code = getExtraRucErrorCode(error);

  return (code && MESSAGES_BY_CODE[code]) || FALLBACK;
}
