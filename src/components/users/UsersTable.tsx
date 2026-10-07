"use client";

import { useEffect, useRef } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { User } from "@/interfaces/IUser";
import { loginOf, type SortDirection, type SortKey } from "@/services/userListing";
import { roleStyle } from "./usersTheme";

export const USERS_TABLE_COLUMN_COUNT = 12;

const SKELETON_ROW_KEYS = ["skeleton-1", "skeleton-2", "skeleton-3", "skeleton-4", "skeleton-5"];

const SORTABLE_LABELS: Partial<Record<SortKey, string>> = {
  login: "Usuario",
  name: "Nombre",
  surname: "Apellidos",
  status: "Estado",
};

interface UsersTableProps {
  users: User[];
  loading: boolean;
  loadError: boolean;
  onRetry: () => void;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  selectedIds: Set<string>;
  onToggleUser: (id: string) => void;
  onTogglePage: (selected: boolean) => void;
  emptyAction?: React.ReactNode;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onSummary: (user: User) => void;
}

const initialsOf = (user: User) => {
  const initials = `${user.name?.trim()[0] ?? ""}${user.surname?.trim()[0] ?? ""}`;
  return (initials || user.email?.trim()[0] || "?").toUpperCase();
};

const orDash = (value?: string | null) => value?.trim() || "—";

const headClass =
  "whitespace-nowrap bg-[#f7f6ff] px-3.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.05em] text-[#8b87a3] dark:bg-muted";

const cellClass = "px-3.5 py-[11px] align-middle text-[13px] text-[#0e0b1f] dark:text-foreground";

const actionIconButton =
  "flex h-7 w-7 items-center justify-center rounded-[7px] border-[1.5px] border-[#e8e4f8] bg-white text-[#8b87a3] transition-colors dark:border-border dark:bg-transparent";

export function UsersTable({
  users,
  loading,
  loadError,
  onRetry,
  sortKey,
  sortDirection,
  onSort,
  selectedIds,
  onToggleUser,
  onTogglePage,
  emptyAction,
  onEdit,
  onDelete,
  onSummary,
}: UsersTableProps) {
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const selectedOnPage = users.filter((user) => selectedIds.has(user.id)).length;
  const allOnPageSelected = users.length > 0 && selectedOnPage === users.length;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = selectedOnPage > 0 && !allOnPageSelected;
    }
  }, [selectedOnPage, allOnPageSelected]);

  const sortableHead = (key: SortKey) => {
    const active = sortKey === key;
    const Icon = !active ? ArrowUpDown : sortDirection === "asc" ? ArrowUp : ArrowDown;
    return (
      <th
        scope="col"
        className={headClass}
        aria-sort={active ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
      >
        <button
          type="button"
          className="inline-flex items-center gap-1 uppercase hover:text-[#4C2FB5]"
          onClick={() => onSort(key)}
        >
          {SORTABLE_LABELS[key]}
          <Icon className="h-3 w-3" aria-hidden="true" />
        </button>
      </th>
    );
  };

  const plainHead = (label: string) => (
    <th scope="col" className={headClass}>
      {label}
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] border-collapse">
        <thead>
          <tr className="border-b border-[#e8e4f8] dark:border-border">
            <th scope="col" className={`${headClass} w-10`}>
              <input
                ref={headerCheckboxRef}
                type="checkbox"
                aria-label="Seleccionar usuarios de esta página"
                checked={allOnPageSelected}
                disabled={loading || loadError || users.length === 0}
                onChange={(e) => onTogglePage(e.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer accent-[#4C2FB5]"
              />
            </th>
            {sortableHead("login")}
            {sortableHead("name")}
            {sortableHead("surname")}
            {plainHead("Dirección")}
            {plainHead("Distrito")}
            {plainHead("Email")}
            {plainHead("Género")}
            {plainHead("Roles")}
            {sortableHead("status")}
            {plainHead("Teléfono")}
            {plainHead("Acciones")}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            SKELETON_ROW_KEYS.map((key) => (
              <tr key={key} className="border-b border-[#e8e4f8] dark:border-border">
                {Array.from({ length: USERS_TABLE_COLUMN_COUNT }, (_, column) => `${key}-${column}`).map((cellKey) => (
                  <td key={cellKey} className={cellClass}>
                    <Skeleton className="h-4 w-full max-w-24" />
                  </td>
                ))}
              </tr>
            ))
          ) : loadError ? (
            <tr>
              <td colSpan={USERS_TABLE_COLUMN_COUNT} className="py-6">
                <div
                  role="alert"
                  className="mx-auto flex max-w-md items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                >
                  <span>No se pudieron cargar los usuarios.</span>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onRetry}>
                    Reintentar
                  </Button>
                </div>
              </td>
            </tr>
          ) : users.length > 0 ? (
            users.map((user) => {
              const fullName = `${user.name} ${user.surname}`;
              const roleName = user.role?.name?.trim();
              const active = user.status === true;
              return (
                <tr
                  key={user.id}
                  className="border-b border-[#e8e4f8] last:border-b-0 hover:bg-[#f7f6ff] dark:border-border dark:hover:bg-muted/50"
                >
                  <td className={cellClass}>
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${fullName}`}
                      checked={selectedIds.has(user.id)}
                      onChange={() => onToggleUser(user.id)}
                      className="h-3.5 w-3.5 cursor-pointer accent-[#4C2FB5]"
                    />
                  </td>
                  <td className={cellClass}>
                    <div className="flex items-center gap-[9px]">
                      <div
                        aria-hidden="true"
                        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#4C2FB5] text-[11px] font-bold text-white"
                      >
                        {initialsOf(user)}
                      </div>
                      <span className="max-w-44 truncate text-[13px] font-semibold" title={loginOf(user)}>
                        {orDash(loginOf(user))}
                      </span>
                    </div>
                  </td>
                  <td className={`${cellClass} font-semibold`}>{orDash(user.name)}</td>
                  <td className={cellClass}>{orDash(user.surname)}</td>
                  <td className={`${cellClass} max-w-[140px] truncate text-xs text-[#8b87a3]`} title={user.address || undefined}>
                    {orDash(user.address)}
                  </td>
                  <td className={cellClass}>
                    <span className="text-[11px] font-semibold text-[#2D2A45] dark:text-foreground">
                      {orDash(user.district)}
                    </span>
                  </td>
                  <td className={`${cellClass} max-w-[160px] truncate text-xs text-[#8b87a3]`} title={user.email}>
                    {orDash(user.email)}
                  </td>
                  <td className={`${cellClass} text-xs text-[#8b87a3]`}>{orDash(user.gender)}</td>
                  <td className={cellClass}>
                    <span
                      className={`inline-flex items-center whitespace-nowrap rounded-[10px] px-[9px] py-[3px] text-[11px] font-semibold ${roleStyle(roleName).pill}`}
                    >
                      {roleName || "Sin rol"}
                    </span>
                  </td>
                  <td className={cellClass}>
                    <span className="inline-flex items-center gap-[5px] text-xs font-medium">
                      <span
                        aria-hidden="true"
                        className={`h-[7px] w-[7px] shrink-0 rounded-full ${active ? "bg-[#22c55e]" : "bg-[#b8b5cc]"}`}
                      />
                      {active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className={`${cellClass} whitespace-nowrap text-xs text-[#8b87a3]`}>{orDash(user.phoneNumber)}</td>
                  <td className={cellClass}>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`Editar ${fullName}`}
                        title="Editar"
                        onClick={() => onEdit(user)}
                        className={`${actionIconButton} hover:border-[#4C2FB5] hover:bg-[#f0eeff] hover:text-[#4C2FB5]`}
                      >
                        <Pencil className="h-[13px] w-[13px]" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Eliminar ${fullName}`}
                        title="Eliminar"
                        onClick={() => onDelete(user)}
                        className={`${actionIconButton} hover:border-[#ef4444] hover:bg-[#fee2e2] hover:text-[#ef4444]`}
                      >
                        <Trash2 className="h-[13px] w-[13px]" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Resumen de ${fullName}`}
                        onClick={() => onSummary(user)}
                        className="rounded-md bg-[#027778] px-[11px] py-[5px] text-[11px] font-semibold text-white transition-opacity hover:opacity-85"
                      >
                        Resumen
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={USERS_TABLE_COLUMN_COUNT} className="py-6 text-center text-sm text-[#8b87a3]">
                <p>No se encontraron usuarios.</p>
                {emptyAction}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
