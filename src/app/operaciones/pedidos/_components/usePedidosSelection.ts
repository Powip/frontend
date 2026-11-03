"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Sale } from "./types";

/**
 * Selección de pedidos de una pestaña paginada en servidor.
 *
 * Guarda los pedidos completos (no solo ids): las acciones masivas necesitan su estado,
 * teléfono y productos aunque ya no estén en la página visible. La selección persiste
 * entre páginas y filtros dentro de la pestaña — igual que antes, cuando el navegador
 * tenía todos los pedidos — y se pierde al cambiar de pestaña.
 */
export function usePedidosSelection(pageSales: Sale[]) {
  const [picked, setPicked] = useState<Map<string, Sale>>(new Map());

  // Si un pedido seleccionado vuelve a llegar en una página, se refrescan sus datos.
  useEffect(() => {
    setPicked((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const sale of pageSales) {
        if (next.has(sale.id) && next.get(sale.id) !== sale) {
          next.set(sale.id, sale);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pageSales]);

  const toggle = useCallback((sale: Sale) => {
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(sale.id)) next.delete(sale.id);
      else next.set(sale.id, sale);
      return next;
    });
  }, []);

  /** Marca o desmarca toda la página visible. */
  const togglePage = useCallback((rows: Sale[]) => {
    setPicked((prev) => {
      const next = new Map(prev);
      const allSelected = rows.length > 0 && rows.every((sale) => next.has(sale.id));
      for (const sale of rows) {
        if (allSelected) next.delete(sale.id);
        else next.set(sale.id, sale);
      }
      return next;
    });
  }, []);

  const addMany = useCallback((rows: Sale[]) => {
    setPicked((prev) => {
      const next = new Map(prev);
      for (const sale of rows) next.set(sale.id, sale);
      return next;
    });
  }, []);

  const removeMany = useCallback((ids: readonly string[]) => {
    setPicked((prev) => {
      const next = new Map(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setPicked(new Map()), []);

  const selected = useMemo(() => Array.from(picked.values()), [picked]);
  const ids = useMemo(() => new Set(picked.keys()), [picked]);
  const pageAllSelected = pageSales.length > 0 && pageSales.every((sale) => picked.has(sale.id));

  return { selected, ids, count: picked.size, pageAllSelected, toggle, togglePage, addMany, removeMany, clear };
}

export type PedidosSelection = ReturnType<typeof usePedidosSelection>;
