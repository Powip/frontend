"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, ShieldCheck, User as UserIcon } from "lucide-react";
import { hasAdminAccess } from "@/config/permissions.config";
import { useAuth } from "@/contexts/AuthContext";
import UserModal from "@/components/modals/UserModal";
import { User } from "@/interfaces/IUser";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { getUsersByCompany } from "@/services/userService";

const ITEMS_PER_PAGE = 10;

const SKELETON_ROW_KEYS = ["skeleton-1", "skeleton-2", "skeleton-3", "skeleton-4", "skeleton-5"];

export default function UsuariosPage() {
  const { auth, loading: authLoading } = useAuth();
  // Misma fuente que el resto de las páginas de empresa (auth.company, de
  // ms-company). Sin ella no hay a quién pedir GET /company/{id}/users.
  const companyId = auth?.company?.id;
  const accessToken = auth?.accessToken;
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  // Separado de `users` vacío: si la petición falla no se muestra "No se
  // encontraron usuarios", que solo corresponde a una respuesta exitosa sin filas.
  // La alerta de la tabla es el único aviso (sin toast que la repita).
  const [loadError, setLoadError] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const requestIdRef = useRef(0);

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

  const filtered = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.surname.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.identityDocument.toLowerCase().includes(q) ||
      (u.role?.name.toLowerCase() ?? "").includes(q)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  // Si una recarga trae menos páginas que la actual (p.ej. usuarios dados de
  // baja en otra sesión), se muestra la última en vez de "No se encontraron
  // usuarios" con usuarios cargados.
  const page = Math.min(currentPage, Math.max(totalPages, 1));
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedUsers = filtered.slice(startIndex, endIndex);

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

  // Sesión cargando o ausente: AuthGuard ya muestra el loader o redirige a login.
  if (authLoading || !auth) return null;

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <main className="flex-1 p-4 md:p-6 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="relative mb-4">
          <div className="text-center">
            <HeaderConfig
              title="Usuarios"
              description="Administración de acceso y perfiles de usuario"
            />
          </div>
          {companyId && (
            <Button
              size="sm"
              className="absolute right-0 top-1/2 -translate-y-1/2 bg-teal-600 hover:bg-teal-700"
              onClick={() => {
                setSelectedUser(null);
                setOpenModal(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nuevo usuario
            </Button>
          )}
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
          <Card className="flex-1 overflow-hidden">
            <CardContent className="p-4 flex flex-col h-full">
              {/* Search */}
              <div className="mb-4">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, email o documento..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="rounded-md border overflow-y-auto max-h-[calc(100vh-350px)]">
                <Table className="w-full">
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="border-r w-16">N°</TableHead>
                      <TableHead className="border-r">Nombre completo</TableHead>
                      <TableHead className="border-r">Email</TableHead>
                      <TableHead className="border-r">Documento</TableHead>
                      <TableHead className="border-r">Ubicación</TableHead>
                      <TableHead className="border-r">Rol</TableHead>
                      <TableHead className="border-r w-24">Estado</TableHead>
                      <TableHead className="text-center w-28">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {loading ? (
                      SKELETON_ROW_KEYS.map((key) => (
                        <TableRow key={key}>
                          <TableCell className="border-r"><Skeleton className="h-4 w-8" /></TableCell>
                          <TableCell className="border-r"><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell className="border-r"><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell className="border-r"><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell className="border-r"><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell className="border-r"><Skeleton className="h-5 w-24" /></TableCell>
                          <TableCell className="border-r"><Skeleton className="h-5 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-8 w-16 mx-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : loadError ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={8} className="py-6">
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
                      paginatedUsers.map((u, index) => (
                        <TableRow key={u.id} className="hover:bg-muted/50">
                          <TableCell className="border-r font-medium text-muted-foreground">
                            {startIndex + index + 1}
                          </TableCell>
                          <TableCell className="border-r">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700">
                                <UserIcon className="w-4 h-4" />
                              </div>
                              <span>{u.name} {u.surname}</span>
                            </div>
                          </TableCell>
                          <TableCell className="border-r text-muted-foreground">{u.email}</TableCell>
                          <TableCell className="border-r">{u.identityDocument}</TableCell>
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
                          colSpan={8}
                          className="text-center py-6 text-muted-foreground"
                        >
                          No se encontraron usuarios.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>

            {!loading && !loadError && (
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={filtered.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
                itemName="usuarios"
              />
            )}
          </Card>
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
