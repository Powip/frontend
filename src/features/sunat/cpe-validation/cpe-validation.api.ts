import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";

// Freno de duplicados de facturas, boletas y notas: credenciales de la
// Consulta Integrada de Validez de Comprobantes (API REST de SUNAT) por RUC.
// ms-sunat consulta el número antes de enviarlo y, si ya existe en SUNAT, no lo
// envía. El secreto se guarda cifrado y nunca vuelve al navegador. Lo ve y lo
// cambia cualquier usuario que ya entra a Facturación (siempre por empresa).

export interface CpeValidationAccess {
  /** ms-sunat tiene las URLs de la Consulta Integrada: sin ellas no consulta nada. */
  serviceConfigured: boolean;
}

export interface CpeValidationCredential {
  sunatProfileId: string;
  clientId: string;
  hasClientSecret: boolean;
  updatedAt: string;
}

export interface UpsertCpeValidationCredentialRequest {
  clientId: string;
  clientSecret: string;
}

const base = () => `${API.sunat}/api/v1/cpe-validation`;
const id = (value: string) => encodeURIComponent(value);

export async function getCpeValidationAccessApi(signal?: AbortSignal): Promise<CpeValidationAccess> {
  const { data } = await axiosAuth.get<CpeValidationAccess>(`${base()}/access`, { signal });
  return data;
}

/** `null` si el RUC todavía no tiene credenciales (404 de ms-sunat). */
export async function getCpeValidationCredentialApi(sunatProfileId: string, signal?: AbortSignal): Promise<CpeValidationCredential | null> {
  try {
    const { data } = await axiosAuth.get<CpeValidationCredential>(`${base()}/sunat-profiles/${id(sunatProfileId)}/credentials`, { signal });
    return data;
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) return null;
    throw error;
  }
}

export async function upsertCpeValidationCredentialApi(sunatProfileId: string, body: UpsertCpeValidationCredentialRequest): Promise<CpeValidationCredential> {
  const { data } = await axiosAuth.put<CpeValidationCredential>(`${base()}/sunat-profiles/${id(sunatProfileId)}/credentials`, body);
  return data;
}

export async function deleteCpeValidationCredentialApi(sunatProfileId: string): Promise<void> {
  await axiosAuth.delete(`${base()}/sunat-profiles/${id(sunatProfileId)}/credentials`);
}

/** Mensaje claro para los errores de estas llamadas. */
export function cpeValidationErrorMessage(error: unknown, fallback: string): string {
  const response = (error as { response?: { status?: number; data?: { code?: string } } } | null)?.response;
  if (!response) return "No hubo respuesta del servidor de facturación. Revisa tu conexión e inténtalo de nuevo.";
  switch (response.data?.code) {
    case "SUNAT_PROFILE_NOT_FOUND":
      return "No se encontró el RUC emisor. Actualiza la página.";
    default:
      break;
  }
  if (response.status === 400) return "Revisa el client_id (hasta 100 caracteres) y el client_secret (hasta 500).";
  if (response.status === 401 || response.status === 403) return "Tu sesión no tiene permiso para esta acción. Vuelve a iniciar sesión.";
  if (response.status !== undefined && response.status >= 500) return "El servicio de facturación tuvo un error. Inténtalo de nuevo en unos minutos.";
  return fallback;
}
