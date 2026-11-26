"use client";

import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MetaStatusFilter, MetaStatusState } from "./advertising-meta-status";

export const META_STATUS_OPTIONS_FEMININE: Array<{ value: MetaStatusFilter; label: string }> = [
  { value: "active", label: "Activas" },
  { value: "inactive", label: "Inactivas" },
  { value: "all", label: "Todas" },
];
export const META_STATUS_OPTIONS_MASCULINE: Array<{ value: MetaStatusFilter; label: string }> = [
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
  { value: "all", label: "Todos" },
];

const OPTIONS: Array<{ value: MetaStatusFilter; label: string }> = [
  { value: "active", label: "Activas" },
  { value: "inactive", label: "Inactivas" },
  { value: "all", label: "Todas" },
];

/** Activas / Inactivas / Todas plus a search box. Filtering only hides rows; it never imports. */
export function AdvertisingMetaStatusFilter({
  filter,
  onFilter,
  query,
  onQuery,
  counts,
  label,
  searchPlaceholder = "Buscar por nombre o ID",
  showStatus = true,
  options = OPTIONS,
}: {
  filter: MetaStatusFilter;
  onFilter: (value: MetaStatusFilter) => void;
  query: string;
  onQuery: (value: string) => void;
  counts?: Record<MetaStatusFilter, number>;
  label: string;
  searchPlaceholder?: string;
  showStatus?: boolean;
  options?: Array<{ value: MetaStatusFilter; label: string }>;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {showStatus && (
        <fieldset className="flex flex-wrap gap-1">
          <legend className="sr-only">{label}</legend>
          {options.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={filter === option.value ? "default" : "outline"}
              aria-pressed={filter === option.value}
              onClick={() => onFilter(option.value)}
            >
              {option.label}
              {counts ?` (${counts[option.value]})` : ""}
            </Button>
          ))}
        </fieldset>
      )}
      <div className="relative min-w-0 flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={`Buscar en ${label.toLowerCase()}`}
          className="h-8 pl-8"
        />
      </div>
    </div>
  );
}

export function MetaStatusBadge({ state, label }: { state: MetaStatusState; label: string }) {
  return (
    <Badge
      variant={state === "inactive" ? "warning" : state === "active" ? "success" : "outline"}
      className="shrink-0"
      data-meta-status={state}
    >
      {label}
    </Badge>
  );
}
