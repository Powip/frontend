"use client";

import { useId } from "react";

interface UsersPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageSizes: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const pageButton =
  "flex h-7 min-w-7 items-center justify-center rounded-md border border-[#e8e4f8] bg-white px-1.5 text-xs transition-colors hover:border-[#4C2FB5] hover:text-[#4C2FB5] disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:bg-transparent";

const visiblePages = (currentPage: number, totalPages: number) => {
  const count = Math.min(totalPages, 5);
  const start = Math.min(Math.max(currentPage - 2, 1), Math.max(totalPages - count + 1, 1));
  return Array.from({ length: count }, (_, index) => start + index);
};

export function UsersPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizes,
  onPageChange,
  onPageSizeChange,
}: UsersPaginationProps) {
  const selectId = useId();
  const first = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const last = Math.min(currentPage * pageSize, totalItems);

  return (
    <nav
      aria-label="Paginación de usuarios"
      className="flex flex-col gap-2 border-t border-[#e8e4f8] px-4 py-3 text-xs text-[#8b87a3] sm:flex-row sm:items-center sm:justify-between dark:border-border"
    >
      <p>
        Mostrando {first}–{last} de {totalItems} usuarios
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id={selectId}
          aria-label="Filas por página"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded-[9px] border-[1.5px] border-[#e8e4f8] bg-white px-2 py-[5px] text-xs text-[#2D2A45] outline-none focus:border-[#4C2FB5] dark:border-border dark:bg-transparent dark:text-foreground"
        >
          {pageSizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <label htmlFor={selectId}>por página</label>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Página anterior"
            className={pageButton}
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            ‹
          </button>
          {visiblePages(currentPage, totalPages).map((page) => (
            <button
              key={page}
              type="button"
              aria-label={`Página ${page}`}
              aria-current={page === currentPage ? "page" : undefined}
              className={`${pageButton} ${
                page === currentPage ? "border-[#4C2FB5] bg-[#4C2FB5] text-white hover:text-white dark:bg-[#4C2FB5]" : ""
              }`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            aria-label="Página siguiente"
            className={pageButton}
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            ›
          </button>
        </div>
      </div>
    </nav>
  );
}
