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

export type CourierType =
  | "MOTORIZADO_PROPIO"
  | "SHALOM"
  | "OLVA_COURIER"
  | "MARVISUR"
  | "FLORES"
  | "OTROS";

const COURIER_OPTIONS: { value: CourierType; label: string }[] = [
  { value: "MOTORIZADO_PROPIO", label: "Motorizado Propio" },
  { value: "SHALOM", label: "Shalom" },
  { value: "OLVA_COURIER", label: "Olva Courier" },
  { value: "MARVISUR", label: "Marvisur" },
  { value: "FLORES", label: "Flores" },
  { value: "OTROS", label: "Otros" },
];

interface CourierAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  selectedCount?: number; // Si viene, es asignación masiva
  orderNumber?: string; // Si viene, es edición individual
  currentCourier?: string | null; // Courier actual para pre-seleccionar
  onConfirm: (courier: string) => void; // Ahora acepta string (puede ser custom)
  isLoading?: boolean;
}

export default function CourierAssignmentModal({
  open,
  onClose,
  selectedCount,
  orderNumber,
  currentCourier,
  onConfirm,
  isLoading = false,
}: CourierAssignmentModalProps) {
  const [selectedCourier, setSelectedCourier] = useState<CourierType | "">("" );
  const [customCourier, setCustomCourier] = useState("");

  // Pre-seleccionar courier actual si está editando
  useEffect(() => {
    if (open && currentCourier) {
      const option = COURIER_OPTIONS.find(
        (opt) => opt.value === currentCourier || opt.label === currentCourier
      );
      if (option) {
        setSelectedCourier(option.value);
      } else {
        // Es un courier personalizado
        setSelectedCourier("OTROS");
        setCustomCourier(currentCourier);
      }
    } else {
      setSelectedCourier("");
      setCustomCourier("");
    }
  }, [open, currentCourier]);

  const handleConfirm = () => {
    const finalCourier =
      selectedCourier === "OTROS" && customCourier.trim()
        ? customCourier.trim()
        : selectedCourier;
    if (!finalCourier) return;
    onConfirm(finalCourier);
  };

  const handleClose = () => {
    setSelectedCourier("");
    setCustomCourier("");
    onClose();
  };

  const isOtros = selectedCourier === "OTROS";
  const canConfirm = selectedCourier && (!isOtros || customCourier.trim());
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
            <div className="grid grid-cols-2 gap-2">
              {COURIER_OPTIONS.map((courier) => (
                <button
                  key={courier.value}
                  type="button"
                  onClick={() => setSelectedCourier(courier.value)}
                  className={`
                    p-3 rounded-lg border text-sm font-medium transition-all
                    ${
                      selectedCourier === courier.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50 hover:bg-muted"
                    }
                  `}
                >
                  {courier.label}
                </button>
              ))}
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
