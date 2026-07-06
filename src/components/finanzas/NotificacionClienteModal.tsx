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
import type { TableRow as ApiTableRow } from "@/api/Courier";

interface NotificacionClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ApiTableRow;
}

function fmtMoney(n: number): string {
  if (!n || n === 0) return "S/ 0";
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function buildMensaje(data: ApiTableRow): string {
  const courier = data.courierName ?? data.courier ?? "—";
  const fecha = data.date
    ? new Date(data.date).toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

  const lines: string[] = [
    `Hola! 👋 Te informamos sobre el estado de tus pedidos.`,
    ``,
    `🆔 Guía: ${data.id}`,
    `🚚 Courier: ${courier}`,
    `📦 Pedidos incluidos: ${data.pedidosCount}`,
    `📅 Fecha: ${fecha}`,
    `📊 Estado: ${data.estado}`,
  ];

  if (data.pedidosEnAgencia > 0) {
    lines.push(`🏪 En agencia (pendientes de recojo): ${data.pedidosEnAgencia}`);
  }
  if (data.pedidosReasignados > 0) {
    lines.push(`🔄 Reasignados: ${data.pedidosReasignados}`);
  }
  if (data.neto > 0) {
    lines.push(`💰 Neto: ${fmtMoney(data.neto)}`);
  }

  lines.push(``);
  lines.push(`¿Tienes alguna duda? Respondé este mensaje y te atendemos 😊`);
  lines.push(``);
  lines.push(`— Powip`);

  return lines.join("\n");
}

// WhatsApp SVG (inline — no hay icono oficial en lucide)
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export function NotificacionClienteModal({
  isOpen,
  onClose,
  data,
}: NotificacionClienteModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  const courier = data.courierName ?? data.courier ?? "—";
  const mensaje = buildMensaje(data);

  const handleEnviarWA = () => {
    const encoded = encodeURIComponent(mensaje);
    window.open(
      `https://wa.me/?text=${encoded}`,
      "_blank",
      "noopener,noreferrer",
    );
    toast.success(`Mensaje abierto para guía ${data.id}`);
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
              <WhatsAppIcon className="size-5 text-[#25D366]" />
              <DialogTitle id={titleId} className="text-xl font-bold">
                Notificar clientes — Guía {data.id}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="py-2">
            <p
              id={descriptionId}
              className="text-sm text-muted-foreground mb-3"
            >
              Vista previa del mensaje informativo que se enviará a los clientes
              de esta guía.
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
                <p className="whitespace-pre-wrap leading-snug">{mensaje}</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mt-4">
              Mensaje informativo para los{" "}
              <strong className="font-semibold text-foreground">
                {data.pedidosCount} cliente
                {data.pedidosCount !== 1 ? "s" : ""}
              </strong>{" "}
              de la guía{" "}
              <strong className="font-semibold text-foreground">
                {data.id}
              </strong>{" "}
              con <strong className="font-semibold text-foreground">{courier}</strong>.
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
              aria-label={`Enviar WhatsApp informativo para guía ${data.id}`}
            >
              <WhatsAppIcon className="h-4 w-4" />
              <span>Enviar WA ahora</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
