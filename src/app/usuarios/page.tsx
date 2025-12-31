"use client";

import { useEffect, useState } from "react";
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
import { Plus, Search, Edit, Trash2, ShieldCheck, User as UserIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import UserModal from "@/components/modals/UserModal";
import { User } from "@/interfaces/IUser";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { getUsersByCompany } from "@/services/userService";

const ITEMS_PER_PAGE = 10;

export default function UsuariosPage() {
  const { auth } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchUsers = async () => {
    if (!auth?.company?.id || !auth?.accessToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const usersData = await getUsersByCompany(auth.company.id, auth.accessToken);
      setUsers(usersData);
    } catch (error) {
      console.error("Error al cargar usuarios:", error);
      toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [auth?.company?.id, auth?.accessToken]);

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
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedUsers = filtered.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleUserSaved = () => {
    setOpenModal(false);
    setSelectedUser(null);
    fetchUsers(); // Refrescar lista de usuarios
    toast.success("Usuario guardado correctamente");
  };

  const handleToggleStatus = (user: User) => {
    setUsers(prev => prev.map(u =>
      u.id === user.id ? { ...u, status: !u.status } : u
    ));
    toast.success(`Usuario ${user.status ? 'desactivado' : 'activado'} correctamente`);
  };

  const getRoleBadge = (roleName?: string) => {
    const name = roleName?.toUpperCase() || "SIN ROL";
    switch (name) {
      case "ADMIN":
        return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 gap-1"><ShieldCheck className="w-3 h-3" /> ADMIN</Badge>;
      case "VENDEDOR":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">AGENTE</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">{name}</Badge>;
    }
  };

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
        </div>

        <Card className="flex-1 overflow-hidden">
          <CardContent className="p-4 flex flex-col h-full">
            {/* Search */}
            <div className="mb-4">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, email o documento..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
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
                          {u.district}, {u.province}
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
                              onClick={() => {
                                setSelectedUser(u);
                                setOpenModal(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:text-red-600"
                              onClick={() => {
                                handleToggleStatus(u);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={7}
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

          {!loading && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filtered.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
              itemName="usuarios"
            />
          )}
        </Card>
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
