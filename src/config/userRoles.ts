/** Roles asignables a colaboradores de una empresa (no ADMINISTRADOR ni USUARIO). */
export const COMPANY_USER_ROLES =["AGENTES", "VENTAS", "OPERACIONES", "COURIER", "CALLER"];

export const isCompanyAssignableRole = (name?: string | null): boolean =>
  !!name && COMPANY_USER_ROLES.includes(name.trim().toUpperCase());
