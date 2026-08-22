/* -----------------------------------------------------------------------
   El directorio/perfil de Empresas ya es real — ver
   src/hooks/superadmin/useEmpresas.ts y docs/superadmin/empresas-endpoints.md.
   Este archivo quedó solo con lo de Usuarios (módulo /superadmin/usuarios,
   todavía mock — pendiente de la misma migración).
----------------------------------------------------------------------- */

import { IUsuarioEmpresa } from "@/interfaces/superadmin";
import { empresasMock, usuariosEmpresaMock } from "@/mocks/superadmin";
import { mockDelay, matchesQuery, paginate, PageParams, PagedResponse } from "./shared";

export interface UsuariosEmpresaFilters extends PageParams {
  q?: string;
  rol?: string;
}

export async function getUsuariosEmpresa(filters: UsuariosEmpresaFilters = {}): Promise<PagedResponse<IUsuarioEmpresa>> {
  let items = [...usuariosEmpresaMock];
  if (filters.rol && filters.rol !== "todos") items = items.filter((u) => u.rol === filters.rol);
  if (filters.q) items = items.filter((u) => matchesQuery([u.nombre, u.email, u.empresaNombre], filters.q!));
  return mockDelay(paginate(items, filters));
}

export interface NuevoUsuarioInput {
  nombre: string;
  email: string;
  empresaId: string;
  rol: IUsuarioEmpresa["rol"];
}

/**
 * Simula POST /usuarios. Regla crítica (8.8): rol y registro son
 * obligatorios y nunca deben llegar nulos — se exigen aquí en el form y
 * se setean siempre, a diferencia del bug histórico que documenta la spec.
 */
export async function createUsuarioEmpresa(input: NuevoUsuarioInput): Promise<IUsuarioEmpresa> {
  const empresa = empresasMock.find((e) => e.id === input.empresaId);
  const nuevo: IUsuarioEmpresa = {
    id: `ue-new-${Date.now()}`,
    empresaId: input.empresaId,
    empresaNombre: empresa?.nombre ?? "—",
    nombre: input.nombre,
    email: input.email,
    rol: input.rol,
    estado: "invitado",
    registro: new Date().toISOString(),
  };
  usuariosEmpresaMock.unshift(nuevo);
  return mockDelay(nuevo, 400);
}

export async function getKpisUsuarios() {
  const total = usuariosEmpresaMock.length;
  const admins = usuariosEmpresaMock.filter((u) => u.rol === "Administrador").length;
  const nuevos7d = usuariosEmpresaMock.filter((u) => {
    const dias = (Date.now() - new Date(u.registro).getTime()) / 86400000;
    return dias <= 7;
  }).length;
  return mockDelay({ total, superAdmins: 3, admins, nuevos7d });
}
