"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { SELECT_CLASS } from "@/components/compras/PurchaseBits";
import { LOT_STATUS_LABEL, lotDate } from "@/lib/lots";
import { LOTS_QUERY_KEY, listLots, type LotRow } from "@/services/lotsService";

// FEAT-24 H5-L — lote de una línea de traslado o ajuste (opcional). Sin elegir,
// el servidor saca primero el que vence antes (FEFO) o, en una entrada, la deja
// «sin lote». Para una salida lista los lotes con saldo en ese almacén (también
// los vencidos y bloqueados: la merma del lote vencido es el caso típico); para
// una entrada, todos los lotes de la variante.
//
// No se usa en las pantallas del celular que abre el courier (`/lots` le da 403).

interface Props {
  variantId: string;
  inventoryId: string;
  /** IN = entrada (ajuste positivo): cualquier lote de la variante. OUT = salida: los que tienen saldo en el almacén. */
  direction: "IN" | "OUT";
  value: string;
  onChange: (lotId: string) => void;
  label: string;
  disabled?: boolean;
}

export const AUTO_LOT_LABEL = "Automático (sale primero el que vence antes)";

function optionText(lot: LotRow, withStock: boolean): string {
  const status = lot.status === "vigente" ? `vence ${lotDate(lot.expiresAt)}` : `${LOT_STATUS_LABEL[lot.status]} · ${lotDate(lot.expiresAt)}`;
  return `${lot.number} · ${status}${withStock ? ` · ${lot.quantity} und` : ""}`;
}

export default function LotSelect({ variantId, inventoryId, direction, value, onChange, label, disabled }: Props) {
  const incoming = direction === "IN";
  const query = useQuery({
    queryKey: [LOTS_QUERY_KEY, "select", variantId, inventoryId, incoming],
    queryFn: ({ signal }) => listLots({ variantId, inventoryId, ...(incoming ? { includeEmpty: true } : {}) }, signal),
    enabled: Boolean(variantId && inventoryId),
    staleTime: 30_000,
    retry: false,
  });
  const lots = useMemo(() => {
    const seen = new Map<string, LotRow>();
    for (const lot of query.data?.items ?? []) {
      if (lot.variantId !== variantId) continue;
      if (!incoming && (lot.inventoryId !== inventoryId || lot.quantity <= 0)) continue;
      // En una entrada el mismo lote puede venir con saldo aquí y «sin almacén»: va una vez.
      const known = seen.get(lot.lotId);
      if (!known || (known.inventoryId !== inventoryId && lot.inventoryId === inventoryId)) seen.set(lot.lotId, lot);
    }
    return [...seen.values()].sort((a, b) => (a.expiresAt ?? "9999").localeCompare(b.expiresAt ?? "9999"));
  }, [query.data, variantId, inventoryId, incoming]);

  if (!inventoryId) return null;
  const id = `lot-select-${variantId}`;
  return (
    <div className="mt-1 space-y-0.5">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select id={id} className={`${SELECT_CLASS} h-8 text-xs`} value={value} disabled={disabled || query.isPending} onChange={(event) => onChange(event.target.value)}>
        <option value="">{incoming ? "Sin lote" : AUTO_LOT_LABEL}</option>
        {lots.map((lot) => (
          <option key={lot.lotId} value={lot.lotId}>
            {optionText(lot, lot.inventoryId === inventoryId)}
          </option>
        ))}
      </select>
      {query.isError ? <p className="text-xs text-destructive">No se pudieron leer los lotes: {incoming ? "entra sin lote" : "sale el que vence antes"}.</p> : null}
    </div>
  );
}
