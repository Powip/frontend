"use client";

import React, { useId } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CobroCourierModalProps {
  isOpen: boolean;
  onClose: () => void;
  courierName: string;
  montoPendiente: string;
  diasSinRendir?: number;
}

export function CobroCourierModal({
  isOpen,
  onClose,
  courierName,
  montoPendiente,
  diasSinRendir = 5,
}: CobroCourierModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  const mensajePredeterminado = `Hola equipo ${courierName} 👋 Tienen un saldo pendiente de rendición con nosotros: 💰 Monto pendiente: ${montoPendiente}\n📋 Detalles en el sistema Powip\n\nPor favor rendan el cobro a la brevedad. Ya llevan ${diasSinRendir} días sin rendir este monto. Gracias — Corporación Aranni`;

  const handleEnviarWA = () => {
    const encoded = encodeURIComponent(mensajePredeterminado);
    window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener,noreferrer");
    toast.success(`Mensaje de WhatsApp abierto para ${courierName}`);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="sm:max-w-[500px] p-0 overflow-hidden rounded-xl border-t-4 border-t-green-500"
      >
        <div className="p-6">
          <DialogHeader className="mb-4">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="#25D366" className="size-5">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>

              <DialogTitle id={titleId} className="text-xl font-bold">
                Cobro al courier — {courierName}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="py-2">
            <p
              id={descriptionId}
              className="text-sm text-muted-foreground mb-3"
            >
              Vista previa del mensaje que se enviará por WhatsApp.
            </p>

            <div className="flex justify-end">
              <div
                className="relative max-w-md bg-green-500 dark:bg-green-900 text-white text-[13px] px-3 py-2 rounded-lg shadow-sm"
                role="region"
                aria-label="Vista previa del mensaje"
              >
                <div
                  className="absolute -top-1 right-[5px] w-3 h-3 bg-green-500 dark:bg-green-900 rotate-45"
                  aria-hidden="true"
                />

                <p className="whitespace-pre-wrap leading-snug">
                  {mensajePredeterminado}
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mt-4">
              Mensaje de cobro a{" "}
              <strong className="font-semibold text-foreground">
                {courierName}
              </strong>{" "}
              por{" "}
              <strong className="font-semibold text-foreground">
                {montoPendiente}
              </strong>{" "}
              pendiente de rendición.
            </p>
          </div>
        </div>

        <DialogFooter className="border-t bg-gray-50/50 dark:bg-muted/10 p-4 px-6 flex items-center justify-between sm:justify-between flex-row-reverse">
          <div className="flex gap-3 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              className="bg-white hover:bg-gray-50"
              aria-label="Cancelar envío del mensaje"
            >
              Cancelar
            </Button>

            <Button
              onClick={handleEnviarWA}
              className="bg-[#25D366] hover:bg-[#1ebd5b] text-white font-semibold flex items-center gap-2 shadow-sm"
              aria-label={`Enviar mensaje de WhatsApp a ${courierName} por ${montoPendiente}`}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
              <span>Enviar WA ahora</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
