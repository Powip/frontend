import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";

const base = process.env.NEXT_PUBLIC_API_USERS?.replace("/api/v1", "") || "http://localhost:8080";
const path = (value: string) => `${base}/api/v1/auth${value}`;
export const PERMISSION_ACTIONS = ["read", "create", "update", "delete", "admin"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];
export interface PermissionGrant {
  permissionId: string;
  actions: PermissionAction[];
}
export interface PermissionRoute {
  id: string;
  label: string;
  path: string;
  actions: PermissionAction[];
  delegableActions: PermissionAction[];
  permissionNames: Partial<Record<PermissionAction, string>>;
  adminOnly?: boolean;
  requires?: Array<{ permissionId: string; actions: PermissionAction[] }>;
}
export interface PermissionCatalog {
  version: number;
  sections: Array<{ id: string; label: string; routes: PermissionRoute[] }>;
}
export interface CompanyRole {
  id: string;
  name: string;
  assignmentName: string;
  description?: string;
  color?: string;
  isSystem: boolean;
  isCustom: boolean;
  assignable: boolean;
  canEditPermissions: boolean;
  userCount: number;
  permissionsVersion: number;
}
export interface RoleAccess {
  userId: string;
  companyId: string;
  canRead: boolean;
  canWrite: boolean;
}
export interface PermissionSnapshot {
  roleId: string;
  version: number;
  grants: PermissionGrant[];
  canEditPermissions: boolean;
}
export interface RoleInput {
  name: string;
  description?: string;
  color?: string;
  grants: PermissionGrant[];
}
export async function getRoleAccess(userId: string, companyId: string, signal?: AbortSignal) {
  const { data } = await axiosAuth.get<RoleAccess>(path("/company/roles/access"), { signal });
  if (data.userId !== userId || data.companyId !== companyId)
    throw new Error("La sesión del negocio cambió. Actualiza la página antes de continuar.");
  return { ...data, canRead: data.canRead === true, canWrite: data.canWrite === true };
}
export async function getPermissionCatalog(signal?: AbortSignal) {
  return (await axiosAuth.get<PermissionCatalog>(path("/permissions/catalog"), { signal })).data;
}
export async function getCompanyRoles(signal?: AbortSignal): Promise<CompanyRole[]> {
  const { data } = await axiosAuth.get<CompanyRole[] | { items: CompanyRole[] }>(
    path("/company/roles"),
    { signal },
  );
  return Array.isArray(data) ? data : data.items;
}
export async function getRolePermissions(id: string, signal?: AbortSignal) {
  return (
    await axiosAuth.get<PermissionSnapshot>(
      path(`/company/roles/${encodeURIComponent(id)}/permissions`),
      { signal },
    )
  ).data;
}
export async function createCompanyRole(input: RoleInput) {
  return (await axiosAuth.post<CompanyRole>(path("/company/roles"), input)).data;
}
export async function updateCompanyRole(id: string, input: RoleInput & { version: number }) {
  return (
    await axiosAuth.patch<CompanyRole>(path(`/company/roles/${encodeURIComponent(id)}`), input)
  ).data;
}
export async function deleteCompanyRole(id: string, version: number) {
  await axiosAuth.delete(path(`/company/roles/${encodeURIComponent(id)}`), { params: { version } });
}
export function userError(cause: unknown): string {
  if (axios.isAxiosError(cause)) {
    const message = cause.response?.data?.message;
    if (typeof message === "string") return message;
    if (cause.response?.status === 403) return "Tu cuenta no tiene permiso para esta acción.";
    if (cause.response?.status === 409)
      return "El rol cambió o tiene usuarios asignados. Actualiza los datos antes de guardar.";
  }
  return cause instanceof Error ? cause.message : "No se pudo completar la operación.";
}
