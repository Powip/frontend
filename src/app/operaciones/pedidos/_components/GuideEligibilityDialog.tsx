"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Sale } from "./types";
import {
  deliveryTypeLabel,
  getGuideBlockReason,
  guideBlockReasonLabel,
  splitGuideEligibility,
} from "./guideEligibility";

const EDIT_LABEL = "Abrir venta para editar entrega";
const EDIT_HINT =
  "Se abre la venta en Registrar venta. Al guardar, volverás a Por Despachar con tu selección para revisar la generación de guía; si volvés sin guardar, no se aplica ningún cambio.";

/**
 * Revisión previa a "Generar guía" cuando la selección tiene pedidos
 * bloqueados. Nunca genera la guía por su cuenta ni cambia la modalidad de
 * entrega: muestra el motivo de cada bloqueo, deriva la edición al
 * formulario de la venta (`onEditDeliveryType`) y deja continuar de forma
 * explícita con los elegibles (`onContinue`).
 *
 * `sales` llega siempre resuelto contra los datos actuales. `updatedOrderId`
 * = pedido que se acaba de guardar en /registrar-venta (solo tras éxito).
 */
export function GuideEligibilityDialog({
  open,
  sales,
  updatedOrderId = null,
  onClose,
  onContinue,
  onEditDeliveryType,
}: {
  open: boolean;
  sales: Sale[];
  updatedOrderId?: string | null;
  onClose: () => void;
  onContinue: (eligible: Sale[]) => void;
  onEditDeliveryType: (sale: Sale) => void;
}) {
  const { eligible, blocked } = splitGuideEligibility(sales);
  const single = sales.length === 1 ? sales[0] : null;
  const singleBlock = single ? blocked[0] : undefined;
  const updated = updatedOrderId
    ? sales.find((s) => s.id === updatedOrderId)
    : undefined;
  const hasPickup = blocked.some((b) => b.reason === "PICKUP_IN_STORE");

  const content = (() => {
    // Caso 1: un solo pedido, configurado como retiro en tienda.
    if (single && singleBlock?.reason === "PICKUP_IN_STORE") {
      return (
        <>
          <DialogHeader>
            <DialogTitle>
              {updated
                ? "El pedido sigue configurado como retiro en tienda"
                : "Este pedido está configurado como retiro en tienda"}
            </DialogTitle>
            <DialogDescription>
              El pedido {single.orderNumber} no puede generar una guía porque
              su tipo de entrega es “Retiro en tienda”. Si necesita un envío,
              podés editar el tipo de entrega.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            Tipo de entrega actual:{" "}
            <b>{deliveryTypeLabel(single.deliveryType)}</b>
          </p>
          <p className="text-xs text-muted-foreground">{EDIT_HINT}</p>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => onEditDeliveryType(single)}>
              {EDIT_LABEL}
            </Button>
          </DialogFooter>
        </>
      );
    }

    // Caso 2: se guardó el único pedido y ya es elegible.
    if (updated && single && !singleBlock) {
      return (
        <>
          <DialogHeader>
            <DialogTitle>El pedido ya puede generar guía</DialogTitle>
            <DialogDescription>
              Se guardaron los cambios de {single.orderNumber} y ahora su tipo
              de entrega es “{deliveryTypeLabel(single.deliveryType)}”. La guía
              todavía no se generó.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button onClick={() => onContinue(eligible)}>
              Continuar con la generación
            </Button>
          </DialogFooter>
        </>
      );
    }

    // Caso 3: selección múltiple, o un pedido bloqueado por otro motivo.
    const updatedReason = updated ? getGuideBlockReason(updated) : null;
    return (
      <>
        <DialogHeader>
          <DialogTitle>
            {eligible.length === 0
              ? "Ningún pedido seleccionado puede generar guía"
              : blocked.length === 0
                ? "Los pedidos seleccionados pueden generar guía"
                : "Algunos pedidos no pueden generar guía"}
          </DialogTitle>
          <DialogDescription>
            {eligible.length} de {sales.length}{" "}
            {sales.length === 1 ? "pedido puede" : "pedidos pueden"} generar
            guía.{blocked.length > 0 && " Los bloqueados no se incluyen:"}
          </DialogDescription>
        </DialogHeader>
        {updated && (
          <p className="rounded-md border bg-muted/40 p-2 text-xs">
            Se guardaron los cambios de <b>{updated.orderNumber}</b>
            {updatedReason
              ? `, pero todavía no puede generar guía: ${guideBlockReasonLabel(updatedReason, updated)}.`
              : "; ya puede generar guía."}
          </p>
        )}
        <ul className="max-h-72 space-y-2 overflow-y-auto">
          {blocked.map(({ sale, reason }) => (
            <li
              key={sale.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm"
            >
              <div>
                <div className="font-semibold">{sale.orderNumber}</div>
                <div className="text-xs text-muted-foreground">
                  {guideBlockReasonLabel(reason, sale)}
                </div>
              </div>
              {reason === "PICKUP_IN_STORE" && (
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`${EDIT_LABEL} de ${sale.orderNumber}`}
                  onClick={() => onEditDeliveryType(sale)}
                >
                  {EDIT_LABEL}
                </Button>
              )}
            </li>
          ))}
        </ul>
        {hasPickup && (
          <p className="text-xs text-muted-foreground">{EDIT_HINT}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          {eligible.length > 0 && (
            <Button onClick={() => onContinue(eligible)}>
              Generar guía para {eligible.length}{" "}
              {eligible.length === 1 ? "pedido" : "pedidos"}
            </Button>
          )}
        </DialogFooter>
      </>
    );
  })();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">{content}</DialogContent>
    </Dialog>
  );
}
