"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { MY_WAREHOUSES_KEY } from "@/hooks/useMyWarehouses";
import { isCompanyAdminRole } from "@/lib/purchaseOrders";
import {
  ACCESS_LABEL,
  buildSaveBody,
  draftFromAssignments,
  draftProblem,
  draftSummary,
  groupAssignments,
  sameDraft,
  type AccessLevel,
  type UserWarehouseDraft,
} from "@/lib/userWarehouses";
import { opsErrorMessage } from "@/lib/warehouseOps";
import { getUsersByCompany } from "@/services/userService";
import { listUserWarehouses, saveUserWarehouses } from "@/services/userWarehousesService";
import { ErrorBox, RuleNote, SELECT_CLASS } from "../OpsBits";
import { useCompanyWarehouses } from "@/hooks/useCompanyWarehouses";

// FEAT-24 H6 (H6-D5) — Configuración › Usuarios y almacenes (mockup vUsuarios):
// por usuario, qué almacenes ve y en cuáles mueve stock. Sin restricciones
// («Todos») ve y opera todos, como hasta hoy. Solo el Administrador lo edita.
// Guardar reemplaza la lista del usuario.

export const USER_WAREHOUSES_KEY = "user-warehouses";

const LEVELS: AccessLevel[] = ["none", "view", "operate"];

interface CompanyUser {
  id: string;
  name?: string | null;
  surname?: string | null;
  email?: string | null;
  status?: boolean;
  role?: { name?: string | null } | null;
}

const fullName = (user: CompanyUser) => [user.name, user.surname].filter((part) => part && part.trim()).join(" ").trim() || user.email || "Usuario";

export default function UserWarehousesView() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const isAdmin = isCompanyAdminRole(auth?.user?.role);
  const queryClient = useQueryClient();
  const { warehouses, query: warehousesQuery } = useCompanyWarehouses();
  const [drafts, setDrafts] = useState<Record<string, UserWarehouseDraft>>({});
  const [rowError, setRowError] = useState<{ userId: string; message: string } | null>(null);

  const usersQuery = useQuery({
    queryKey: ["company-users", companyId],
    queryFn: async () => (await getUsersByCompany(companyId, auth?.accessToken ?? "")) as CompanyUser[],
    enabled: isAdmin && Boolean(companyId && auth?.accessToken),
    retry: false,
  });
  const assignmentsQuery = useQuery({
    queryKey: [USER_WAREHOUSES_KEY, companyId],
    queryFn: ({ signal }) => listUserWarehouses(undefined, signal),
    enabled: isAdmin && Boolean(companyId),
    retry: false,
  });

  const byUser = useMemo(() => groupAssignments(assignmentsQuery.data ?? []), [assignmentsQuery.data]);
  // Activos, más los inactivos que alguien tiene asignados (para poder quitarlos).
  const columns = useMemo(
    () => warehouses.filter((warehouse) => warehouse.status || (assignmentsQuery.data ?? []).some((item) => item.inventoryId === warehouse.id)),
    [warehouses, assignmentsQuery.data],
  );
  const users = useMemo(
    () => [...(usersQuery.data ?? [])].sort((a, b) => Number(b.status !== false) - Number(a.status !== false) || fullName(a).localeCompare(fullName(b))),
    [usersQuery.data],
  );

  const saved = (userId: string) => draftFromAssignments(byUser.get(userId));
  const current = (userId: string) => drafts[userId] ?? saved(userId);
  const change = (userId: string, next: UserWarehouseDraft) => {
    setRowError(null);
    setDrafts((all) => ({ ...all, [userId]: next }));
  };

  const save = useMutation({
    mutationFn: (userId: string) => saveUserWarehouses(buildSaveBody(userId, current(userId))),
    onSuccess: async (_result, userId) => {
      toast.success("Almacenes del usuario guardados");
      await queryClient.invalidateQueries({ queryKey: [USER_WAREHOUSES_KEY, companyId] });
      void queryClient.invalidateQueries({ queryKey: [MY_WAREHOUSES_KEY, companyId] });
      setDrafts((all) => {
        const next = { ...all };
        delete next[userId];
        return next;
      });
    },
    onError: (error, userId) => setRowError({ userId, message: opsErrorMessage(error, "No se pudieron guardar los almacenes del usuario.") }),
  });

  if (!isAdmin) {
    return (
      <div role="alert" className="rounded-md border p-6 text-center text-sm">
        Solo el Administrador puede ver y asignar los almacenes de los usuarios.
      </div>
    );
  }

  const loading = usersQuery.isPending || assignmentsQuery.isPending || warehousesQuery.isPending;
  const loadError = usersQuery.error ?? assignmentsQuery.error ?? warehousesQuery.error;

  return (
    <div className="space-y-4">
      <RuleNote>
        Cada usuario ve y mueve stock solo en los almacenes que tiene asignados. Con <b>Todos</b> no tiene restricciones (como hasta hoy). «Ve» deja
        consultar; «Ve y opera» deja además recibir, trasladar, ajustar y contar. El backend lo aplica en cada operación.
      </RuleNote>

      {loadError ? <ErrorBox>{opsErrorMessage(loadError, "No se pudieron cargar los usuarios o sus almacenes.")}</ErrorBox> : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Usuario</th>
              <th className="px-3 py-2 text-left font-medium">Rol</th>
              <th className="px-3 py-2 text-center font-medium">Todos</th>
              {columns.map((warehouse) => (
                <th key={warehouse.id} className="px-3 py-2 text-left font-medium">
                  {warehouse.name}
                  {!warehouse.status ? <span className="block font-normal">(inactivo)</span> : null}
                </th>
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length + 4} className="px-3 py-8 text-center text-muted-foreground">
                  Cargando usuarios…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 4} className="px-3 py-8 text-center text-muted-foreground">
                  No hay usuarios en la empresa.
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const draft = current(user.id);
                const dirty = !sameDraft(draft, saved(user.id));
                const problem = draftProblem(draft);
                const self = user.id === auth?.user?.id;
                const busy = save.isPending && save.variables === user.id;
                const name = fullName(user);
                return (
                  <tr key={user.id} className="border-t align-top" data-testid={`user-row-${user.id}`}>
                    <td className="px-3 py-2">
                      <p className="font-medium">{name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                      {user.status === false ? <Badge variant="outline">Inactivo</Badge> : null}
                    </td>
                    <td className="px-3 py-2">{user.role?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <Checkbox
                        aria-label={`Todos los almacenes: ${name}`}
                        checked={draft.all}
                        disabled={self || busy}
                        onCheckedChange={(checked) => change(user.id, { ...draft, all: checked === true })}
                      />
                    </td>
                    {columns.map((warehouse) => (
                      <td key={warehouse.id} className="px-3 py-2">
                        <select
                          aria-label={`${warehouse.name}: ${name}`}
                          className={`${SELECT_CLASS} min-w-32`}
                          value={draft.all ? "operate" : (draft.levels[warehouse.id] ?? "none")}
                          disabled={draft.all || self || busy}
                          onChange={(event) => change(user.id, { ...draft, levels: { ...draft.levels, [warehouse.id]: event.target.value as AccessLevel } })}
                        >
                          {LEVELS.map((level) => (
                            <option key={level} value={level}>
                              {ACCESS_LABEL[level]}
                            </option>
                          ))}
                        </select>
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-end gap-1">
                        {self ? (
                          <span className="text-xs text-muted-foreground">Tus propios almacenes no se cambian desde tu sesión.</span>
                        ) : (
                          <>
                            <span className="text-xs text-muted-foreground">{draftSummary(draft)}</span>
                            <Button
                              type="button"
                              size="sm"
                              disabled={!dirty || !!problem || save.isPending}
                              aria-label={`Guardar almacenes de ${name}`}
                              onClick={() => save.mutate(user.id)}
                            >
                              {busy ? "Guardando…" : "Guardar"}
                            </Button>
                          </>
                        )}
                        {dirty && problem ? <span className="max-w-56 text-right text-xs text-destructive">{problem}</span> : null}
                        {rowError?.userId === user.id ? (
                          <span role="alert" className="max-w-56 text-right text-xs text-destructive">
                            {rowError.message}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
