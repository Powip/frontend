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
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import ClienteModal from "@/components/modals/ClienteModal";
import { Client } from "@/interfaces/ICliente";
import { toast } from "sonner";
import { findByCompany, toggleClienteActivo } from "@/api/clientes/route";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 10;

export default function ClientesPage() {
  const { auth } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Client | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (auth?.company?.id) {
      fetchClients(auth?.company?.id);
    }
  }, [auth?.company?.id]);

  const fetchClients = async (companyId: string) => {
    setLoading(true);
    try {
      const res = await findByCompany(companyId);
      if (res) setClients(res.data);
    } catch (error) {
      console.log("Error cargando clientes:", error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = clients.filter((c) => {
    const q = searchQuery.toLowerCase();

    return (
      c.fullName.toLowerCase().includes(q) ||
      (c.phoneNumber?.toLowerCase() ?? "").includes(q) ||
      c.clientType.toLowerCase().includes(q) ||
      c.id?.toLowerCase().includes(q)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedClients = filtered.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleClienteSaved = async () => {
    setOpenModal(false);
    setSelectedCliente(null);
    await fetchClients(auth!.company!.id);
  };

  const handleToggleActivo = async (cliente: Client) => {
    if (!cliente.id) return;
    try {
      const res = await toggleClienteActivo(cliente.id);
      console.log(res);

      toast.success("Cliente actualizado correctamente");
      fetchClients(auth!.company!.id);
    } catch (error) {
      toast.error("Error al actualizar cliente");
      console.error(error);
    }
  };

  const getClientTypeBadge = (type: string) => {
    const typeUpper = type.toUpperCase();
    switch (typeUpper) {
      case "VIP":
        return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">VIP</Badge>;
      case "PREMIUM":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">PREMIUM</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">TRADICIONAL</Badge>;
    }
  };

  return (
    <div className="flex h-screen  w-full overflow-hidden">
      <main className="flex-1 p-4 md:p-6 flex flex-col overflow-hidden">
        {/* Header with centered title and button on right */}
        <div className="relative mb-4">
          <div className="text-center">
            <HeaderConfig
              title="Clientes"
              description="Gestión de clientes y contactos"
            />
          </div>
          <Button
            size="sm"
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-teal-600 hover:bg-teal-700"
            onClick={() => {
              setSelectedCliente(null);
              setOpenModal(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Agregar cliente
          </Button>
        </div>

        <Card className="flex-1 overflow-hidden">
          <CardContent className="p-4 flex flex-col h-full">
            {/* Search */}
            <div className="mb-4">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o teléfono..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Table - auto height based on content */}
            <div className="rounded-md border overflow-y-auto max-h-[calc(100vh-350px)]">
              <Table className="w-full">
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="border-r w-16">N°</TableHead>
                    <TableHead className="border-r">Nombre</TableHead>
                    <TableHead className="border-r">Teléfono</TableHead>
                    <TableHead className="border-r w-24">Compras</TableHead>
                    <TableHead className="border-r">Tipo</TableHead>
                    <TableHead className="border-r w-24">Estado</TableHead>
                    <TableHead className="text-center w-28">Acciones</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    // Skeleton rows
                    [...Array(8)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="border-r"><Skeleton className="h-4 w-8" /></TableCell>
                        <TableCell className="border-r"><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell className="border-r"><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell className="border-r"><Skeleton className="h-4 w-10" /></TableCell>
                        <TableCell className="border-r"><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell className="border-r"><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-16 mx-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : paginatedClients.length > 0 ? (
                    paginatedClients.map((c, index) => (
                      <TableRow key={c.id} className="hover:bg-muted/50">
                        <TableCell className="border-r font-medium">
                          {startIndex + index + 1}
                        </TableCell>
                        <TableCell className="border-r">{c.fullName}</TableCell>
                        <TableCell className="border-r">{c.phoneNumber}</TableCell>
                        <TableCell className="border-r">16</TableCell>
                        <TableCell className="border-r">
                          {getClientTypeBadge(c.clientType)}
                        </TableCell>

                        <TableCell className="border-r">
                          <Badge 
                            className={
                              c.isActive 
                                ? "bg-green-100 text-green-700 hover:bg-green-100" 
                                : "bg-gray-100 text-gray-600 hover:bg-gray-100"
                            }
                          >
                            {c.isActive ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="flex justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setSelectedCliente(c);
                                setOpenModal(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                handleToggleActivo(c);
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
                        No se encontraron clientes.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          
          {/* Pagination - fixed at bottom */}
          {!loading && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filtered.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
              itemName="clientes"
            />
          )}
        </Card>
      </main>

      <ClienteModal
        open={openModal}
        onClose={() => {
          setOpenModal(false);
        }}
        cliente={selectedCliente}
        onClienteSaved={handleClienteSaved}
      />
    </div>
  );
}
