/* -----------------------------------------------------------------------
   Infraestructura mínima compartida por TODOS los hooks de /superadmin
   (uno por página, ver src/hooks/superadmin/use<Pagina>.ts).

   No es un "service" con lógica de negocio — es exactamente lo que cada
   archivo de hook necesitaría repetir: la base URL del backend propio del
   panel y el armado del header de auth. Documentado en
   docs/superadmin/dashboard-endpoints.md.
------------------------------------------------------------------------ */

export const SUPERADMIN_API_BASE = `${process.env.NEXT_PUBLIC_API_SUPERADMIN ?? ""}/api/v1`;

export function authHeaders(token?: string) {
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

/**
 * Para queries que dependen de un endpoint todavía no construido en backend:
 * evita reintentar contra una ruta que hoy devuelve 404/network error.
 * Sacar este override el día que el endpoint ya exista no es necesario —
 * simplemente empieza a resolver bien y React Query cachea la respuesta real.
 */
export const PENDING_BACKEND_QUERY_OPTIONS = {
  retry: false,
  staleTime: 60 * 1000,
} as const;
