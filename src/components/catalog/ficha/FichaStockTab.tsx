"use client";

import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FichaStockView } from "@/lib/catalog/fichaStock";

/** FEAT-24 H4 (H4-D11) — Stock por almacén: físico, reservado, disponible y, si llegan, en tránsito y por recibir. */
export default function FichaStockTab({ view, showVariant }: { view: FichaStockView; showVariant: boolean }) {
  if (view.rows.length === 0) return <p className="text-sm text-muted-foreground">Este producto todavía no tiene stock en los almacenes del alcance.</p>;
  const columns = 4 + (showVariant ? 2 : 0) + (view.showTransit ? 1 : 0) + (view.showIncoming ? 1 : 0);
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {showVariant ? <><TableHead>Variante</TableHead><TableHead>SKU</TableHead></> : null}
            <TableHead>Almacén</TableHead>
            <TableHead className="text-right">Físico</TableHead>
            <TableHead className="text-right">Reservado</TableHead>
            <TableHead className="text-right">Disponible</TableHead>
            {view.showTransit ? <TableHead className="text-right">En tránsito</TableHead> : null}
            {view.showIncoming ? <TableHead className="text-right">Por recibir</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {view.rows.map((row) => (
            <TableRow key={row.inventoryItemId}>
              {showVariant ? <><TableCell className="font-medium">{row.variantLabel}</TableCell><TableCell className="font-mono text-xs">{row.sku}</TableCell></> : null}
              <TableCell>{row.inventoryName}{row.storeName ? <span className="block text-xs text-muted-foreground">{row.storeName}</span> : null}</TableCell>
              <TableCell className="text-right tabular-nums">{row.physical}</TableCell>
              <TableCell className="text-right tabular-nums">{row.reserved}</TableCell>
              <TableCell className={`text-right tabular-nums font-semibold ${row.available <= 0 ? "text-red-600" : ""}`}>{row.available}</TableCell>
              {view.showTransit ? <TableCell className="text-right tabular-nums">{row.inTransit ?? "—"}</TableCell> : null}
              {view.showIncoming ? <TableCell className="text-right tabular-nums">{row.incoming ?? "—"}</TableCell> : null}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={columns - 3 - (view.showTransit ? 1 : 0) - (view.showIncoming ? 1 : 0)} className="font-medium">Total</TableCell>
            <TableCell className="text-right tabular-nums font-medium">{view.totals.physical}</TableCell>
            <TableCell className="text-right tabular-nums font-medium">{view.totals.reserved}</TableCell>
            <TableCell className="text-right tabular-nums font-semibold">{view.totals.available}</TableCell>
            {view.showTransit ? <TableCell className="text-right tabular-nums font-medium">{view.totals.inTransit}</TableCell> : null}
            {view.showIncoming ? <TableCell className="text-right tabular-nums font-medium">{view.totals.incoming}</TableCell> : null}
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
