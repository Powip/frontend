"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isCompanyAssignableRole } from "@/config/userRoles";
import type { RoleOption } from "@/services/userListing";

export type CatalogStatus = "loading" | "ready" | "error";

interface RolesCatalogProps {
  status: CatalogStatus;
  roles: RoleOption[];
  counts: Map<string, number> | null;
  usersLoading: boolean;
  onRetry: () => void;
  onViewUsers: (roleKey: string) => void;
}

const usersLabel = (count: number) => (count === 1 ? "1 usuario" : `${count} usuarios`);

export function RolesCatalog({
  status,
  roles,
  counts,
  usersLoading,
  onRetry,
  onViewUsers,
}: RolesCatalogProps) {
  if (status === "loading") {
    return (
      <div role="status" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <span className="sr-only">Cargando roles…</span>
        {["role-skeleton-1", "role-skeleton-2", "role-skeleton-3"].map((key) => (
          <Skeleton key={key} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
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
  }

  if (roles.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        ms-auth no devolvió roles para mostrar.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Roles que devuelve ms-auth. Los permisos de cada rol todavía no están disponibles en esta pantalla.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => {
          const count = counts?.get(role.key);
          return (
            <li key={role.key} className="flex flex-col rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-semibold break-words">{role.label}</h2>
                {usersLoading ? (
                  <Skeleton className="h-5 w-20 rounded-full" />
                ) : (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {count === undefined ? "Sin datos de usuarios" : usersLabel(count)}
                  </span>
                )}
              </div>
              {role.description && (
                <p className="mt-1 text-xs text-muted-foreground">{role.description}</p>
              )}
              {isCompanyAssignableRole(role.name) && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Se puede elegir al crear o editar usuarios.
                </p>
              )}
              <div className="mt-auto pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  aria-label={`Ver usuarios con rol ${role.label}`}
                  onClick={() => onViewUsers(role.key)}
                >
                  Ver usuarios
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
