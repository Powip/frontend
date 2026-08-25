"use client";

/* -----------------------------------------------------------------------
   Hooks de datos para /superadmin/equipo.
   Ver docs/superadmin/equipo-endpoints.md para el detalle completo.

   Listado + KPIs: intenta primero un endpoint agregado propio de
   superadmin (todavía no existe en backend — ms-auth no distingue "staff
   interno Powip" de "usuario de una empresa cliente", así que no hay
   forma real de armar este roster hoy) y cae al mock si falla, mismo
   patrón que el resto de hooks de superadmin.

   Invitar miembro: intenta un POST propuesto y, si falla (hoy siempre),
   simula la invitación en memoria sobre el mock — mismo patrón que
   useMarcarTareaHecha en useDashboard.ts.

   Matriz de permisos: NO es un endpoint pendiente — ROL_VISTAS (de
   superadminNav.config.ts) ya es hoy la fuente de verdad real que decide
   qué ve cada rol en el sidebar. Este archivo la reexpone tal cual (antes
   había una copia duplicada a mano en mocks/superadmin/plataforma.ts,
   ROL_MODULOS, que quedaba desincronizada) y la marca simulada porque
   sigue siendo una constante de frontend, no algo que el backend decida.
----------------------------------------------------------------------- */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { SUPERADMIN_API_BASE, authHeaders, PENDING_BACKEND_QUERY_OPTIONS } from "./superadminApi";
import { equipoPowipMock } from "@/mocks/superadmin";
import { ROL_VISTAS } from "@/config/superadminNav.config";
import type { IMiembroPowip, RolInterno } from "@/interfaces/superadmin";

/* -----------------------------------------------------------------------
   Listado + KPIs — ver doc, sección "Listado de miembros + KPIs".
------------------------------------------------------------------------ */
export function useEquipo() {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const query = useQuery<{ data: IMiembroPowip[] }>({
    queryKey: ["superadmin", "equipo", "list"],
    queryFn: async () => {
      const res = await axios.get<{ data: IMiembroPowip[] }>(`${SUPERADMIN_API_BASE}/equipo`, authHeaders(token));
      return res.data;
    },
    enabled: !!token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });

  return {
    data: query.isError ? equipoPowipMock : (query.data?.data ?? equipoPowipMock),
    isLoading: query.isLoading,
    isSimulado: query.isError,
  };
}

/**
 * KPIs derivados client-side del mismo listado — a diferencia de páginas
 * como Empresas u Operación, acá es razonable: el roster interno son
 * decenas de filas, no miles, así que no hay problema de escala en
 * recorrerlo una vez ya traído (ver doc).
 */
export function useKpisEquipo() {
  const { data, isLoading, isSimulado } = useEquipo();

  return {
    data: {
      total: data.length,
      roles: new Set(data.map((m) => m.rol)).size,
      invitaciones: data.filter((m) => m.estado === "invitado").length,
      superAdmins: data.filter((m) => m.rol === "super").length,
    },
    isLoading,
    isSimulado,
  };
}

/* -----------------------------------------------------------------------
   Invitar miembro — ver doc, sección "Invitar miembro".
------------------------------------------------------------------------ */
export interface NuevoMiembroInput {
  nombre: string;
  email: string;
  rol: RolInterno;
}

export function useInvitarMiembro() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;

  return useMutation({
    mutationFn: async (input: NuevoMiembroInput): Promise<IMiembroPowip> => {
      try {
        const { data } = await axios.post<IMiembroPowip>(`${SUPERADMIN_API_BASE}/equipo/invitar`, input, authHeaders(token));
        return data;
      } catch {
        // Endpoint propuesto todavía no existe en backend — no es un error
        // real del usuario. Simulamos la invitación en memoria sobre el
        // mock para que el flujo siga siendo demostrable.
        const nuevo: IMiembroPowip = {
          id: `team-new-${Date.now()}`,
          nombre: input.nombre,
          email: input.email,
          rol: input.rol,
          estado: "invitado",
          creadoEn: new Date().toISOString(),
        };
        equipoPowipMock.unshift(nuevo);
        return nuevo;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "equipo"] });
    },
  });
}

/* -----------------------------------------------------------------------
   Matriz de permisos — ver doc, sección "Matriz de permisos". No es una
   query real ni propuesta: ROL_VISTAS ya gobierna el sidebar hoy. Se
   normaliza "*" (super, ve todo) a ["*"] (array, no string suelto) para
   que EquipoTable/MatrizPermisos puedan seguir haciendo
   `modulos.includes("*")` sin un caso especial extra — el toggle de
   MatrizPermisos ya sabe expandir ese "*" a módulos puntuales.
------------------------------------------------------------------------ */
export const MATRIZ_PERMISOS: Record<RolInterno, string[]> = Object.fromEntries(
  Object.entries(ROL_VISTAS).map(([rol, vistas]) => [rol, vistas === "*" ? ["*"] : vistas])
) as Record<RolInterno, string[]>;

export function useMatrizPermisos() {
  return { data: MATRIZ_PERMISOS, isLoading: false, isSimulado: true };
}
