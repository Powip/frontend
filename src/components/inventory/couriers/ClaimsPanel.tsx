"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CLAIM_STATUS_CLASS, CLAIM_STATUS_LABEL, CLAIM_STATUSES, claimOriginText } from "@/lib/courier";
import { formatDay } from "@/lib/purchaseOrders";
import { opsErrorMessage } from "@/lib/warehouseOps";
import { listCourierClaims, type CourierClaimStatus } from "@/services/sharedCourierService";
import { ErrorBox, Money, SELECT_CLASS, StatusPill } from "../../warehouse-ops/OpsBits";
import ClaimDetailDialog from "./ClaimDetailDialog";

// FEAT-24 H8-D4 — reclamos a los couriers (cuenta por cobrar): totales por
// estado, la lista y el detalle con historial, cambio de estado y PDF. Solo
// Administrador y Operaciones (la fachada responde 403 al resto).

export const CLAIMS_KEY = "courier-claims";

interface Props {
  warehouseName: (inventoryId: string) => string;
  /** Reclamo abierto en el detalle (desde la lista, una conciliación o una alerta). */
  selected: string | null;
  onSelect: (claimId: string | null) => void;
  onChanged?: () => void;
}

export default function ClaimsPanel({ warehouseName, selected, onSelect, onChanged }: Props) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<CourierClaimStatus | "">("");
  const setSelected = onSelect;
  const query = useQuery({
    queryKey: [CLAIMS_KEY, status],
    queryFn: ({ signal }) => listCourierClaims(status ? { status } : {}, signal),
    retry: false,
  });
  const items = query.data?.items ?? [];
  const totals = query.data?.totals ?? {};

  return (
    <section className="space-y-3" aria-label="Reclamos a couriers">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Reclamos a couriers</h3>
        <select aria-label="Estado del reclamo" className={`${SELECT_CLASS} w-48`} value={status} onChange={(event) => setStatus(event.target.value as CourierClaimStatus | "")}>
          <option value="">Todos los estados</option>
          {CLAIM_STATUSES.map((value) => (
            <option key={value} value={value}>
              {CLAIM_STATUS_LABEL[value]}
            </option>
          ))}
        </select>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Totales por estado">
        {CLAIM_STATUSES.map((value) => {
          const total = totals[value];
          // Lo cobrado en «Cobrado»; en el resto, lo reclamado. Sin la clave (sin rol de costos) «••••».
          const field = value === "cobrado" ? "collectedAmount" : "amount";
          const amount = !total ? 0 : field in total ? (total[field] ?? null) : undefined;
          return (
            <div key={value} className="rounded-md border px-3 py-2" data-testid={`claim-total-${value}`}>
              <dt className="text-xs text-muted-foreground">{CLAIM_STATUS_LABEL[value]}</dt>
              <dd className="font-semibold tabular-nums">
                {total?.count ?? 0} · {total?.units ?? 0} und
              </dd>
              <dd className="text-sm">
                <Money value={amount} />
              </dd>
            </div>
          );
        })}
      </dl>

      {query.isError ? <ErrorBox>{opsErrorMessage(query.error, "No se pudieron cargar los reclamos.")}</ErrorBox> : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm" aria-label="Lista de reclamos">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Nº</th>
              <th className="px-3 py-2 text-left font-medium">Fecha</th>
              <th className="px-3 py-2 text-left font-medium">Almacén</th>
              <th className="px-3 py-2 text-left font-medium">Origen</th>
              <th className="px-3 py-2 text-right font-medium">Unidades</th>
              <th className="px-3 py-2 text-right font-medium">Monto</th>
              <th className="px-3 py-2 text-left font-medium">Estado</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {query.isPending ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  No hay reclamos{status ? " en este estado" : ""}.
                </td>
              </tr>
            ) : (
              items.map((claim) => (
                <tr key={claim.id} className="border-t" data-testid={`claim-${claim.number}`}>
                  <td className="px-3 py-2 font-mono font-semibold">{claim.number}</td>
                  <td className="px-3 py-2 tabular-nums">{formatDay(claim.createdAt)}</td>
                  <td className="px-3 py-2">{warehouseName(claim.inventoryId)}</td>
                  <td className="px-3 py-2">{claimOriginText(claim)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{claim.totalUnits}</td>
                  <td className="px-3 py-2 text-right">
                    <Money value={"totalAmount" in claim ? (claim.totalAmount ?? null) : undefined} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill label={CLAIM_STATUS_LABEL[claim.status] ?? claim.status} className={CLAIM_STATUS_CLASS[claim.status] ?? ""} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button type="button" size="sm" variant="outline" onClick={() => setSelected(claim.id)}>
                      Ver
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected ? (
        <ClaimDetailDialog
          claimId={selected}
          warehouseName={warehouseName}
          onClose={() => setSelected(null)}
          onChanged={() => {
            void queryClient.invalidateQueries({ queryKey: [CLAIMS_KEY] });
            onChanged?.();
          }}
        />
      ) : null}
    </section>
  );
}
