"use client";

import { useState } from "react"
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Edit, Trash2 } from "lucide-react"

const initialCustomers = [
  { id: "C001", name: "Juan Pérez", email: "juan@email.com", phone: "+52 555 1234", compras: 12, estado: "Activo" },
  { id: "C002", name: "María García", email: "maria@email.com", phone: "+52 555 5678", compras: 8, estado: "Activo" },
  { id: "C003", name: "Carlos López", email: "carlos@email.com", phone: "+52 555 9012", compras: 5, estado: "Activo" },
  { id: "C004", name: "Ana Martínez", email: "ana@email.com", phone: "+52 555 3456", compras: 15, estado: "Inactivo" },
  { id: "C005", name: "Luis Rodríguez", email: "luis@email.com", phone: "+52 555 7890", compras: 2, estado: "Inactivo" },
]

export default function ClientesPage() {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredCustomers = initialCustomers.filter((customer) =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex h-screen w-full overflow-hidden">
      
      <main className="flex-1 p-4 md:p-6 flex flex-col overflow-hidden">
        
        <HeaderConfig title="Clientes" description="Gestión de clientes y contactos" />

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

              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Agregar cliente
              </Button>
            </div>

            {/* Tabla Responsiva + Full Height */}
            <div className="rounded-md border flex-1 overflow-y-auto">
              <Table className="w-full">
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Compras</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.id}</TableCell>
                        <TableCell>{customer.name}</TableCell>
                        <TableCell>{customer.email}</TableCell>
                        <TableCell>{customer.phone}</TableCell>
                        <TableCell>{customer.compras}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              customer.estado === "VIP"
                                ? "default"
                                : customer.estado === "Activo"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {customer.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
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
    </div>
  )
}
