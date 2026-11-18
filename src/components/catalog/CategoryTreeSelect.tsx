"use client";

import { flattenCategoryTree, type CatalogCategoryNode } from "@/lib/catalog/categoryTree";
import { cn } from "@/lib/utils";

export const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const INDENT = "   ";

/**
 * FEAT-24 H4 — selector de la categoría propia (árbol de hasta 3 niveles, con sangría). `""` = «Sin
 * categoría». Con `filterMode` agrega «Todas» (`all`) y «Sin categoría» (`none`) para el listado.
 * Las desactivadas no se ofrecen, salvo la que ya tiene el producto (para no perderla de vista).
 */
export default function CategoryTreeSelect({
  id,
  tree,
  value,
  onChange,
  disabled,
  filterMode = false,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  tree: CatalogCategoryNode[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  filterMode?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const options = flattenCategoryTree(tree, { activeOnly: true });
  const current = value && !options.some((option) => option.id === value) ? flattenCategoryTree(tree).find((option) => option.id === value) : undefined;
  if (current) options.push({ ...current, level: 1, name: current.path, active: false });
  return (
    <select id={id} aria-label={ariaLabel} className={cn(NATIVE_SELECT_CLASS, className)} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      {filterMode ? <option value="all">Todas las categorías</option> : null}
      <option value={filterMode ? "none" : ""}>Sin categoría</option>
      {options.map((option) => (
        <option key={option.id} value={option.id} title={option.path}>
          {`${INDENT.repeat(option.level - 1)}${option.name}${option.active ? "" : " (desactivada)"}`}
        </option>
      ))}
    </select>
  );
}
