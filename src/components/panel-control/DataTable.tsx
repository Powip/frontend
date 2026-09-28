"use client";

import { Download } from "lucide-react";
import { type ReactNode, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type {
  ExportCellValue,
  ExportColumn,
} from "@/features/panel-control/exportacion/models/exportacion.model";
import { exportTable } from "@/features/panel-control/exportacion/services/export-table.service";
import { usePanelExportMeta } from "@/features/panel-control/shared/hooks/use-panel-export-meta";
import type { DataOriginKind } from "@/features/panel-control/shared/models/data-origin.model";
import type { PanelCapability } from "@/features/panel-control/shared/models/panel-role.model";
import { cn } from "@/lib/utils";
import { PanelEmpty } from "./PanelStates";

export const SORT_MIN_ROWS = 4;
export const SEARCH_MIN_ROWS = 13;

export interface DataTableColumn<T> {
  id: string;
  header: string;
  align?: "left" | "right";
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => number | string | null;
  exportValue?: (row: T) => ExportCellValue;
  exportFormat?: ExportColumn["formato"];
  capability?: PanelCapability;
}

interface DataTableProps<T> {
  caption: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  footer?: Partial<Record<string, ReactNode>>;
  exportar?: { titulo: string; nombreBase: string; origen: DataOriginKind };
  emptyMessage?: string;
  maxHeight?: number;
  busquedaLocal?: boolean;
  ordenLocal?: boolean;
}

type SortState = { columnId: string; direction: "asc" | "desc" } | null;

function compare(a: number | string | null, b: number | string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "es", { numeric: true });
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  getRowKey,
  footer,
  exportar,
  emptyMessage,
  maxHeight,
  busquedaLocal = true,
  ordenLocal = true,
}: DataTableProps<T>) {
  const searchId = useId();
  const exportMeta = usePanelExportMeta();
  const visibleColumns = useMemo(
    () =>
      columns.filter(
        (column) => !column.capability || exportMeta.capabilities.has(column.capability),
      ),
    [columns, exportMeta.capabilities],
  );
  const [sort, setSort] = useState<SortState>(null);
  const [search, setSearch] = useState("");

  const sortable = ordenLocal && rows.length >= SORT_MIN_ROWS;
  const searchable = busquedaLocal && rows.length >= SEARCH_MIN_ROWS;

  const searchText = useMemo(
    () =>
      new Map(
        rows.map((row) => [
          row,
          visibleColumns
            .map((column) => {
              const value = column.exportValue?.(row) ?? column.sortValue?.(row);
              return value === null || value === undefined ? "" : String(value);
            })
            .join(" ")
            .toLowerCase(),
        ]),
      ),
    [rows, visibleColumns],
  );

  const displayed = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term ? rows.filter((row) => searchText.get(row)?.includes(term)) : rows;
    if (!sort) return filtered;
    const column = visibleColumns.find((candidate) => candidate.id === sort.columnId);
    if (!column?.sortValue) return filtered;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = column.sortValue?.(a) ?? null;
      const vb = column.sortValue?.(b) ?? null;
      if (va === null || vb === null) return compare(va, vb);
      return compare(va, vb) * factor;
    });
  }, [rows, search, searchText, sort, visibleColumns]);

  const toggleSort = (columnId: string) => {
    setSort((current) =>
      current?.columnId === columnId
        ? { columnId, direction: current.direction === "desc" ? "asc" : "desc" }
        : { columnId, direction: "desc" },
    );
  };

  const handleExport = () => {
    if (!exportar) return;
    const exportables = visibleColumns.filter((column) => column.exportValue);
    const nombre = exportTable({
      titulo: exportar.titulo,
      nombreBase: exportar.nombreBase,
      origen: exportar.origen,
      periodo: exportMeta.periodo,
      filtros: exportMeta.filtros,
      generadoEn: new Date().toLocaleString("es-PE"),
      desde: exportMeta.desde,
      hasta: exportMeta.hasta,
      columnas: exportables.map((column) => ({
        id: column.id,
        encabezado: column.header,
        formato: column.exportFormat ?? "texto",
      })),
      filas: displayed.map((row) => exportables.map((column) => column.exportValue?.(row) ?? null)),
    });
    toast.success(`Excel descargado: ${nombre}`);
  };

  const puedeExportar = !!exportar && exportMeta.capabilities.has("exportar_tabla");

  return (
    <div className="min-w-0">
      {(searchable || puedeExportar) && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {searchable && (
            <>
              <label htmlFor={searchId} className="sr-only">
                Buscar en {caption}
              </label>
              <input
                id={searchId}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar en la tabla…"
                className="h-8 w-full max-w-[280px] rounded-lg border border-pc-border bg-pc-card px-3 text-xs text-pc-text outline-none focus-visible:ring-2 focus-visible:ring-pc-primary"
              />
            </>
          )}
          <div className="grow" />
          {puedeExportar && (
            <Button type="button" variant="outline" size="sm" onClick={handleExport}>
              <Download aria-hidden />
              Excel{exportar?.origen === "demo" ? " (demo)" : ""}
            </Button>
          )}
        </div>
      )}
      {rows.length === 0 ? (
        <PanelEmpty mensaje={emptyMessage} />
      ) : (
        <div
          className="overflow-auto rounded-xl border border-pc-border-soft"
          style={maxHeight ? { maxHeight } : undefined}
        >
          <table className="w-full border-collapse text-[12.5px]">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr>
                {visibleColumns.map((column, index) => {
                  const active = sort?.columnId === column.id;
                  const ariaSort = active
                    ? sort.direction === "asc"
                      ? "ascending"
                      : "descending"
                    : "none";
                  const canSort = sortable && !!column.sortValue;
                  return (
                    <th
                      key={column.id}
                      scope="col"
                      aria-sort={canSort ? ariaSort : undefined}
                      className={cn(
                        "sticky top-0 z-[1] whitespace-nowrap border-b border-pc-border bg-pc-surface-muted px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-pc-text-muted",
                        column.align === "left" ? "text-left" : "text-right",
                        index === 0 && "left-0 z-[3] sm:sticky",
                      )}
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column.id)}
                          className="inline-flex items-center gap-1 rounded uppercase outline-none hover:text-pc-primary focus-visible:ring-2 focus-visible:ring-pc-primary"
                        >
                          {column.header}
                          <span aria-hidden className="text-pc-primary">
                            {active ? (sort.direction === "asc" ? "▲" : "▼") : ""}
                          </span>
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {displayed.map((row) => (
                <tr key={getRowKey(row)} className="hover:bg-pc-surface-muted/60">
                  {visibleColumns.map((column, index) => (
                    <td
                      key={column.id}
                      className={cn(
                        "whitespace-nowrap border-b border-pc-border-soft px-2.5 py-2 tabular-nums text-pc-text",
                        column.align === "left" ? "text-left" : "text-right",
                        index === 0 && "left-0 z-[1] bg-pc-card sm:sticky",
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {footer && (
              <tfoot>
                <tr>
                  {visibleColumns.map((column, index) => (
                    <td
                      key={column.id}
                      className={cn(
                        "whitespace-nowrap border-t border-pc-border bg-pc-surface-muted px-2.5 py-2 font-bold tabular-nums text-pc-text",
                        column.align === "left" ? "text-left" : "text-right",
                        index === 0 && "left-0 sm:sticky",
                      )}
                    >
                      {footer[column.id] ?? ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      {search && displayed.length === 0 && rows.length > 0 && (
        <p role="status" className="mt-2 text-xs text-pc-text-muted">
          Ninguna fila coincide con «{search}».
        </p>
      )}
    </div>
  );
}
