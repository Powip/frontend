"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isCompanyAssignableRole } from "@/config/userRoles";
import type { RoleOption } from "@/services/userListing";
import { roleStyle, usersTheme } from "./usersTheme";

export type CatalogStatus = "loading" | "ready" | "error";

interface RolesCatalogProps {
  status: CatalogStatus;
  roles: RoleOption[];
  counts: Map<string, number> | null;
  usersLoading: boolean;
  onRetry: () => void;
  onViewUsers: (roleKey: string) => void;
  onCreateRole: () => void;
  onEditPermissions: (role: RoleOption) => void;
}

const usersLabel = (count: number) => (count === 1 ? "1 usuario" : `${count} usuarios`);

const cardClassName =
  "flex flex-col rounded-[12px] border-[1.5px] border-[#e8e4f8] bg-white px-[18px] py-4 transition-all hover:-translate-y-0.5 hover:border-[#4C2FB5] hover:shadow-[0_4px_16px_rgba(76,47,181,0.13)] dark:border-border dark:bg-card";

const cardButton =
  "flex-1 rounded-[7px] border-[1.5px] border-[#e8e4f8] bg-white px-2 py-[7px] text-center text-xs font-semibold text-[#2D2A45] transition-colors hover:border-[#4C2FB5] hover:text-[#4C2FB5] dark:bg-transparent dark:text-foreground";

const cardPrimaryButton =
  "flex-1 rounded-[7px] border-[1.5px] border-[#4C2FB5] bg-[#4C2FB5] px-2 py-[7px] text-center text-xs font-semibold text-white transition-colors hover:bg-[#3a22a0]";

export function RolesCatalog({
  status,
  roles,
  counts,
  usersLoading,
  onRetry,
  onViewUsers,
  onCreateRole,
  onEditPermissions,
}: RolesCatalogProps) {
  const toolbar = (
    <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
      <button type="button" className={usersTheme.primaryButton} onClick={onCreateRole}>
        <Plus className="h-[13px] w-[13px]" aria-hidden="true" />
        Crear rol personalizado
      </button>
      <span className="text-[13px] text-[#8b87a3]">
        Los roles personalizados te permiten definir exactamente a qué módulos y acciones tiene acceso cada colaborador.
      </span>
    </div>
  );

  let content: React.ReactNode;

  if (status === "loading") {
    content = (
      <div role="status" className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        <span className="sr-only">Cargando roles…</span>
        {["role-skeleton-1", "role-skeleton-2", "role-skeleton-3"].map((key) => (
          <Skeleton key={key} className="h-40 w-full rounded-[12px]" />
        ))}
      </div>
    );
  } else if (status === "error") {
    content = (
      <div
        role="alert"
        className="mx-auto flex max-w-md items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
      >
        <span>No se pudieron cargar los roles.</span>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    );
  } else {
    content = (
      <div className="space-y-3">
        {roles.length === 0 && (
          <p className="rounded-[12px] border border-dashed px-4 py-6 text-center text-sm text-[#8b87a3]">
            No hay roles para mostrar.
          </p>
        )}
        <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => {
            const count = counts?.get(role.key);
            const style = roleStyle(role.name);
            return (
              <li key={role.key} className={cardClassName}>
                <div className="mb-2.5 flex items-start justify-between gap-2">
                  <div
                    aria-hidden="true"
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-xl ${style.tile}`}
                  >
                    {style.icon}
                  </div>
                  {usersLoading ? (
                    <Skeleton className="h-5 w-20 rounded-full" />
                  ) : (
                    <span className="shrink-0 rounded-[10px] bg-[#f7f6ff] px-[9px] py-[3px] text-[11px] font-semibold text-[#8b87a3] dark:bg-muted">
                      {count === undefined ? "Sin datos de usuarios" : usersLabel(count)}
                    </span>
                  )}
                </div>
                <div className="mb-3">
                  <h2 className="mb-[3px] break-words text-sm font-bold text-[#0e0b1f] dark:text-foreground">{role.label}</h2>
                  {role.description && <p className="text-xs leading-snug text-[#8b87a3]">{role.description}</p>}
                  {isCompanyAssignableRole(role.name) && (
                    <p className="mt-2 text-[11px] text-[#8b87a3]">Se puede elegir al crear o editar usuarios.</p>
                  )}
                </div>
                <div className="mt-auto flex gap-[7px] border-t border-[#e8e4f8] pt-2.5 dark:border-border">
                  <button
                    type="button"
                    className={cardButton}
                    aria-label={`Ver usuarios con rol ${role.label}`}
                    onClick={() => onViewUsers(role.key)}
                  >
                    Ver usuarios
                  </button>
                  <button
                    type="button"
                    className={cardPrimaryButton}
                    aria-label={`Editar permisos de ${role.label}`}
                    onClick={() => onEditPermissions(role)}
                  >
                    Editar permisos
                  </button>
                </div>
              </li>
            );
          })}
          <li className={`${cardClassName} border-dashed border-[#4C2FB5]`}>
            <div className="mb-2.5 flex items-start justify-between gap-2">
              <div
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#f0eeff] text-xl"
              >
                ⚙️
              </div>
            </div>
            <div className="mb-3">
              <h2 className="mb-[3px] text-sm font-bold text-[#0e0b1f] dark:text-foreground">Personalizado</h2>
              <p className="text-xs leading-snug text-[#8b87a3]">Crea un perfil de acceso a medida.</p>
            </div>
            <div className="mt-auto flex gap-[7px] border-t border-[#e8e4f8] pt-2.5 dark:border-border">
              <button type="button" className={cardPrimaryButton} onClick={onCreateRole}>
                Crear nuevo
              </button>
            </div>
          </li>
        </ul>
      </div>
    );
  }

  return (
    <div>
      {toolbar}
      {content}
    </div>
  );
}
