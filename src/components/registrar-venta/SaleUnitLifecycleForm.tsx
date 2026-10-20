"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { CartItem, OrderHeader } from "@/interfaces/IOrder";
import { isTracked } from "@/services/inventoryTrackingService";
import { validateSaleUnits } from "@/services/saleTrackingService";

import type {
  SaleUnitLifecycleAction,
  SaleUnitLifecycleDraft,
} from "@/services/saleUnitLifecycleService";

export function lifecycleCart(order: OrderHeader): CartItem[] {
  return order.items.map((item) => ({
    id: item.id,
    inventoryItemId: "",
    variantId: item.productVariantId,
    productName: item.productName,
    sku: item.sku,
    attributes: item.attributes ?? {},
    quantity: item.quantity,
    price: Number(item.unitPrice),
    discount: 0,
    trackingMode: item.trackingMode,
    // Reactivation is an explicit new selection, including when prior units are available again.
    ...(isTracked(item.trackingMode) ? { unitIds: [], units: [] } : {}),
  }));
}

export function lifecycleSelectionError(
  action: SaleUnitLifecycleAction,
  order: OrderHeader,
  cart: CartItem[],
): string | null {
  if (!order.items.length || !Number.isSafeInteger(order.stockVersion))
    return "Actualiza la venta para comprobar sus unidades y versión.";
  if (
    order.items.some(
      (item) =>
        !item.productVariantId ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity <= 0 ||
        !["NONE", "SERIAL", "IMEI"].includes(item.trackingMode ?? ""),
    )
  )
    return "No se pudo comprobar el seguimiento de todos los productos de la venta.";
  if (action === "return") {
    if (!["ENTREGADO", "EN_ENVIO"].includes(order.status))
      return "Actualiza la venta para comprobar si permite el retorno físico de sus productos.";
    const inTransit = order.status === "EN_ENVIO";
    const expectedUnitStatus = inTransit ? "RESERVED" : "SOLD";
    const lines = order.items.map((item) => ({
      ...item,
      unitIds: item.units?.map((unit) => unit.id),
    }));
    const invalid = order.items.some(
      (item) =>
        isTracked(item.trackingMode) &&
        (item.units?.length !== item.quantity ||
          item.units.some((unit) => unit.status !== expectedUnitStatus || !unit.code) ||
          item.unitIds?.length !== item.quantity ||
          item.units.some((unit) => !item.unitIds?.includes(unit.id))),
    );
    return invalid
      ? inTransit
        ? "El pedido no tiene una reserva completa de unidades en envío para confirmar su retorno. Actualiza su información."
        : "La venta no tiene una entrega completa de unidades para devolver. Actualiza su información."
      : validateSaleUnits(lines);
  }
  if (
    cart.length !== order.items.length ||
    order.items.some((item) => {
      const selected = cart.find((line) => line.id === item.id);
      return (
        !selected ||
        selected.variantId !== item.productVariantId ||
        selected.quantity !== item.quantity ||
        selected.trackingMode !== item.trackingMode
      );
    })
  )
    return "La reactivación debe conservar los productos y cantidades de la venta.";
  return validateSaleUnits(cart);
}

interface Props {
  action: SaleUnitLifecycleAction;
  companyId: string;
  order: OrderHeader;
  cart: CartItem[];
  disabled?: boolean;
  selection?: ReactNode;
  onConfirm: (draft: SaleUnitLifecycleDraft) => void;
}

export default function SaleUnitLifecycleForm({
  action,
  companyId,
  order,
  cart,
  disabled,
  selection,
  onConfirm,
}: Props) {
  const inTransitReturn = action === "return" && order.status === "EN_ENVIO";
  const scope = `${companyId}:${order.id}:${order.stockVersion}:${order.status}:${action}`;
  const [review, setReview] = useState({ scope, reason: "", accepted: false });
  useEffect(() => setReview({ scope, reason: "", accepted: false }), [scope]);
  const current = review.scope === scope ? review : { scope, reason: "", accepted: false };
  const invalid = lifecycleSelectionError(action, order, cart);
  const title =
    action === "return"
      ? inTransitReturn ? "Confirmar retorno físico" : "Devolución completa de la venta"
      : "Reactivar la venta con una nueva reserva";
  const confirm = () => {
    if (disabled || invalid || !current.accepted || !current.reason.trim()) return;
    onConfirm({
      reason: current.reason.trim(),
      ...(inTransitReturn ? { physicalReturnConfirmed: true } : {}),
      items: order.items.map((item) => ({
        orderItemId: item.id,
        quantity: item.quantity,
        ...(isTracked(item.trackingMode)
          ? {
              unitIds:
                action === "return"
                  ? [...(item.unitIds ?? [])]
                  : [...(cart.find((line) => line.id === item.id)?.unitIds ?? [])],
            }
          : {}),
      })),
    });
  };
  return (
    <section aria-label={title} className="space-y-4">
      <p className="text-sm">
        {action === "return"
          ? inTransitReturn
            ? "Confirma que recibiste físicamente TODOS los productos del pedido: los IMEI/series indicados y las cantidades de productos sin seguimiento. Hasta confirmar el retorno, el pedido seguirá En envío y sus unidades permanecerán reservadas. Al confirmarse la operación, quedará anulado y el stock estará disponible."
            : "Confirma la recepción de todos los productos y códigos de esta entrega. Las cantidades indicadas volverán al mismo almacén cuando se confirme la operación."
          : "Selecciona nuevamente un IMEI o serie por unidad. La venta volverá a Pendiente cuando se confirme la nueva reserva."}
      </p>
      <p className="text-sm text-muted-foreground">
        Esta operación modifica inventario. Los pagos y reembolsos se gestionan por separado.
      </p>
      <ul aria-label="Productos de la operación" className="space-y-3">
        {order.items.map((item) => (
          <li key={item.id} className="rounded border p-3 text-sm">
            <p className="font-medium">
              {item.sku} · {item.productName} {Object.values(item.attributes ?? {}).join(" · ")}
            </p>
            <p>Cantidad completa: {item.quantity}</p>
            {isTracked(item.trackingMode) ? (
              <ul
                aria-label={`${action === "return" ? inTransitReturn ? "Unidades en envío" : "Unidades entregadas" : "Selección anterior"} ${item.sku}`}
              >
                {(item.units ?? []).map((unit) => (
                  <li key={unit.id}>
                    <code>{unit.code}</code>
                    {action === "return" && (inTransitReturn ? " · En envío / Reservada" : " · Entregada")}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Producto sin seguimiento por unidad; cantidad fija.</p>
            )}
          </li>
        ))}
      </ul>
      {action === "reactivate" && selection}
      {invalid && (
        <p role="alert" className="text-sm text-destructive">
          {invalid}
        </p>
      )}
      <label className="block text-sm" htmlFor={`lifecycle-reason-${order.id}`}>
        Motivo
      </label>
      <textarea
        id={`lifecycle-reason-${order.id}`}
        value={current.reason}
        maxLength={500}
        disabled={disabled}
        className="min-h-20 w-full rounded border p-2"
        onChange={(event) => setReview({ ...current, reason: event.target.value })}
      />
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={current.accepted}
          disabled={disabled}
          onChange={(event) => setReview({ ...current, accepted: event.target.checked })}
        />
        {action === "return"
          ? inTransitReturn
            ? "Confirmo que recibí físicamente TODOS los productos de este pedido, incluidos los IMEI/series y los productos sin seguimiento."
            : "Confirmo que recibí físicamente todos los productos y códigos de esta entrega."
          : "Confirmo los productos, cantidades y la nueva selección de unidades."}
      </label>
      <Button
        type="button"
        disabled={disabled || Boolean(invalid) || !current.accepted || !current.reason.trim()}
        onClick={confirm}
      >
        {action === "return" ? inTransitReturn ? "Confirmar retorno físico" : "Confirmar devolución completa" : "Solicitar nueva reserva"}
      </Button>
    </section>
  );
}
