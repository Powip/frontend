"use client";
import { useEffect, useRef } from "react";
import {
  PERMISSION_ACTIONS,
  type PermissionAction,
  type PermissionCatalog,
  type PermissionGrant,
} from "@/features/users/rolesService";

const labels: Record<PermissionAction, string> = {
  read: "Ver",
  create: "Crear",
  update: "Editar",
  delete: "Eliminar",
  admin: "Admin",
};
interface Props {
  caption: string;
  catalog?: PermissionCatalog | null;
  grants?: PermissionGrant[];
  onChange?: (grants: PermissionGrant[]) => void;
  disabled?: boolean;
}
export function PermissionMatrix({
  caption,
  catalog,
  grants = [],
  onChange,
  disabled = false,
}: Props) {
  if (!catalog)
    return (
      <p role="status" className="rounded-lg border p-3 text-sm text-muted-foreground">
        Carga el catálogo de permisos para configurar el acceso.
      </p>
    );
  const routes = catalog.sections.flatMap((section) => section.routes);
  const checked = (id: string, action: PermissionAction) =>
    grants.some((grant) => grant.permissionId === id && grant.actions.includes(action));
  function change(changes: Array<{ id: string; action: PermissionAction; enabled: boolean }>) {
    const draft = new Map(grants.map((grant) => [grant.permissionId, new Set(grant.actions)]));
    const set = (
      id: string,
      action: PermissionAction,
      enabled: boolean,
      visited = new Set<string>(),
    ) => {
      const route = routes.find((value) => value.id === id);
      if (!route || route.adminOnly || !route.delegableActions.includes(action)) return;
      const key = `${id}:${action}`;
      if (visited.has(key)) return;
      visited.add(key);
      const actions = draft.get(id) || new Set<PermissionAction>();
      if (enabled) actions.add(action);
      else actions.delete(action);
      draft.set(id, actions);
      if (enabled)
        for (const requirement of route.requires || [])
          for (const requiredAction of requirement.actions)
            set(requirement.permissionId, requiredAction, true, visited);
      if (!enabled)
        for (const dependent of routes)
          if (
            dependent.requires?.some(
              (requirement) =>
                requirement.permissionId === id && requirement.actions.includes(action),
            )
          )
            draft.delete(dependent.id);
    };
    for (const item of changes) set(item.id, item.action, item.enabled);
    onChange?.(
      [...draft]
        .filter(([, actions]) => actions.size)
        .map(([permissionId, actions]) => ({ permissionId, actions: [...actions] })),
    );
  }
  return (
    <div className="min-w-0 w-full max-w-full">
      <p className="mb-2 text-xs text-muted-foreground sm:hidden">
        Desliza la tabla para consultar y seleccionar las cinco acciones.
      </p>
      <div className="min-w-0 w-full max-w-full max-h-[50vh] overflow-auto rounded-lg border">
        <table className="w-full min-w-[590px] table-fixed text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              <th scope="col" className="sticky left-0 z-20 w-[210px] bg-muted p-3 text-left">
                Módulo o ruta
              </th>
              {PERMISSION_ACTIONS.map((action) => (
                <th scope="col" key={action} className="p-2">
                  {labels[action]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {catalog.sections.map((section) => {
              const editable = section.routes.flatMap((route) =>
                route.adminOnly
                  ? []
                  : route.delegableActions
                      .filter((action) => route.actions.includes(action))
                      .map((action) => ({ id: route.id, action })),
              );
              const selected = editable.filter((item) => checked(item.id, item.action)).length;
              return (
                <Section
                  key={section.id}
                  section={section}
                  checked={checked}
                  change={(id, action, enabled) => change([{ id, action, enabled }])}
                  disabled={disabled || !onChange}
                  selected={selected}
                  count={editable.length}
                  toggle={(enabled) => change(editable.map((item) => ({ ...item, enabled })))}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function Section({
  section,
  checked,
  change,
  disabled,
  selected,
  count,
  toggle,
}: {
  section: PermissionCatalog["sections"][number];
  checked: (id: string, action: PermissionAction) => boolean;
  change: (id: string, action: PermissionAction, value: boolean) => void;
  disabled: boolean;
  selected: number;
  count: number;
  toggle: (enabled: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = selected > 0 && selected < count;
  }, [selected, count]);
  return (
    <>
      <tr className="border-y bg-muted/40">
        <th colSpan={6} scope="colgroup" className="p-3 text-left font-semibold">
          <label className="inline-flex items-center gap-2">
            <input
              ref={ref}
              type="checkbox"
              className="h-4 w-4 accent-teal-700"
              checked={count > 0 && selected === count}
              disabled={disabled || !count}
              onChange={(event) => toggle(event.target.checked)}
              aria-label={`Seleccionar sección ${section.label}`}
            />
            {section.label}
          </label>
        </th>
      </tr>
      {section.routes.map((route) => (
        <tr key={route.id} className="border-b">
          <th scope="row" className="sticky left-0 z-10 bg-card p-3 text-left font-normal">
            <span>{route.label}</span>
            <small className="block text-muted-foreground">
              {route.path}
              {route.adminOnly ? " · Solo administrador" : ""}
            </small>
            {route.requires?.length ? (
              <small className="block text-muted-foreground">
                Incluye los permisos de consulta necesarios para esta sección.
              </small>
            ) : null}
          </th>
          {PERMISSION_ACTIONS.map((action) => {
            const exists = route.actions.includes(action);
            const editable =
              exists && !route.adminOnly && route.delegableActions.includes(action) && !disabled;
            return (
              <td key={action} className="p-3 text-center">
                {exists ? (
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-teal-700"
                    checked={checked(route.id, action)}
                    disabled={!editable}
                    aria-label={`${labels[action]} en ${route.label}`}
                    onChange={(event) => change(route.id, action, event.target.checked)}
                  />
                ) : (
                  <span
                    role="img"
                    aria-label={`${labels[action]} no disponible en ${route.label}`}
                    className="text-muted-foreground"
                  >
                    —
                  </span>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
