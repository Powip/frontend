'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OrderHeader } from '@/interfaces/IOrder';
import { repairOrder } from '@/services/incompleteOrdersService';

interface Props {
  order: OrderHeader;
  isOpen: boolean;
  onClose: () => void;
  onRepaired: () => void;
}

export function RepairOrderModal({ order, isOpen, onClose, onRepaired }: Props) {
  const queryClient = useQueryClient();
  const syncErrors = order.syncErrors ?? {};

  const [fullName,    setFullName]    = useState(order.customer?.fullName     ?? '');
  const [phoneNumber, setPhoneNumber] = useState(order.customer?.phoneNumber  ?? '');
  const [province,    setProvince]    = useState(order.customer?.province     ?? '');
  const [city,        setCity]        = useState(order.customer?.city         ?? '');
  const [district,    setDistrict]    = useState(order.customer?.district     ?? '');
  const [address,     setAddress]     = useState(order.customer?.address      ?? '');
  const [showRawData, setShowRawData] = useState(false);

  const isFieldError = (field: string) =>
    Object.keys(syncErrors).some((k) => k.toLowerCase().includes(field.toLowerCase()));

  const { mutate: doRepair, isPending } = useMutation({
    mutationFn: () =>
      repairOrder(order.id, {
        customer: { fullName, phoneNumber, province, city, district, address },
      }),
    onSuccess: () => {
      toast.success(`Pedido ${order.orderNumber} movido a PREVENTA`);
      queryClient.invalidateQueries({ queryKey: ['orders', 'incomplete'] });
      onRepaired();
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al guardar la corrección';
      toast.error(message);
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Corregir pedido — {order.orderNumber}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Origen: <span className="font-medium">{order.externalSource}</span>
          </p>
        </DialogHeader>

        <div className="border rounded-md p-3 bg-muted/40">
          <button
            type="button"
            className="flex items-center gap-2 text-sm font-medium w-full text-left"
            onClick={() => setShowRawData((p) => !p)}
          >
            {showRawData ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Datos originales recibidos (solo lectura)
          </button>
          {showRawData && (
            <pre className="text-xs mt-2 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(order.externalData, null, 2)}
            </pre>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="col-span-2">
            <Label className={isFieldError('fullName') || isFieldError('customer_name') ? 'text-destructive' : ''}>
              Nombre completo *
            </Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={isFieldError('fullName') || isFieldError('customer_name') ? 'border-destructive' : ''}
            />
            {(isFieldError('fullName') || isFieldError('customer_name')) && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {syncErrors['fullName'] ?? syncErrors['customer_name'] ?? syncErrors['customerName'] ?? 'Campo inválido'}
              </p>
            )}
          </div>

          <div className="col-span-2">
            <Label className={isFieldError('phoneNumber') || isFieldError('phone') ? 'text-destructive' : ''}>
              Teléfono *
            </Label>
            <Input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className={isFieldError('phoneNumber') || isFieldError('phone') ? 'border-destructive' : ''}
            />
            {(isFieldError('phoneNumber') || isFieldError('phone')) && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {syncErrors['phoneNumber'] ?? syncErrors['phone'] ?? 'Campo inválido'}
              </p>
            )}
          </div>

          <div className="col-span-2">
            <Label className={isFieldError('address') ? 'text-destructive' : ''}>Dirección</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={isFieldError('address') ? 'border-destructive' : ''}
            />
            {isFieldError('address') && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {syncErrors['address'] ?? 'Campo inválido'}
              </p>
            )}
          </div>

          <div>
            <Label>Ciudad</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>

          <div>
            <Label>Distrito</Label>
            <Input value={district} onChange={(e) => setDistrict(e.target.value)} />
          </div>

          <div className="col-span-2">
            <Label>Provincia</Label>
            <Input value={province} onChange={(e) => setProvince(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={() => doRepair()} disabled={isPending}>
            {isPending ? 'Guardando...' : 'Guardar como PREVENTA'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
