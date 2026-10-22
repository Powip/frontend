"use client";
import { Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PermissionMatrix } from "@/components/users/PermissionMatrix";
import {
  type CompanyRole,
  createCompanyRole,
  deleteCompanyRole,
  getPermissionCatalog,
  getRolePermissions,
  type PermissionCatalog,
  type PermissionGrant,
  updateCompanyRole,
  userError,
} from "./rolesService";
import type { useCompanyRoles } from "./useCompanyRoles";

type Editor = CompanyRole | "new" | { copy: CompanyRole };
export default function RolesPanel({ state }: { state: ReturnType<typeof useCompanyRoles> }) {
  const { scope, access, roles, loading, error: accessError, refresh } = state;
  const current = useRef(scope);
  current.current = scope;
  const allowed = access?.canRead === true;
  const canWrite = allowed && access?.canWrite === true;
  const [catalog, setCatalog] = useState<PermissionCatalog | null>(null);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [removing, setRemoving] = useState<CompanyRole | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    setCatalog(null);
    setError("");
    setEditor(null);
    setRemoving(null);
    if (!allowed) return;
    const abort = new AbortController();
    void getPermissionCatalog(abort.signal)
      .then((value) => {
        if (!abort.signal.aborted && current.current === scope) setCatalog(value);
      })
      .catch((cause) => {
        if (!abort.signal.aborted && current.current === scope) setError(userError(cause));
      });
    return () => abort.abort();
  }, [allowed, scope]);
  async function remove() {
    if (
      current.current !== scope ||
      !removing ||
      lock.current ||
      !canWrite ||
      !removing.isCustom ||
      removing.isSystem ||
      removing.userCount > 0
    )
      return;
    lock.current = true;
    setBusy(true);
    try {
      await deleteCompanyRole(removing.id, removing.permissionsVersion);
      if (current.current !== scope) return;
      setRemoving(null);
      await refresh();
    } catch (cause) {
      if (current.current === scope) setError(userError(cause));
    } finally {
      lock.current = false;
      if (current.current === scope) setBusy(false);
    }
  }
  if (loading)
    return (
      <p role="status" className="text-sm">
        Cargando roles y permisos…
      </p>
    );
  if (accessError || !allowed)
    return (
      <div role="alert" className="rounded-lg border p-4 text-sm">
        <p>
          {accessError || "Tu cuenta no tiene permiso para consultar los perfiles de este negocio."}
        </p>
        <Button variant="outline" className="mt-3" onClick={() => void refresh()}>
          Reintentar
        </Button>
      </div>
    );
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Roles del negocio</h2>
          <p className="text-sm text-muted-foreground">
            Crea perfiles con los accesos que necesita cada colaborador.
          </p>
        </div>
        {canWrite ? (
          <Button disabled={!catalog} onClick={() => setEditor("new")}>
            <Plus className="h-4 w-4" />
            Crear rol personalizado
          </Button>
        ) : null}
      </div>
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
          <Button variant="ghost" onClick={() => void refresh()}>
            Actualizar
          </Button>
        </div>
      ) : null}
      {!catalog && !error ? <p role="status">Cargando catálogo de permisos…</p> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((role) => (
          <article key={role.id} className="space-y-3 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <ShieldCheck className="h-5 w-5 text-teal-700" />
              <span className="text-xs text-muted-foreground">
                {role.userCount} {role.userCount === 1 ? "usuario" : "usuarios"} ·{" "}
                {role.isCustom ? "Personalizado" : "Sistema"}
              </span>
            </div>
            <h3 className="font-semibold">{role.name}</h3>
            {role.description ? (
              <p className="text-sm text-muted-foreground">{role.description}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!catalog}
                onClick={() => setEditor(role)}
              >
                {canWrite &&
                role.isCustom &&
                !role.isSystem &&
                role.userCount === 0 &&
                role.canEditPermissions
                  ? "Editar permisos"
                  : "Ver permisos"}
              </Button>
              {canWrite ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!catalog}
                  onClick={() => setEditor({ copy: role })}
                >
                  Crear copia
                </Button>
              ) : null}
              {canWrite && role.isCustom && !role.isSystem ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={role.userCount > 0}
                  onClick={() => setRemoving(role)}
                  aria-label={`Eliminar rol ${role.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              ) : null}
            </div>
            {role.isCustom && role.userCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                Este perfil está asignado. Para cambiar sus accesos, crea una copia y asígnala al
                colaborador desde Usuarios. Para eliminarlo, primero reasigna a sus usuarios.
              </p>
            ) : null}
            {!role.isCustom ? (
              <p className="text-xs text-muted-foreground">
                Los perfiles del sistema conservan sus permisos. Puedes crear una copia para
                personalizar los accesos.
              </p>
            ) : null}
          </article>
        ))}
      </div>
      {!roles.length ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          No hay roles disponibles.
        </p>
      ) : null}
      {editor && catalog ? (
        <RoleEditor
          key={editor === "new" ? "new" : "copy" in editor ? `copy:${editor.copy.id}` : editor.id}
          role={editor}
          catalog={catalog}
          canWrite={canWrite}
          scope={scope}
          current={current}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setEditor(null);
            await refresh();
          }}
        />
      ) : null}
      <Dialog
        open={!!removing}
        onOpenChange={(open) => {
          if (!open && !busy) setRemoving(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar rol {removing?.name}</DialogTitle>
            <DialogDescription>
              El rol debe estar sin usuarios asignados. Los roles del sistema se conservan.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setRemoving(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => void remove()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Eliminar rol
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
function RoleEditor({
  role,
  catalog,
  canWrite,
  scope,
  current,
  onClose,
  onSaved,
}: {
  role: Editor;
  catalog: PermissionCatalog;
  canWrite: boolean;
  scope: string;
  current: React.MutableRefObject<string>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const copy = typeof role === "object" && "copy" in role;
  const source = role === "new" ? null : copy ? role.copy : role;
  const create = role === "new" || copy;
  const [serverEditable, setServerEditable] = useState(
    create ||
      !!(
        source?.isCustom &&
        !source.isSystem &&
        source.userCount === 0 &&
        source.canEditPermissions
      ),
  );
  const editable =
    canWrite &&
    (create ||
      !!(
        source?.isCustom &&
        !source.isSystem &&
        source.userCount === 0 &&
        source.canEditPermissions
      )) &&
    serverEditable;
  const [name, setName] = useState(
    copy ? `${source?.name} (copia)`.slice(0, 80) : source?.name || "",
  );
  const [description, setDescription] = useState(source?.description || "");
  const [color, setColor] = useState(source?.color || "#0f766e");
  const [grants, setGrants] = useState<PermissionGrant[]>([]);
  const [version, setVersion] = useState(source?.permissionsVersion || 0);
  const [loading, setLoading] = useState(!!source);
  const [ready, setReady] = useState(!source);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    if (!source) return;
    let active = true;
    const abort = new AbortController();
    void getRolePermissions(source.id, abort.signal)
      .then((value) => {
        if (active && !abort.signal.aborted) {
          const delegable = new Map(
            catalog.sections.flatMap((section) => section.routes).map((route) => [route.id, route]),
          );
          setGrants(
            copy
              ? value.grants
                  .map((grant) => {
                    const route = delegable.get(grant.permissionId);
                    return {
                      ...grant,
                      actions: grant.actions.filter(
                        (action) =>
                          route &&
                          !route.adminOnly &&
                          route.actions.includes(action) &&
                          route.delegableActions.includes(action),
                      ),
                    };
                  })
                  .filter((grant) => grant.actions.length > 0)
              : value.grants,
          );
          setVersion(value.version);
          setServerEditable(create || value.canEditPermissions === true);
          setReady(true);
        }
      })
      .catch((cause) => {
        if (active) setError(userError(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      abort.abort();
    };
  }, [create, copy, source, catalog]);
  async function save() {
    if (current.current !== scope || lock.current || !editable || !name.trim() || loading || !ready)
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const input = { name: name.trim(), description: description.trim(), color, grants };
      if (create) await createCompanyRole(input);
      else if (source) await updateCompanyRole(source.id, { ...input, version });
      if (current.current === scope) await onSaved();
    } catch (cause) {
      if (current.current === scope) setError(userError(cause));
    } finally {
      lock.current = false;
      if (current.current === scope) setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="min-w-0 grid-cols-[minmax(0,1fr)] max-h-[90dvh] overflow-y-auto sm:max-w-4xl"
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {create
              ? "Crear rol personalizado"
              : `${editable ? "Editar" : "Ver"} rol · ${source?.name}`}
          </DialogTitle>
          <DialogDescription>
            Selecciona únicamente las acciones que necesita el colaborador. Las acciones protegidas
            no se pueden delegar.{" "}
            {copy ? "La copia incluye los permisos del perfil original que pueden delegarse." : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label htmlFor="role-editor-name" className="grid gap-1 text-sm">
            Nombre
            <Input
              id="role-editor-name"
              value={name}
              disabled={!editable || busy}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
            />
          </label>
          <label htmlFor="role-editor-description" className="grid gap-1 text-sm">
            Descripción
            <Input
              id="role-editor-description"
              value={description}
              disabled={!editable || busy}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={240}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Color
            <select
              value={color}
              disabled={!editable || busy}
              onChange={(event) => setColor(event.target.value)}
              className="h-10 rounded-lg border bg-background px-3"
            >
              {[
                ["#0f766e", "Verde petróleo"],
                ["#4c2fb5", "Violeta"],
                ["#b45309", "Ámbar"],
                ["#be123c", "Rosa"],
                ["#1e40af", "Azul"],
                ["#15803d", "Verde"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loading ? (
          <p role="status">Cargando permisos…</p>
        ) : (
          <PermissionMatrix
            caption="Permisos del rol"
            catalog={catalog}
            grants={grants}
            onChange={editable ? setGrants : undefined}
            disabled={busy || !editable}
          />
        )}{" "}
        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            {editable ? "Cancelar" : "Cerrar"}
          </Button>
          {editable ? (
            <Button
              disabled={busy || loading || !ready || !name.trim()}
              onClick={() => void save()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Guardar rol
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
