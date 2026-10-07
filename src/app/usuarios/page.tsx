"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Search, Edit, ShieldCheck } from "lucide-react";
import { hasAdminAccess } from "@/config/permissions.config";
import { useAuth } from "@/contexts/AuthContext";
import UserModal from "@/components/modals/UserModal";
import type { Role, User } from "@/interfaces/IUser";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { getRoles, getUsersByCompany } from "@/services/userService";
import { UserSummaryCards } from "@/components/users/UserSummaryCards";
import { RolesCatalog, type CatalogStatus } from "@/components/users/RolesCatalog";
import {
  ALL_ROLES_FILTER,
  NO_ROLE_FILTER,
  buildRoleOptions,
  countUsersByRole,
  filterUsers,
  paginate,
  sortUsers,
  summarizeUsers,
  type SortDirection,
  type SortKey,
  type StatusFilter,
} from "@/services/userListing";

const PAGE_SIZES = [10, 25, 50];

const SKELETON_ROW_KEYS = ["skeleton-1", "skeleton-2", "skeleton-3", "skeleton-4", "skeleton-5"];

const COLUMN_COUNT = 10;

type TabValue = "usuarios" | "roles";

const SORTABLE_COLUMNS: Record<SortKey, string> = {
  name: "Nombre",
  surname: "Apellido",
  email: "Email",
  status: "Estado",
};

const initialsOf = (user: User) => {
  const initials = `${user.name?.trim()[0] ?? ""}${user.surname?.trim()[0] ?? ""}`;
  return (initials || user.email?.trim()[0] || "?").toUpperCase();
};

const orDash = (value?: string | null) => value?.trim() || "—";

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
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
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

  // Mismo criterio de "admin de empresa" que el acceso a esta ruta
  // (hasAdminAccess); el nombre se muestra tal como lo devuelve ms-auth.
  const getRoleBadge = (roleName?: string) => {
    const name = roleName?.toUpperCase() || "SIN ROL";
    if (hasAdminAccess(roleName)) {
      return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 gap-1"><ShieldCheck className="w-3 h-3" /> {name}</Badge>;
    }
    return <Badge variant="outline" className="text-muted-foreground">{name}</Badge>;
  };

  const renderSortableHead = (key: SortKey) => {
    const active = sortKey === key;
    const Icon = !active ? ArrowUpDown : sortDirection === "asc" ? ArrowUp : ArrowDown;
    return (
      <TableHead
        className="border-r whitespace-nowrap"
        aria-sort={active ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
      >
        <button
          type="button"
          className="inline-flex items-center gap-1 font-medium hover:text-foreground"
          onClick={() => toggleSort(key)}
        >
          {SORTABLE_COLUMNS[key]}
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </TableHead>
    );
  };

  // Sesión cargando o ausente: AuthGuard ya muestra el loader o redirige a login.
  if (authLoading || !auth) return null;

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <main className="flex-1 p-4 md:p-6 flex flex-col overflow-y-auto">
        <div className="mb-4 text-center">
          <HeaderConfig
            title="Usuarios"
            description="Administración de acceso y perfiles de usuario"
          />
        </div>

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
          <Tabs value={tab} onValueChange={(value) => setTab(value as TabValue)} className="gap-4">
            <TabsList>
              <TabsTrigger value="usuarios" className="px-4">Usuarios</TabsTrigger>
              <TabsTrigger value="roles" className="px-4">Roles</TabsTrigger>
            </TabsList>

            <TabsContent value="usuarios" className="space-y-4">
              <UserSummaryCards summary={summary} loading={loading} />

              <Card className="gap-0 py-0">
                <CardContent className="p-4 space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="relative w-full lg:max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        aria-label="Buscar usuarios"
                        placeholder="Buscar por nombre, email, documento, teléfono, rol o distrito"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="pl-9"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex">
                      <Select
                        value={effectiveRoleFilter}
                        onValueChange={(value) => {
                          setRoleFilter(value);
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger id="role-filter" aria-label="Filtrar por rol" className="w-full lg:w-52">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL_ROLES_FILTER}>Todos los roles</SelectItem>
                          {roleOptions.map((option) => (
                            <SelectItem key={option.key} value={option.key}>
                              {option.label}
                            </SelectItem>
                          ))}
                          <SelectItem value={NO_ROLE_FILTER}>Sin rol</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={statusFilter}
                        onValueChange={(value) => {
                          setStatusFilter(value as StatusFilter);
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger id="status-filter" aria-label="Filtrar por estado" className="w-full lg:w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los estados</SelectItem>
                          <SelectItem value="active">Activos</SelectItem>
                          <SelectItem value="inactive">Inactivos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      size="sm"
                      className="bg-teal-600 hover:bg-teal-700 lg:ml-auto"
                      onClick={() => {
                        setSelectedUser(null);
                        setOpenModal(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Nuevo usuario
                    </Button>
                  </div>

                  <div className="rounded-md border overflow-x-auto">
                    <Table className="min-w-[1080px]">
                      <TableHeader className="bg-background">
                        <TableRow>
                          {renderSortableHead("name")}
                          {renderSortableHead("surname")}
                          {renderSortableHead("email")}
                          <TableHead className="border-r">Documento</TableHead>
                          <TableHead className="border-r">Teléfono</TableHead>
                          <TableHead className="border-r">Dirección</TableHead>
                          <TableHead className="border-r">Ubicación</TableHead>
                          <TableHead className="border-r">Rol</TableHead>
                          {renderSortableHead("status")}
                          <TableHead className="text-center w-20">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {loading ? (
                          SKELETON_ROW_KEYS.map((key) => (
                            <TableRow key={key}>
                              {Array.from({ length: COLUMN_COUNT }, (_, column) => `${key}-${column}`).map((cellKey) => (
                                <TableCell key={cellKey} className="border-r last:border-r-0">
                                  <Skeleton className="h-4 w-full max-w-28" />
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : loadError ? (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={COLUMN_COUNT} className="py-6">
                              <div
                                role="alert"
                                className="mx-auto flex max-w-md items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                              >
                                <span>No se pudieron cargar los usuarios.</span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => fetchUsers()}
                                >
                                  Reintentar
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : paginatedUsers.length > 0 ? (
                          paginatedUsers.map((u) => (
                            <TableRow key={u.id} className="hover:bg-muted/50">
                              <TableCell className="border-r">
                                <div className="flex items-center gap-2">
                                  <div
                                    aria-hidden="true"
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-700"
                                  >
                                    {initialsOf(u)}
                                  </div>
                                  <span className="font-medium">{orDash(u.name)}</span>
                                </div>
                              </TableCell>
                              <TableCell className="border-r">{orDash(u.surname)}</TableCell>
                              <TableCell className="border-r text-muted-foreground">{orDash(u.email)}</TableCell>
                              <TableCell className="border-r">{orDash(u.identityDocument)}</TableCell>
                              <TableCell className="border-r whitespace-nowrap">{orDash(u.phoneNumber)}</TableCell>
                              <TableCell className="border-r max-w-48 truncate" title={u.address || undefined}>
                                {orDash(u.address)}
                              </TableCell>
                              <TableCell className="border-r text-xs text-muted-foreground whitespace-nowrap">
                                {[u.district, u.province].filter(Boolean).join(", ") || "—"}
                              </TableCell>
                              <TableCell className="border-r">
                                {getRoleBadge(u.role?.name)}
                              </TableCell>
                              <TableCell className="border-r">
                                <Badge
                                  className={
                                    u.status
                                      ? "bg-green-100 text-green-700 hover:bg-green-100"
                                      : "bg-gray-100 text-gray-600 hover:bg-gray-100"
                                  }
                                >
                                  {u.status ? "Activo" : "Inactivo"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    aria-label={`Editar ${u.name} ${u.surname}`}
                                    onClick={() => {
                                      setSelectedUser(u);
                                      setOpenModal(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={COLUMN_COUNT}
                              className="text-center py-6 text-muted-foreground"
                            >
                              <p>No se encontraron usuarios.</p>
                              {hasActiveFilters && users.length > 0 && (
                                <Button
                                  type="button"
                                  variant="link"
                                  size="sm"
                                  onClick={clearFilters}
                                >
                                  Limpiar filtros
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>

                {!loading && !loadError && (
                  <div className="flex flex-col gap-2 border-t px-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2 pt-3 sm:pt-0">
                      <span className="text-sm text-muted-foreground">Filas por página</span>
                      <Select
                        value={String(pageSize)}
                        onValueChange={(value) => {
                          setPageSize(Number(value));
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger id="page-size" aria-label="Filas por página" className="h-8 w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_SIZES.map((size) => (
                            <SelectItem key={size} value={String(size)}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-0 flex-1 overflow-x-auto [&>div]:border-t-0">
                      <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        totalItems={visibleUsers.length}
                        itemsPerPage={pageSize}
                        onPageChange={setCurrentPage}
                        itemName="usuarios"
                      />
                    </div>
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="roles">
              <RolesCatalog
                status={catalogStatus}
                roles={catalogOptions}
                counts={roleCounts}
                usersLoading={loading}
                onRetry={() => fetchCatalog()}
                onViewUsers={viewUsersWithRole}
              />
            </TabsContent>
          </Tabs>
        )}
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
    </div>
  );
}
