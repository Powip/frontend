"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export type PageItem = number | "gap-start" | "gap-end";

/**
 * Páginas a mostrar: todas si son pocas; si no, siempre la primera y la última con
 * "…" donde hay saltos (1 2 3 4 … 8 · 1 … 4 5 6 … 8 · 1 … 5 6 7 8).
 */
export function buildPageItems(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 3) return [1, 2, 3, 4, "gap-end", total];
  if (current >= total - 2) return [1, "gap-start", total - 3, total - 2, total - 1, total];
  return [1, "gap-start", current - 1, current, current + 1, "gap-end", total];
}

/** Paginación de las listas paginadas en servidor: Anterior · 1 2 3 … N · Siguiente. */
export function NumberedPagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  itemName = "pedidos",
  disabled = false,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  itemName?: string;
  /** Mientras llega otra página no se encadenan clics. */
  disabled?: boolean;
}) {
  const start = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, totalItems);
  const items = buildPageItems(currentPage, Math.max(totalPages, 1));
  const single = totalPages <= 1;

  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 px-2 py-4">
      <p className="text-sm text-muted-foreground">
        Mostrando {start} – {end} de {totalItems} {itemName}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={disabled || single || currentPage <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        {items.map((item) =>
          typeof item === "number" ? (
            <Button
              key={item}
              size="sm"
              variant={item === currentPage ? "default" : "outline"}
              aria-current={item === currentPage ? "page" : undefined}
              aria-label={`Página ${item}`}
              className={`h-8 w-8 p-0 ${item === currentPage ? "bg-violet-600 text-white hover:bg-violet-700" : ""}`}
              onClick={() => onPageChange(item)}
              disabled={disabled || (single && item !== currentPage)}
            >
              {item}
            </Button>
          ) : (
            <span key={item} aria-hidden="true" className="px-1 text-sm text-muted-foreground">
              …
            </span>
          ),
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={disabled || single || currentPage >= totalPages}
        >
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
