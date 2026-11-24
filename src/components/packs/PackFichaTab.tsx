"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { canSeeProductCosts } from "@/config/permissions.config";
import { useMyWarehouses } from "@/hooks/useMyWarehouses";
import { getPack, packTypeOf, type PackView } from "@/services/packsService";
import { apiErrorInfo } from "@/lib/catalog/catalogPayloads";
import { formatVariantLabel } from "@/lib/variantAttributes";
import { marginAlert, needsMarginConfirmation, soles, variantLabel } from "@/lib/packs/packMath";
import { PackAvailability, PackMarginCell } from "./PacksView";

const MASK = "••••";

/** Disponible del pack solo en los almacenes que el usuario ve; el total se vuelve a sumar con esos. */
export function visiblePackAvailability(available: PackView["available"], canSee: (inventoryId: string) => boolean): PackView["available"] {
  if (!available) return available;
  const byWarehouse = available.byWarehouse.filter((row) => canSee(row.inventoryId));
  if (byWarehouse.length === available.byWarehouse.length) return available;
  return { ...available, total: byWarehouse.reduce((sum, row) => sum + (Number(row.available) || 0), 0), byWarehouse };
}

/** El pack de la ficha (`GET /packs/:id`); la ficha y sus pestañas comparten la misma consulta. */
export function usePack(productId: string, enabled = true) {
  const { auth } = useAuth();
  return useQuery({
    queryKey: ["pack", auth?.company?.id, productId],
    queryFn: ({ signal }) => getPack(productId, signal),
    enabled: enabled && Boolean(auth?.company?.id && productId),
    retry: false,
  });
}

function PackError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <p role="alert" className="text-sm">
      No se pudo leer el pack. {apiErrorInfo(error, "").message}{" "}
      <Button variant="outline" size="sm" onClick={onRetry}>Reintentar</Button>
    </p>
  );
}

/**
 * FEAT-24 H9 y FEAT-32 M5 (spec §7.15) — pestaña «Componentes (N)» de la ficha de un pack: precio, costo, margen,
 * disponible y sus componentes (FIXED: cada SKU; CHOOSE: cada producto con sus variantes permitidas). Se edita con
 * «Editar pack» del aviso de arriba de la ficha.
 */
export default function PackFichaTab({ productId }: { productId: string }) {
  const { auth } = useAuth();
  const seeCosts = canSeeProductCosts(auth?.user);
  // FEAT-24 H6: como el stock de la ficha, solo los almacenes que el usuario ve.
  const myWarehouses = useMyWarehouses();
  const pack = usePack(productId);
  const available = useMemo(
    () => (pack.data ? visiblePackAvailability(pack.data.available, myWarehouses.canSee) : null),
    [pack.data, myWarehouses],
  );

  if (pack.isError) return <PackError error={pack.error} onRetry={() => void pack.refetch()} />;
  if (!pack.data) return <p role="status" className="text-sm text-muted-foreground">Cargando pack…</p>;
  const data = pack.data;
  const alert = seeCosts && needsMarginConfirmation(data.marginStatus) ? marginAlert(data) : "";
  const choose = packTypeOf(data) === "CHOOSE";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-6 text-sm">
        <span>Tipo: <b>{choose ? "A elegir" : "Fijo"}</b></span>
        <span>Precio: <b>{soles(data.price)}</b></span>
        <span>Suma de componentes: <b>{soles(data.componentsTotal ?? null)}</b></span>
        <span>Costo: <b>{seeCosts ? soles(data.cost ?? null) : MASK}</b></span>
        <span>Margen: <PackMarginCell pack={data} seeCosts={seeCosts} /></span>
        <span>Disponible: <PackAvailability pack={{ available }} /></span>
      </div>
      {alert ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive"><b>Margen bajo.</b> {alert}</p> : null}
      {choose ? (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                <th className="px-3 py-2">Componente</th>
                <th className="px-3 py-2">Variantes permitidas</th>
                <th className="px-3 py-2 text-right">Cantidad por pack</th>
              </tr>
            </thead>
            <tbody>
              {(data.choiceComponents ?? []).map((component) => (
                <tr key={component.slot} className="border-t align-top">
                  <td className="px-3 py-2">{component.productName}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {component.variants.map((variant) => (
                        <span key={variant.variantId} className={`rounded border px-1.5 py-0.5 text-xs ${variant.active ? "" : "text-destructive"}`}>
                          {formatVariantLabel(variant.attributeValues) || "Única"}
                          {variant.sku ? <span className="ml-1 font-mono text-muted-foreground">{variant.sku}</span> : null}
                          {variant.active ? "" : " (inactiva)"}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{component.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
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
      )}
      <p className="text-xs text-muted-foreground">
        {choose
          ? "Al vender se elige una variante permitida por unidad; las que no tienen stock no se ofrecen. Un pack a elegir todavía no se vende: pronto podrás venderlo desde Registrar venta."
          : "Al vender reserva y despacha exactamente estos SKUs."}
      </p>
    </div>
  );
}

/**
 * FEAT-32 M5 (spec §7.15) — «Stock por almacén» de un pack: no tiene stock propio, así que se muestra el disponible
 * calculado en cada almacén (mínimo de sus componentes) y el componente que limita.
 */
export function PackStockTab({ productId }: { productId: string }) {
  const myWarehouses = useMyWarehouses();
  const pack = usePack(productId);
  const available = useMemo(
    () => (pack.data ? visiblePackAvailability(pack.data.available, myWarehouses.canSee) : null),
    [pack.data, myWarehouses],
  );
  if (pack.isError) return <PackError error={pack.error} onRetry={() => void pack.refetch()} />;
  if (!pack.data) return <p role="status" className="text-sm text-muted-foreground">Cargando pack…</p>;
  if (!available) return <p className="text-sm text-muted-foreground">No se pudo calcular el disponible: el inventario no respondió.</p>;
  return (
    <div className="space-y-2">
      {available.byWarehouse.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sus componentes todavía no tienen stock en los almacenes que ves.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm" aria-label="Disponible por almacén">
            <thead>
              <tr className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                <th className="px-3 py-2">Almacén</th>
                <th className="px-3 py-2 text-right">Disponible (calculado)</th>
                <th className="px-3 py-2">Limita</th>
              </tr>
            </thead>
            <tbody>
              {available.byWarehouse.map((row) => (
                <tr key={row.inventoryId} className="border-t">
                  <td className="px-3 py-2">{row.inventoryName ?? "Almacén"}</td>
                  <td className={`px-3 py-2 text-right font-semibold tabular-nums ${row.available <= 0 ? "text-red-600" : ""}`}>{row.available}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{row.limiting?.label ?? "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-medium">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums" data-testid="pack-stock-total">{available.total}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{available.limiting?.label ? `Limita: ${available.limiting.label}` : ""}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">El pack no tiene stock propio: en cada almacén se arma con el componente que tiene menos unidades.</p>
    </div>
  );
}
