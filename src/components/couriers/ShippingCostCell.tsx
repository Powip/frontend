"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import axios from "@/lib/axiosAuth";
import { Input } from "@/components/ui/input";
import { TableCell } from "@/components/ui/table";
import { OrderHeader } from "@/interfaces/IOrder";

/**
 * Convierte lo tipeado en un monto. Vacío = 0 (así se quita un costo cargado).
 * Devuelve `null` si no es un monto válido: solo dígitos con hasta 2 decimales,
 * con punto o coma. "1,200" se rechaza a propósito — como coma decimal se leería
 * como 1,20 y se guardaría un monto distinto del que quiso escribir.
 */
function parseShippingCost(raw: string): number | null {
  const text = raw.trim();
  if (text === "") return 0;
  if (!/^\d+([.,]\d{1,2})?$/.test(text)) return null;
  return Number(text.replace(",", "."));
}

/** La celda queda vacía (con placeholder) cuando no hay costo; `carrier_shipping_cost` guarda 0 por defecto. */
function formatShippingCost(cost: number): string {
  return cost > 0 ? cost.toFixed(2) : "";
}

/**
 * Costo de envío editable desde la fila del Rastreo. Sirve para los clientes que
 * registraron la venta sin el costo (no lo conocían) y después ya no tenían dónde
 * cargarlo. Autoguarda al salir del campo (o con Enter), igual que los campos de
 * tracking de la misma fila: un PATCH a ms-ventas con solo `carrierShippingCost`.
 */
export function ShippingCostCell({
  order,
  onSaved,
}: {
  order: OrderHeader;
  onSaved: (orderId: string, patch: { carrierShippingCost: number }) => void;
}) {
  const current = Number(order.carrierShippingCost) || 0;
  const [value, setValue] = useState(formatShippingCost(current));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(formatShippingCost(current));
  }, [order.id, current]);

  const commit = async () => {
    if (saving) return;
    const parsed = parseShippingCost(value);
    if (parsed === null) {
      toast.error("Ingresa un monto válido: solo números, con hasta 2 decimales");
      setValue(formatShippingCost(current));
      return;
    }
    if (parsed === current) {
      setValue(formatShippingCost(current));
      return;
    }
    setSaving(true);
    try {
      await axios.patch(`${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${order.id}`, {
        carrierShippingCost: parsed,
      });
      toast.success("Costo de envío guardado");
      setValue(formatShippingCost(parsed));
      onSaved(order.id, { carrierShippingCost: parsed });
    } catch {
      toast.error("No se pudo guardar el costo de envío");
      setValue(formatShippingCost(current));
    } finally {
      setSaving(false);
    }
  };

  return (
    <TableCell className="px-2 py-2 text-right">
      <div className="flex items-center justify-end gap-1">
        <Input
          inputMode="decimal"
          placeholder="0.00"
          aria-label={`Costo de envío del pedido ${order.orderNumber}`}
          title="Lo que cobra el courier por este envío. Se guarda al salir del campo."
          value={value}
          disabled={saving}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="h-7 w-24 text-right text-[11px] tabular-nums"
        />
        {saving && <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
      </div>
    </TableCell>
  );
}
