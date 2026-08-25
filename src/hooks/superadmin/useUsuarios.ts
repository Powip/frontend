"use client";

/* -----------------------------------------------------------------------
   Hooks de datos para /superadmin/usuarios — directorio de usuarios FINALES
   de las empresas cliente (no el equipo interno de Powip, eso es
   /superadmin/equipo). Ver docs/superadmin/usuarios-endpoints.md para el
   detalle completo: el listado ya es real (userService.getAllUsers, ms-auth)
   pero sin paginar/filtrar server-side, sin join de nombre de empresa, y con
   una taxonomía de roles real que no coincide con lo que el mock inventaba.
----------------------------------------------------------------------- */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import * as userService from "@/services/userService";
import * as companyService from "@/services/companyService";
import type { IUsuarioEmpresa, EstadoUsuarioEmpresa } from "@/interfaces/superadmin";

/* -----------------------------------------------------------------------
   Mapeo real <-> vista del front.

   La forma exacta del objeto que devuelve ms-auth para GET /auth/users no
   está confirmada de forma consistente en el repo (ver doc, punto 3): hay
   código real que lee `role.name` anidado + sin companyId (IUser.ts, usado
   por /usuarios) y código real que lee `roleName` plano + `companyId` +
   `created_at` (dashboard legacy). Probamos ambas formas a modo de mejor
   esfuerzo en vez de elegir una y adivinar mal.
------------------------------------------------------------------------ */
function rawCompanyId(u: any): string {
  return u.companyId ?? u.company_id ?? "";
}

function rawRoleName(u: any): string {
  return u.role?.name ?? u.roleName ?? "—";
}

function rawCreatedAt(u: any): string | undefined {
  return u.createdAt ?? u.created_at ?? undefined;
}

function mapEstado(status: unknown): EstadoUsuarioEmpresa {
  return status === false ? "inactivo" : "activo";
}

function mapUsuario(raw: any, empresasById: Map<string, string>): IUsuarioEmpresa {
  const empresaId = rawCompanyId(raw);
  const nombre = [raw.name, raw.surname].filter(Boolean).join(" ").trim() || raw.email;
  return {
    id: raw.id,
    empresaId,
    empresaNombre: empresaId ? (empresasById.get(empresaId) ?? "—") : "—",
    nombre,
    email: raw.email,
    rol: rawRoleName(raw),
    estado: mapEstado(raw.status),
    registro: rawCreatedAt(raw) ?? new Date(0).toISOString(),
    ultimoAcceso: undefined, // sin fuente real en ningún servicio de auth — ver doc
  };
}

/* -----------------------------------------------------------------------
   1. Fuentes crudas — reales, sin paginar (ver doc).
   La query de empresas usa la MISMA queryKey que useEmpresas.ts para que
   React Query comparta el fetch en vez de duplicarlo.
------------------------------------------------------------------------ */
function useAllUsersRaw() {
  const { auth } = useAuth();
  return useQuery({
    queryKey: ["superadmin", "usuarios", "raw"],
    queryFn: () => userService.getAllUsers(auth!.accessToken),
    enabled: !!auth?.accessToken,
    staleTime: 5 * 60 * 1000,
  });
}

function useAllCompaniesRaw() {
  const { auth } = useAuth();
  return useQuery({
    queryKey: ["superadmin", "empresas", "raw"],
    queryFn: () => companyService.getAllCompanies(auth!.accessToken),
    enabled: !!auth?.accessToken,
    staleTime: 5 * 60 * 1000,
  });
}

/** Lista completa (sin paginar) — usada por los KPIs y por el botón de export. */
export function useUsuariosEmpresaBase() {
  const { data: rawUsers, isLoading: loadingUsers, isError } = useAllUsersRaw();
  const { data: rawCompanies, isLoading: loadingCompanies } = useAllCompaniesRaw();

  const empresasById = useMemo(() => new Map((rawCompanies ?? []).map((c) => [c.id, c.name])), [rawCompanies]);

  const usuarios = useMemo(() => {
    // Solo usuarios con empresa asociada — sin esto se mezclaría el equipo
    // interno de Powip (sin companyId) en el directorio de clientes.
    return (rawUsers ?? []).filter((u: any) => !!rawCompanyId(u)).map((u) => mapUsuario(u, empresasById));
  }, [rawUsers, empresasById]);

  return { usuarios, isLoading: loadingUsers || loadingCompanies, isError };
}

/* -----------------------------------------------------------------------
   2. Listado — filtro/paginado en memoria (ver doc: no hay page/page_size/
   q/rol server-side todavía).
------------------------------------------------------------------------ */
export interface UsuariosFilters {
  q?: string;
  rol?: string;
  page?: number;
  pageSize?: number;
}

export function useUsuariosList(filters: UsuariosFilters = {}) {
  const { usuarios, isLoading, isError } = useUsuariosEmpresaBase();
  const { page = 1, pageSize = 10, q, rol } = filters;

  const filtered = useMemo(() => {
    let items = usuarios;
    if (q?.trim()) {
      const query = q.trim().toLowerCase();
      items = items.filter((u) => u.nombre.toLowerCase().includes(query) || u.email.toLowerCase().includes(query));
    }
    if (rol && rol !== "todos") items = items.filter((u) => u.rol === rol);
    return items;
  }, [usuarios, q, rol]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const data = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return { data, meta: { page: safePage, pageSize, total, totalPages }, isLoading, isError };
}

/* -----------------------------------------------------------------------
   3. KPIs.
------------------------------------------------------------------------ */
export function useKpisUsuarios() {
  const { usuarios, isLoading } = useUsuariosEmpresaBase();

  const data = useMemo(() => {
    const total = usuarios.length;
    const admins = usuarios.filter((u) => ["ADMIN", "ADMINISTRADOR"].includes(u.rol.toUpperCase())).length;
    const nuevos7d = usuarios.filter((u) => {
      const dias = (Date.now() - new Date(u.registro).getTime()) / 86400000;
      return dias >= 0 && dias <= 7;
    }).length;
    return { total, superAdmins: 0, admins, nuevos7d };
  }, [usuarios]);

  return { data, isLoading, superAdminsSimulado: true };
}

/* -----------------------------------------------------------------------
   4. Roles disponibles — real, mismo endpoint que ya usa UserForm.tsx del
   lado empresa. Reemplaza el enum inventado (Administrador/Vendedor/Soporte).
------------------------------------------------------------------------ */
export function useRolesDisponibles() {
  const { auth } = useAuth();
  const query = useQuery({
    queryKey: ["superadmin", "usuarios", "roles"],
    queryFn: () => userService.getRoles(auth!.accessToken),
    enabled: !!auth?.accessToken,
    staleTime: 10 * 60 * 1000,
  });
  return { data: query.data ?? [], isLoading: query.isLoading };
}

/* -----------------------------------------------------------------------
   5. Empresas disponibles (para el selector del modal de creación) — reusa
   la misma fuente real que /superadmin/empresas.
------------------------------------------------------------------------ */
export function useEmpresasDisponibles() {
  const { data, isLoading } = useAllCompaniesRaw();
  return { data: data ?? [], isLoading };
}

/* -----------------------------------------------------------------------
   6. Mutaciones — reales, sobre userService.ts (ver doc para lo que falta:
   sin invitación por email, sin reasignar empresa, sin baja lógica).
------------------------------------------------------------------------ */
export interface NuevoUsuarioEmpresaInput {
  nombre: string;
  apellido?: string;
  email: string;
  empresaId: string;
  roleName: string;
  password?: string;
  identityDocument?: string;
  phoneNumber?: string;
}

export function useCreateUsuarioEmpresa() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NuevoUsuarioEmpresaInput) => {
      // Sin flujo de invitación por email en ms-auth: se crea con contraseña
      // temporal si no se especifica una (ver doc).
      const password = input.password?.trim() || `Powip${Math.random().toString(36).slice(2, 8)}1`;
      return userService.createCompanyUser(
        input.empresaId,
        {
          identityDocument: input.identityDocument || "00000000",
          name: input.nombre,
          surname: input.apellido || "",
          email: input.email,
          password,
          phoneNumber: input.phoneNumber,
          roleName: input.roleName,
        },
        auth!.accessToken
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "usuarios"] });
    },
  });
}

export function useUpdateUsuarioRol() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleName }: { userId: string; roleName: string }) =>
      userService.updateUser(userId, { roleName }, auth!.accessToken),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["superadmin", "usuarios"] }),
  });
}

/**
 * "Desactivar" en la UI, pero hoy es un borrado real: `UpdateUserRequest` no
 * tiene `status`, así que no hay endpoint confirmado de baja lógica (ver doc).
 */
export function useDeleteUsuarioEmpresa() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => userService.deleteUser(userId, auth!.accessToken),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["superadmin", "usuarios"] }),
  });
}
