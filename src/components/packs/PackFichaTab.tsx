"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { canSeeProductCosts } from "@/config/permissions.config";
import { getPack } from "@/services/packsService";
import { apiErrorInfo } from "@/lib/catalog/catalogPayloads";
import { marginAlert, needsMarginConfirmation, soles, variantLabel } from "@/lib/packs/packMath";
import { PackAvailability, PackMarginCell } from "./PacksView";
import { PackFormDialog } from "./PackFormDialog";

const MASK = "••••";

/**
 * FEAT-24 H9 — pestaña «Pack» de la ficha (H4) para un producto `type = 'pack'`: componentes, disponible
 * por almacén (mínimo de los componentes), margen con su alerta y edición.
 */
export default function PackFichaTab({ productId }: { productId: string }) {
  const { auth } = useAuth();
  const seeCosts = canSeeProductCosts(auth?.user);
  const [editing, setEditing] = useState(false);
  const pack = useQuery({
    queryKey: ["pack", auth?.company?.id, productId],
    queryFn: ({ signal }) => getPack(productId, signal),
    enabled: Boolean(auth?.company?.id && productId),
    retry: false,
  });

  if (pack.isError) {
    return (
      <p role="alert" className="text-sm">
        No se pudo leer el pack. {apiErrorInfo(pack.error, "").message}{" "}
        <Button variant="outline" size="sm" onClick={() => void pack.refetch()}>Reintentar</Button>
      </p>
    );
  }
  if (!pack.data) return <p role="status" className="text-sm text-muted-foreground">Cargando pack…</p>;
  const data = pack.data;
  const alert = seeCosts && needsMarginConfirmation(data.marginStatus) ? marginAlert(data) : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-6 text-sm">
        <span>Precio: <b>{soles(data.price)}</b></span>
        <span>Costo: <b>{seeCosts ? soles(data.cost ?? null) : MASK}</b></span>
        <span>Margen: <PackMarginCell pack={data} seeCosts={seeCosts} /></span>
        <span>Disponible: <PackAvailability pack={data} /></span>
        {seeCosts ? <Button size="sm" variant="outline" className="ml-auto" onClick={() => setEditing(true)}>Editar pack</Button> : null}
      </div>
      {alert ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive"><b>Margen bajo.</b> {alert}</p> : null}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
              <th className="px-3 py-2">Componente</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2 text-right">Cantidad por pack</th>
              <th className="px-3 py-2 text-right">Costo prom.</th>
            </tr>
          </thead>
          <tbody>
            {data.components.map((component) => (
              <tr key={component.variantId} className="border-t">
                <td className="px-3 py-2">{variantLabel(component.productName, component.attributeValues)}{component.active ? "" : " (inactivo)"}</td>
                <td className="px-3 py-2 font-mono text-xs">{component.sku ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{component.quantity}</td>
                <td className="px-3 py-2 text-right tabular-nums">{seeCosts ? soles(component.averageCost ?? null) : MASK}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.available && data.available.byWarehouse.length > 0 ? (
        <div className="text-sm">
          <p className="mb-1 font-medium">Disponible por almacén</p>
          <ul className="space-y-0.5 text-muted-foreground">
            {data.available.byWarehouse.map((row) => (
              <li key={row.inventoryId}>{row.inventoryName ?? "Almacén"}: <b className="text-foreground">{row.available}</b></li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">El pack no tiene stock propio: su disponible es el del componente con menos unidades en cada almacén.</p>
      {editing ? <PackFormDialog pack={data} onClose={() => setEditing(false)} onSaved={() => void pack.refetch()} /> : null}
    </div>
  );
}
