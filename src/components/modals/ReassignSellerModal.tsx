"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useVendedores } from "@/hooks/useVendedores";

interface ReassignSellerModalProps {
  open: boolean;
  onClose: () => void;
  orderNumber: string;
  currentSellerName: string | null;
  companyId: string;
  onConfirm: (sellerId: string, sellerName: string) => Promise<void>;
  isLoading?: boolean;
}

export default function ReassignSellerModal({
  open,
  onClose,
  orderNumber,
  currentSellerName,
  companyId,
  onConfirm,
  isLoading = false,
}: ReassignSellerModalProps) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: vendedores = [], isLoading: loadingVendedores } =
    useVendedores(companyId);

  const selectedVendedor = vendedores.find((v) => v.id === selectedId);

  const handleSave = () => {
    if (!selectedId || !selectedVendedor) return;
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!selectedVendedor) return;
    setConfirmOpen(false);
    await onConfirm(selectedVendedor.id, selectedVendedor.nombre ?? selectedVendedor.email ?? selectedVendedor.id);
  };

  const handleClose = () => {
    setSelectedId("");
    setConfirmOpen(false);
    onClose();
  };

  return (
    <>
      <Dialog open={open && !confirmOpen} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reasignar vendedor</DialogTitle>
            <DialogDescription>
              Seleccioná el nuevo vendedor para este pedido.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground">
              Pedido <span className="font-medium text-foreground">{orderNumber}</span>
              {currentSellerName && (
                <> — vendedor actual: <span className="font-medium text-foreground">{currentSellerName}</span></>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendedor-select">Nuevo vendedor</Label>
              {loadingVendedores ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando usuarios…
                </div>
              ) : (
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger id="vendedor-select">
                    <SelectValue placeholder="Seleccioná un vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendedores.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.nombre ?? v.email ?? v.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!selectedId || isLoading || loadingVendedores}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar cambio de vendedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a reasignar el pedido <strong>{orderNumber}</strong> al vendedor{" "}
              <strong>{selectedVendedor?.nombre ?? selectedVendedor?.email}</strong>.
              {currentSellerName && (
                <> El vendedor anterior era <strong>{currentSellerName}</strong>.</>
              )}{" "}
              Esta acción queda registrada en el historial del pedido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Confirmar cambio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
