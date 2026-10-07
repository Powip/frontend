"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Download, Mail, Plus, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import UserModal from "@/components/modals/UserModal";
import type { Role, User } from "@/interfaces/IUser";
import { getRoles, getUsersByCompany } from "@/services/userService";
import { isCompanyAssignableRole } from "@/config/userRoles";
import { UserSummaryCards } from "@/components/users/UserSummaryCards";
import { RolesCatalog, type CatalogStatus } from "@/components/users/RolesCatalog";
import { UsersTable } from "@/components/users/UsersTable";
import { UsersPagination } from "@/components/users/UsersPagination";
import { InviteUserModal } from "@/components/users/InviteUserModal";
import { CreateRoleModal } from "@/components/users/CreateRoleModal";
import { EditPermissionsModal } from "@/components/users/EditPermissionsModal";
import { DeleteUserDialog } from "@/components/users/DeleteUserDialog";
import { UserSummaryModal } from "@/components/users/UserSummaryModal";
import { ReferralsTab } from "@/components/users/referrals/ReferralsTab";
import { usersTheme } from "@/components/users/usersTheme";
import {
  ALL_ROLES_FILTER,
  NO_ROLE_FILTER,
  buildRoleOptions,
  countUsersByRole,
  filterUsers,
  paginate,
  sortUsers,
  summarizeUsers,
  type RoleOption,
  type SortDirection,
  type SortKey,
  type StatusFilter,
} from "@/services/userListing";

const PAGE_SIZES = [50, 25, 10];

type TabValue = "usuarios" | "roles" | "referidos";

const filterSelectClass =
  "rounded-[9px] border-[1.5px] border-[#e8e4f8] bg-white px-3 py-2 text-[13px] text-[#2D2A45] outline-none focus:border-[#4C2FB5] dark:border-border dark:bg-transparent dark:text-foreground";

const tabTriggerClass =
  "-mb-[2px] h-auto flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-[18px] py-[9px] text-[13px] font-semibold text-[#8b87a3] shadow-none data-[state=active]:border-[#4C2FB5] data-[state=active]:bg-transparent data-[state=active]:text-[#4C2FB5] data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent";

export default function UsuariosPage() {
  const { auth, loading: authLoading } = useAuth();
  // Misma fuente que el resto de las páginas de empresa (auth.company, de
  // ms-company). Sin ella no hay a quién pedir GET /company/{id}/users.
  const companyId = auth?.company?.id;
  const accessToken = auth?.accessToken;
  const [tab, setTab] = useState<TabValue>("usuarios");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState(ALL_ROLES_FILTER);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("login");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [exporting, setExporting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  // Separado de `users` vacío: si la petición falla no se muestra "No se
  // encontraron usuarios", que solo corresponde a una respuesta exitosa sin filas.
  // La alerta de la tabla es el único aviso (sin toast que la repita).
  const [loadError, setLoadError] = useState(false);
  const [catalog, setCatalog] = useState<Role[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>("loading");
  const [openModal, setOpenModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [permissionsRole, setPermissionsRole] = useState<RoleOption | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userSummary, setUserSummary] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const requestIdRef = useRef(0);
  const catalogRequestIdRef = useRef(0);

  const fetchUsers = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    // Sin empresa o sin token no se pide nada: el render muestra el aviso de
    // empresa ausente (o nada, si la sesión todavía carga).
    if (!companyId || !accessToken) return;

    setLoading(true);
    setLoadError(false);
    try {
      const usersData = await getUsersByCompany(companyId, accessToken);
      if (requestId !== requestIdRef.current) return;
      setUsers(usersData);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      console.error("Error al cargar usuarios:", error);
      setLoadError(true);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [companyId, accessToken]);

  useEffect(() => {
    setUsers([]);
    setSelectedIds(new Set());
    fetchUsers();
    return () => {
      requestIdRef.current += 1;
    };
  }, [fetchUsers]);

  const fetchCatalog = useCallback(async () => {
    const requestId = ++catalogRequestIdRef.current;
    if (!companyId || !accessToken) return;

    setCatalogStatus("loading");
    try {
      const rolesData = await getRoles(accessToken);
      if (requestId !== catalogRequestIdRef.current) return;
      setCatalog(Array.isArray(rolesData) ? rolesData : []);
      setCatalogStatus("ready");
    } catch {
      if (requestId !== catalogRequestIdRef.current) return;
      setCatalog([]);
      setCatalogStatus("error");
    }
  }, [companyId, accessToken]);

  useEffect(() => {
    setCatalog([]);
    fetchCatalog();
    return () => {
      catalogRequestIdRef.current += 1;
    };
  }, [fetchCatalog]);

  const usersReady = !loading && !loadError;
  const roleOptions = useMemo(() => buildRoleOptions(catalog, users), [catalog, users]);
  const catalogOptions = useMemo(
    () => roleOptions.filter((option) => option.inCatalog),
    [roleOptions],
  );
  const assignableRoles = useMemo(() => catalog.filter((role) => isCompanyAssignableRole(role.name)), [catalog]);
  const summary = useMemo(() => (usersReady ? summarizeUsers(users) : null), [usersReady, users]);
  const roleCounts = useMemo(
    () => (usersReady ? countUsersByRole(users, roleOptions) : null),
    [usersReady, users, roleOptions],
  );

  const effectiveRoleFilter =
    roleFilter === ALL_ROLES_FILTER ||
    roleFilter === NO_ROLE_FILTER ||
    roleOptions.some((option) => option.key === roleFilter)
      ? roleFilter
      : ALL_ROLES_FILTER;

  const visibleUsers = useMemo(
    () =>
      sortUsers(
        filterUsers(
          users,
          { query: searchQuery, roleKey: effectiveRoleFilter, status: statusFilter },
          roleOptions,
        ),
        sortKey,
        sortDirection,
      ),
    [users, searchQuery, effectiveRoleFilter, statusFilter, roleOptions, sortKey, sortDirection],
  );

  const selectedUsers = useMemo(
    () => sortUsers(users.filter((user) => selectedIds.has(user.id)), sortKey, sortDirection),
    [users, selectedIds, sortKey, sortDirection],
  );
  const hiddenSelected = selectedUsers.filter((user) => !visibleUsers.includes(user)).length;

  // Si una recarga trae menos páginas que la actual (p.ej. usuarios dados de
  // baja en otra sesión), se muestra la última en vez de "No se encontraron
  // usuarios" con usuarios cargados.
  const {
    items: paginatedUsers,
    currentPage: page,
    totalPages,
  } = paginate(visibleUsers, currentPage, pageSize);

  const hasActiveFilters =
    searchQuery.trim() !== "" || effectiveRoleFilter !== ALL_ROLES_FILTER || statusFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setRoleFilter(ALL_ROLES_FILTER);
    setStatusFilter("all");
    setCurrentPage(1);
  };

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const toggleUserSelection = (id: string) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const togglePageSelection = (selected: boolean) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const user of paginatedUsers) {
        if (selected) next.add(user.id);
        else next.delete(user.id);
      }
      return next;
    });

  const handleExport = async () => {
    const rows = selectedUsers.length > 0 ? selectedUsers : visibleUsers;
    setExporting(true);
    try {
      const { exportUsersToExcel } = await import("@/services/userExport");
      await exportUsersToExcel(rows);
    } catch (error) {
      console.error("Error al exportar usuarios:", error);
      toast.error("No se pudo generar el archivo de usuarios");
    } finally {
      setExporting(false);
    }
  };

  const viewUsersWithRole = (roleKey: string) => {
    setRoleFilter(roleKey);
    setSearchQuery("");
    setStatusFilter("all");
    setCurrentPage(1);
    setTab("usuarios");
  };

  const handleUserSaved = () => {
    setOpenModal(false);
    setSelectedUser(null);
    // UserForm ya informa "creado"/"actualizado" tras la respuesta de la API.
    fetchUsers();
  };

  // Activar/desactivar no se ofrece: el contrato actual de ms-auth
  // (PUT /api/v1/auth/user/{id}, UpdateUserRequest) no incluye `status`, y no
  // hay otro endpoint que lo persista. Antes la acción cambiaba solo el estado
  // local y mostraba éxito. El estado se muestra tal como lo devuelve la API.
  // Para habilitarla, ms-auth tiene que confirmar un endpoint que persista el
  // estado (p.ej. `status` en PUT /api/v1/auth/user/{id}, o un PATCH dedicado)
  // y devuelva el usuario actualizado para verificar el cambio.

  // Sesión cargando o ausente: AuthGuard ya muestra el loader o redirige a login.
  if (authLoading || !auth) return null;

  const usersTabLabel = usersReady ? `Usuarios (${users.length})` : "Usuarios";
  const rolesTabLabel = catalogStatus === "ready" ? `Roles y permisos (${catalogOptions.length})` : "Roles y permisos";
  const exportCount = selectedUsers.length > 0 ? selectedUsers.length : visibleUsers.length;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f7f6ff] dark:bg-background">
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex min-h-[54px] flex-wrap items-center gap-3 border-b border-[#e8e4f8] bg-white px-4 py-2 md:px-[22px] dark:border-border dark:bg-card">
          <h1 className="flex-1 text-[17px] font-extrabold text-[#0e0b1f] dark:text-foreground">Usuarios y Roles</h1>
          {companyId && (
            <div className="flex w-full items-center gap-[7px] rounded-[9px] border-[1.5px] border-[#e8e4f8] bg-[#f7f6ff] px-3 py-[7px] sm:w-[260px] dark:border-border dark:bg-muted">
              <Search className="h-[13px] w-[13px] shrink-0 text-[#b8b5cc]" aria-hidden="true" />
              <input
                type="search"
                aria-label="Buscar usuarios"
                placeholder="Buscar usuario..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                  setTab("usuarios");
                }}
                className="w-full bg-transparent text-[13px] outline-none placeholder:text-[#b8b5cc]"
              />
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
          {!companyId ? (
            // Sin "Reintentar": repetir la petición no sirve sin un id de empresa.
            // Puede pasar con un superadmin sin empresa o si ms-company no devolvió
            // la empresa al iniciar sesión (AuthContext deja `company` en null).
            <Card>
              <CardContent className="p-4">
                <div
                  role="status"
                  className="mx-auto max-w-lg rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
                >
                  <p className="font-medium">No tienes una empresa asociada.</p>
                  <p className="mt-1 text-xs">
                    Esta sección muestra los usuarios de tu empresa. Si tu cuenta
                    debería tener una, cerrá sesión y volvé a ingresar; si sigue
                    sin aparecer, verificá con un administrador.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Tabs value={tab} onValueChange={(value) => setTab(value as TabValue)} className="gap-5">
              <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b-2 border-[#e8e4f8] bg-transparent p-0 dark:border-border">
                <TabsTrigger value="usuarios" className={tabTriggerClass}>
                  <span aria-hidden="true">👥</span> {usersTabLabel}
                </TabsTrigger>
                <TabsTrigger value="roles" className={tabTriggerClass}>
                  <span aria-hidden="true">🔑</span> {rolesTabLabel}
                </TabsTrigger>
                <TabsTrigger value="referidos" className={tabTriggerClass}>
                  <span aria-hidden="true">🎁</span> Referidos y cobro
                </TabsTrigger>
              </TabsList>

              <TabsContent value="usuarios">
                <UserSummaryCards summary={summary} loading={loading} />

                <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    className={usersTheme.primaryButton}
                    onClick={() => {
                      setSelectedUser(null);
                      setOpenModal(true);
                    }}
                  >
                    <Plus className="h-[13px] w-[13px]" aria-hidden="true" />
                    Nuevo usuario
                  </button>
                  <button type="button" className={usersTheme.secondaryButton} onClick={() => setInviteOpen(true)}>
                    <Mail className="h-[13px] w-[13px]" aria-hidden="true" />
                    Invitar por email
                  </button>
                  <select
                    aria-label="Filtrar por rol"
                    value={effectiveRoleFilter}
                    onChange={(e) => {
                      setRoleFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className={filterSelectClass}
                  >
                    <option value={ALL_ROLES_FILTER}>Todos los roles</option>
                    {roleOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                    <option value={NO_ROLE_FILTER}>Sin rol</option>
                  </select>
                  <select
                    aria-label="Filtrar por estado"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value as StatusFilter);
                      setCurrentPage(1);
                    }}
                    className={filterSelectClass}
                  >
                    <option value="all">Todos los estados</option>
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                  <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                    {selectedUsers.length > 0 && (
                      <p className="text-xs text-[#8b87a3]" aria-live="polite">
                        {selectedUsers.length === 1 ? "1 seleccionado" : `${selectedUsers.length} seleccionados`}
                        {hiddenSelected > 0 && ` (${hiddenSelected} oculto${hiddenSelected === 1 ? "" : "s"} por los filtros)`}
                        {" · "}
                        <button
                          type="button"
                          className="font-semibold text-[#4C2FB5] underline-offset-2 hover:underline"
                          onClick={() => setSelectedIds(new Set())}
                        >
                          Limpiar selección
                        </button>
                      </p>
                    )}
                    <button
                      type="button"
                      className={usersTheme.secondaryButton}
                      disabled={!usersReady || exporting || exportCount === 0}
                      onClick={handleExport}
                    >
                      <Download className="h-[13px] w-[13px]" aria-hidden="true" />
                      {selectedUsers.length > 0 ? `Exportar seleccionados (${selectedUsers.length})` : "Exportar"}
                    </button>
                  </div>
                </div>

                <div className={`${usersTheme.card} overflow-hidden`}>
                  <UsersTable
                    users={paginatedUsers}
                    loading={loading}
                    loadError={loadError}
                    onRetry={() => fetchUsers()}
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    selectedIds={selectedIds}
                    onToggleUser={toggleUserSelection}
                    onTogglePage={togglePageSelection}
                    emptyAction={
                      hasActiveFilters && users.length > 0 ? (
                        <button
                          type="button"
                          className="mt-1 text-xs font-semibold text-[#4C2FB5] underline-offset-2 hover:underline"
                          onClick={clearFilters}
                        >
                          Limpiar filtros
                        </button>
                      ) : undefined
                    }
                    onEdit={(user) => {
                      setSelectedUser(user);
                      setOpenModal(true);
                    }}
                    onDelete={setUserToDelete}
                    onSummary={setUserSummary}
                  />
                  {usersReady && (
                    <UsersPagination
                      currentPage={page}
                      totalPages={totalPages}
                      totalItems={visibleUsers.length}
                      pageSize={pageSize}
                      pageSizes={PAGE_SIZES}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={(size) => {
                        setPageSize(size);
                        setCurrentPage(1);
                      }}
                    />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="roles">
                <RolesCatalog
                  status={catalogStatus}
                  roles={catalogOptions}
                  counts={roleCounts}
                  usersLoading={loading}
                  onRetry={() => fetchCatalog()}
                  onViewUsers={viewUsersWithRole}
                  onCreateRole={() => setCreateRoleOpen(true)}
                  onEditPermissions={setPermissionsRole}
                />
              </TabsContent>

              <TabsContent value="referidos">
                <ReferralsTab />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>

      <UserModal
        open={openModal}
        onClose={() => {
          setOpenModal(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        onUserSaved={handleUserSaved}
      />
      <InviteUserModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        roles={assignableRoles}
        rolesReady={catalogStatus === "ready" && assignableRoles.length > 0}
      />
      <CreateRoleModal open={createRoleOpen} onOpenChange={setCreateRoleOpen} />
      <EditPermissionsModal role={permissionsRole} onOpenChange={(open) => !open && setPermissionsRole(null)} />
      <DeleteUserDialog user={userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)} />
      <UserSummaryModal user={userSummary} onOpenChange={(open) => !open && setUserSummary(null)} />
    </div>
  );
}
