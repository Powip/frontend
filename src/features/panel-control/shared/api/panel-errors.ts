import { PanelAccesoDenegadoError } from "../data/panel-identidad";

/**
 * Estado HTTP de un error de `getPanel` (axios deja `response.status`); un rechazo local por rol
 * (`PanelAccesoDenegadoError`) cuenta como 403. `null` si el servidor no llegó a responder.
 */
export function estadoHttp(error: unknown): number | null {
  if (error instanceof PanelAccesoDenegadoError) return 403;
  if (typeof error !== "object" || error === null) return null;
  const estado = (error as { response?: { status?: unknown } }).response?.status;
  return typeof estado === "number" ? estado : null;
}

/** El `message` en español que manda el backend (NestJS), si vino como texto. */
function mensajeDelServidor(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const mensaje = (error as { response?: { data?: { message?: unknown } } }).response?.data
    ?.message;
  return typeof mensaje === "string" && mensaje.trim() ? mensaje : null;
}

/**
 * Mensajes de un 400 del backend para mostrarlos en el formulario. Nest manda `message` como
 * texto o, con class-validator, como lista de textos; ambos casos devuelven una lista.
 */
export function mensajesDe400(error: unknown): string[] {
  if (typeof error !== "object" || error === null) return [];
  const mensaje = (error as { response?: { data?: { message?: unknown } } }).response?.data
    ?.message;
  const lista = Array.isArray(mensaje) ? mensaje : [mensaje];
  return lista.filter((m): m is string => typeof m === "string" && m.trim() !== "");
}

export const MENSAJE_SIN_PERMISO = "Tu rol no tiene acceso a esta información.";
export const MENSAJE_SERVICIO_NO_DISPONIBLE =
  "El servicio no está disponible por ahora. Reintenta en unos minutos.";

/** Texto para mostrar al usuario: nunca «Request failed with status code …» cuando se sabe qué pasó. */
export function mensajeDeError(error: unknown): string {
  switch (estadoHttp(error)) {
    case 403:
      return MENSAJE_SIN_PERMISO;
    case 503:
      return MENSAJE_SERVICIO_NO_DISPONIBLE;
    case 404:
      return (
        mensajeDelServidor(error) ?? "Ya no existe lo que intentas ver. Actualiza la pantalla."
      );
    case 400: {
      const mensajes = mensajesDe400(error);
      if (mensajes.length) return mensajes.join(" · ");
      break;
    }
    default:
      break;
  }
  return error instanceof Error ? error.message : "Error desconocido";
}
