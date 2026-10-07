import type { PartnersRequestError } from "../models/partners-request-error";

const MESSAGES_BY_CODE: Record<string, string> = {
  IDEMPOTENCY_CONFLICT:
    "Esta acción ya se envió con otros datos. Recargá la página e intentá de nuevo.",
  APPLICATION_STATE_CONFLICT:
    "La solicitud ya no está pendiente: otra persona pudo haberla resuelto. Actualizamos la cola.",
  PARTNER_AUTH_ACCOUNT_NOT_FOUND:
    "No hay una cuenta Powip registrada con el correo de la solicitud. El solicitante debe registrarse primero.",
  PARTNER_AUTH_ACCOUNT_INACTIVE:
    "La cuenta Powip del solicitante está inactiva. Resolvé el estado de la cuenta antes de aprobar.",
  PARTNER_AUTH_ACCOUNT_AMBIGUOUS:
    "Hay más de una cuenta asociada al correo de la solicitud. Resolvé la cuenta antes de aprobar.",
  PARTNER_AUTH_IDENTITY_MISMATCH:
    "La cuenta encontrada no coincide con la identidad de la solicitud.",
  PARTNER_IDENTITY_CONFLICT: "La cuenta del solicitante ya está vinculada a un partner.",
  PARTNER_IDENTITY_SERVICE_UNAVAILABLE:
    "No pudimos verificar la cuenta del solicitante y la solicitud no se aprobó. Podés reintentar.",
  VERSION_CONFLICT: "Los datos cambiaron mientras los editabas. Recargá e intentá de nuevo.",
};

function formatWait(ms: number): string {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds} s`;
  return `${Math.ceil(seconds / 60)} min`;
}

export function getPartnersErrorMessage(error: PartnersRequestError, fallback: string): string {
  switch (error.kind) {
    case "unauthorized":
      return "Tu sesión expiró o no es válida. Volvé a iniciar sesión.";
    case "forbidden":
      return "No tenés permiso para esta acción. Si te asignaron permisos de Partners hace poco, cerrá sesión y volvé a iniciarla para recibirlos.";
    case "rate_limited":
      return `Hiciste demasiadas solicitudes. Podés volver a intentar en ${formatWait(
        error.retryAfterMs ?? 0,
      )}.`;
  }

  const byCode = error.code ? MESSAGES_BY_CODE[error.code] : undefined;
  if (byCode) return byCode;

  switch (error.kind) {
    case "validation":
      return "Algunos datos no son válidos. Revisalos e intentá de nuevo.";
    case "conflict":
      return "La acción entra en conflicto con el estado actual. Recargá e intentá de nuevo.";
    case "not_found":
      return "No encontramos el recurso solicitado. Puede que ya no exista.";
    case "unavailable":
      return "El servicio de Partners no está disponible en este momento. Intentá más tarde.";
    case "network":
      return "No pudimos conectar con el servicio de Partners. Revisá tu conexión.";
    default:
      return fallback;
  }
}
