"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  Plus,
  Pencil,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { HeaderConfig } from "@/components/header/HeaderConfig"

/* -----------------------------------------
   Tipos
----------------------------------------- */
type SaleStatus = "PENDIENTE" | "FINALIZADA" | "CANCELADA"

interface Sale {
  id: string
  clientName: string
  date: string
  total: number
  status: SaleStatus
  paymentMethod: string
  deliveryType: string
}

/* -----------------------------------------
   Page
----------------------------------------- */
export default function VentasPage() {
  const [sales, setSales] = useState<Sale[]>([])

  /* -----------------------------------------
     Mock data (luego Axios)
  ----------------------------------------- */
  useEffect(() => {
    setSales([
      {
        id: "1",
        clientName: "Juan Pérez",
        date: "2025-01-10",
        total: 185.00,
        status: "FINALIZADA",
        paymentMethod: "Tarjeta",
        deliveryType: "Domicilio",
      },
      {
        id: "2",
        clientName: "María González",
        date: "2025-01-11",
        total: 92.50,
        status: "PENDIENTE",
        paymentMethod: "Transferencia",
        deliveryType: "Sucursal",
      },
      {
        id: "3",
        clientName: "Carlos López",
        date: "2025-01-12",
        total: 140.00,
        status: "CANCELADA",
        paymentMethod: "Efectivo",
        deliveryType: "Domicilio",
      },
    ])
  }, [])

  /* -----------------------------------------
     Helpers
  ----------------------------------------- */
  const statusVariant = (status: SaleStatus) => {
    switch (status) {
      case "FINALIZADA":
        return "success"
      case "PENDIENTE":
        return "warning"
      case "CANCELADA":
        return "destructive"
      default:
        return "secondary"
    }
  }

  const handleDelete = (id: string) => {
    // TODO: reemplazar por axios.delete(...)
    setSales((prev) => prev.filter((sale) => sale.id !== id))
  }

  return (
    <div className="flex h-screen w-full">
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <HeaderConfig
            title="Ventas"
            description="Listado de ventas registradas"
          />

          <Link href="/registrar-venta">
            <Button className="bg-teal-600 hover:bg-teal-700">
              <Plus className="h-4 w-4 mr-2" />
              Nueva venta
            </Button>
          </Link>
        </div>

        {/* Tabla */}
        <Card>
          <CardHeader>
            <CardTitle>Movimientos</CardTitle>
          </CardHeader>

          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead>Envío</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {sales.map((sale, index) => (
                  <TableRow key={sale.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">
                      {sale.clientName}
                    </TableCell>
                    <TableCell>{sale.date}</TableCell>
                    <TableCell>{sale.paymentMethod}</TableCell>
                    <TableCell>{sale.deliveryType}</TableCell>
                    <TableCell>${sale.total.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(sale.status)}>
                        {sale.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Link href={`/ventas/${sale.id}/editar`}>
                        <Button
                          size="icon"
                          variant="outline"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>

                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => handleDelete(sale.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {sales.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground py-6"
                    >
                      No hay ventas registradas
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
