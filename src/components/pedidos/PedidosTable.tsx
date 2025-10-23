import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Ellipsis } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { IOrder } from "@/interfaces/IOrder";

export default function PedidosTable({ pedidos }: { pedidos: IOrder[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const router = useRouter();

  // ✅ manejar selección individual
  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // ✅ manejar selección total
  const toggleSelectAll = () => {
    if (selected.length === pedidos.length) {
      setSelected([]);
    } else {
      setSelected(pedidos.map((p) => p.id));
    }
  };
  return (
    <div className="space-y-2">
      {/* ✅ contador de seleccionados */}
      {selected.length > 0 && (
        <div className="text-sm text-gray-600 px-2">
          {selected.length} pedido{selected.length > 1 ? "s" : ""} seleccionado
          {selected.length > 1 ? "s" : ""}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <input
                type="checkbox"
                checked={
                  selected.length === pedidos.length && pedidos.length > 0
                }
                onChange={toggleSelectAll}
              />
            </TableHead>
            <TableHead>Fecha Venta</TableHead>
            <TableHead>Fecha Entrega</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Tag</TableHead>
            <TableHead>Estado de Pago</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Vendedor</TableHead>
            <TableHead>Courier</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {pedidos.map((p) => (
            <TableRow
              key={p.id}
              className={selected.includes(p.id) ? "bg-lime-50" : ""}
            >
              <TableCell>
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={() => toggleSelect(p.id)}
                />
              </TableCell>
              <TableCell>{p.dateVta}</TableCell>
              <TableCell>{p.dateEntrega}</TableCell>
              <TableCell>{p.status}</TableCell>
              <TableCell>{p.tag}</TableCell>
              <TableCell>{p.estadoPago}</TableCell>
              <TableCell>{p.telefono}</TableCell>
              <TableCell>{p.cliente}</TableCell>
              <TableCell>{p.vendedor}</TableCell>
              <TableCell>{p.courier}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="table" size="icon" className="bg-lime">
                      <Ellipsis />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent className="bg-gray-100 rounded-md shadow-md p-2 w-48">
                    <DropdownMenuItem
                      onClick={() => router.push(`/pedidos/${p.id}/edit`)}
                    >
                      Editar Pedido
                    </DropdownMenuItem>
                    <DropdownMenuItem>Link Cliente</DropdownMenuItem>
                    <DropdownMenuItem>WhatsApp Cliente</DropdownMenuItem>
                    <DropdownMenuItem>Generar Factura</DropdownMenuItem>
                    <DropdownMenuItem>Actualizar Envío</DropdownMenuItem>
                    <DropdownMenuItem>Reembolso</DropdownMenuItem>
                    <DropdownMenuItem>Cancelar Pedido</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
