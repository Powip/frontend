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
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import ClienteModal from "@/components/modals/ClienteModal";
import { Cliente } from "@/interfaces/ICliente";
import { toast } from "sonner";
import { findByCompany, toggleClienteActivo } from "@/api/clientes/route";

export default function ClientesPage() {
  const { auth } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [clients, setClients] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);

  useEffect(() => {
    if (auth?.company?.id) {
      fetchClients(auth?.company?.id);
    }
  }, [auth?.company?.id]);

  const fetchClients = async (companyId: string) => {
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
      c.phoneNumber.toLowerCase().includes(q) ||
      c.clientType.toLowerCase().includes(q) ||
      c.id?.toLowerCase().includes(q)
    );
  });

  const handleClienteSaved = async () => {
    setOpenModal(false);
    setSelectedCliente(null);
    await fetchClients(auth!.company!.id);
  };

  const handleToggleActivo = async (cliente: Cliente) => {
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

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <main className="flex-1 p-4 md:p-6 flex flex-col overflow-hidden">
        <HeaderConfig
          title="Clientes"
          description="Gestión de clientes y contactos"
        />

        <Card className="mt-4 flex-1 overflow-hidden">
          <CardContent className="p-4 flex flex-col h-full">
            {/* Filtro + Acción */}
            <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar clientes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Button
                size="sm"
                onClick={() => {
                  setSelectedCliente(null);
                  setOpenModal(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Agregar cliente
              </Button>
            </div>

            {/* Tabla Responsiva + Full Height */}
            <div className="rounded-md border flex-1 overflow-y-auto">
              <Table className="w-full">
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>N°</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Compras</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6">
                        Cargando clientes...
                      </TableCell>
                    </TableRow>
                  ) : filtered.length > 0 ? (
                    filtered.map((c, index) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {index + 1}
                        </TableCell>
                        <TableCell>{c.fullName}</TableCell>
                        <TableCell>{c.phoneNumber}</TableCell>
                        <TableCell>16</TableCell>
                        <TableCell>{c.clientType}</TableCell>

                        <TableCell>
                          <Badge variant={c.isActive ? "secondary" : "outline"}>
                            {c.isActive ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
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
                        colSpan={6}
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
