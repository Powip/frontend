'use client';

import { useState } from 'react';
import { AlertTriangle, Wrench } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OrderHeader } from '@/interfaces/IOrder';
import { RepairOrderModal } from './RepairOrderModal';

interface Props {
  orders: OrderHeader[];
  isLoading: boolean;
  onRepaired: () => void;
}

export function IncompleteOrdersTab({ orders, isLoading, onRepaired }: Props) {
  const [repairTarget, setRepairTarget] = useState<OrderHeader | null>(null);

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Cargando pedidos con errores...
      </p>
    );
  }

  if (orders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No hay pedidos con errores pendientes de corrección.
      </p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>N° Pedido</TableHead>
            <TableHead>Origen</TableHead>
            <TableHead>Cliente (parcial)</TableHead>
            <TableHead>Errores</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-mono text-sm">{order.orderNumber}</TableCell>
              <TableCell>
                <Badge variant="outline">{order.externalSource ?? '-'}</Badge>
              </TableCell>
              <TableCell>{order.customer?.fullName ?? '-'}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {order.syncErrors && Object.keys(order.syncErrors).length > 0
                    ? Object.keys(order.syncErrors).map((field) => (
                        <Badge key={field} variant="destructive" className="text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {field}
                        </Badge>
                      ))
                    : <span className="text-muted-foreground text-xs">—</span>
                  }
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(order.created_at).toLocaleDateString('es-PE')}
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRepairTarget(order)}
                >
                  <Wrench className="w-4 h-4 mr-1" />
                  Corregir
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {repairTarget && (
        <RepairOrderModal
          order={repairTarget}
          isOpen={!!repairTarget}
          onClose={() => setRepairTarget(null)}
          onRepaired={() => {
            setRepairTarget(null);
            onRepaired();
          }}
        />
      )}
    </>
  );
}
