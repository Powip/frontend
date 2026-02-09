"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Truck } from "lucide-react";
import { fetchCouriers, Courier } from "@/services/courierService";
import { useAuth } from "@/contexts/AuthContext";

interface CourierAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  selectedCount?: number; // Si viene, es asignación masiva
  orderNumber?: string; // Si viene, es edición individual
  currentCourier?: string | null; // Courier actual para pre-seleccionar
  currentCourierId?: string | null; // ID de courier actual
  onConfirm: (courier: string, courierId?: string) => void; // Acepta nombre e ID
  isLoading?: boolean;
}

export default function CourierAssignmentModal({
  open,
  onClose,
  selectedCount,
  orderNumber,
  currentCourier,
  currentCourierId,
  onConfirm,
  isLoading = false,
}: CourierAssignmentModalProps) {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;

  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [selectedCourierId, setSelectedCourierId] = useState<string>("");
  const [customCourier, setCustomCourier] = useState("");

  // Cargar couriers
  useEffect(() => {
    if (open && companyId) {
      fetchCouriers(companyId).then(setCouriers).catch(console.error);
    }
  }, [open, companyId]);

  // Pre-seleccionar courier actual si está editando
  useEffect(() => {
    if (open) {
      if (currentCourierId) {
        setSelectedCourierId(currentCourierId);
      } else if (currentCourier) {
        // Buscar por nombre si no hay ID
        const existing = couriers.find((c) => c.name === currentCourier);
        if (existing) {
          setSelectedCourierId(existing.id);
        } else {
          // Caso legacy o manual
          if (
            [
              "MOTORIZADO_PROPIO",
              "SHALOM",
              "OLVA_COURIER",
              "MARVISUR",
              "FLORES",
            ].includes(currentCourier)
          ) {
            setSelectedCourierId(currentCourier);
          } else {
            setSelectedCourierId("OTROS");
            setCustomCourier(currentCourier);
          }
        }
      }
    } else {
      setSelectedCourierId("");
      setCustomCourier("");
    }
  }, [open, currentCourier, currentCourierId, couriers]);

  const handleConfirm = () => {
    if (selectedCourierId === "OTROS") {
      if (customCourier.trim()) {
        onConfirm(customCourier.trim());
      }
    } else {
      const selected = couriers.find((c) => c.id === selectedCourierId);
      if (selected) {
        onConfirm(selected.name, selected.id);
      } else if (selectedCourierId) {
        // Caso MOTORIZADO_PROPIO u otros legacy que no están en la lista dinámica
        onConfirm(selectedCourierId);
      }
    }
  };

  const handleClose = () => {
    setSelectedCourierId("");
    setCustomCourier("");
    onClose();
  };

  const isOtros = selectedCourierId === "OTROS";
  const canConfirm =
    selectedCourierId &&
    (selectedCourierId !== "OTROS" || customCourier.trim());
  const isBulk = selectedCount !== undefined;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            {isBulk
              ? "Asignar Repartidor"
              : `Editar Courier - Orden #${orderNumber}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isBulk && (
            <div className="bg-primary/10 text-primary rounded-lg p-3 text-sm">
              <p className="font-medium">
                {selectedCount === 1
                  ? "Se asignará el courier a 1 pedido seleccionado"
                  : `Se asignará el courier a ${selectedCount} pedidos seleccionados`}
              </p>
              <p className="mt-1 text-muted-foreground">
                Los pedidos cambiarán automáticamente al estado EN_ENVIO.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="courier">Seleccione el courier *</Label>
            <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-1">
              {couriers.map((courier) => (
                <button
                  key={courier.id}
                  type="button"
                  onClick={() => setSelectedCourierId(courier.id)}
                  className={`
                    p-3 rounded-lg border text-sm font-medium transition-all
                    ${
                      selectedCourierId === courier.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50 hover:bg-muted"
                    }
                  `}
                >
                  {courier.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedCourierId("MOTORIZADO_PROPIO")}
                className={`
                  p-3 rounded-lg border text-sm font-medium transition-all
                  ${
                    selectedCourierId === "MOTORIZADO_PROPIO"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50 hover:bg-muted"
                  }
                `}
              >
                Motorizado Propio
              </button>
              <button
                type="button"
                onClick={() => setSelectedCourierId("OTROS")}
                className={`
                  p-3 rounded-lg border text-sm font-medium transition-all
                  ${
                    selectedCourierId === "OTROS"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50 hover:bg-muted"
                  }
                `}
              >
                Otros
              </button>
            </div>
          </div>

          {isOtros && (
            <div className="space-y-2">
              <Label htmlFor="customCourier">Nombre del Courier *</Label>
              <Input
                id="customCourier"
                value={customCourier}
                onChange={(e) => setCustomCourier(e.target.value)}
                placeholder="Ingrese el nombre del courier..."
                autoFocus
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm || isLoading}>
            {isLoading
              ? "Procesando..."
              : isBulk
                ? "Asignar y Despachar"
                : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
