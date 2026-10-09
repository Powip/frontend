"use client";

import { GitMerge, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ReconciliationTask,
  ReconciliationTaskItemSource,
} from "@/services/reconciliationTask.service";
import {
  ReconciliationSourceChip,
  getReconciliationSourceLabel,
} from "./ReconciliationSourceChip";

const CLUSTER_THUMB_COLORS = [
  "bg-teal-600",
  "bg-indigo-600",
  "bg-rose-600",
  "bg-amber-600",
  "bg-cyan-600",
  "bg-fuchsia-600",
];

function getClusterThumbColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return CLUSTER_THUMB_COLORS[hash % CLUSTER_THUMB_COLORS.length];
}

function getClusterInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

interface ReconciliationClusterCardProps {
  task: ReconciliationTask;
  isProcessing: boolean;
  onMerge: () => void;
  onReject: () => void;
}

// FEAT-17 Anexo D — tarjeta de un posible duplicado (tab "Por unificar"),
// extraída tal cual de `ReconciliationTab` (diseño del Anexo B).
export function ReconciliationClusterCard({
  task,
  isProcessing,
  onMerge,
  onReject,
}: ReconciliationClusterCardProps) {
  const suggestedItem =
    task.items.find((item) => item.is_suggested_winner) ?? task.items[0];
  const sources = task.items
    .map((item) => item.source)
    .filter(
      (source): source is ReconciliationTaskItemSource => source !== null,
    );
  const allSameSource =
    sources.length === task.items.length &&
    sources.every((source) => source === sources[0]);

  return (
    <div className="overflow-hidden rounded-md border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-4 p-4">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white",
            getClusterThumbColor(task.id),
          )}
        >
          {getClusterInitials(suggestedItem?.variant_name ?? "?")}
        </div>
        <div className="min-w-[240px] flex-1 space-y-1">
          <p
            className="text-sm font-semibold"
            title={suggestedItem?.variant_name}
          >
            {suggestedItem?.variant_name ?? "Producto sin nombre"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {task.items.length} variantes candidatas
            </span>
            {task.confidenceLevel !== null && (
              <Badge variant="secondary">
                {Math.round(Number(task.confidenceLevel) * 100)}% confianza
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" disabled={isProcessing} onClick={onMerge}>
            <GitMerge className="mr-1 h-3.5 w-3.5" />
            Revisar y unificar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-destructive/30 text-destructive hover:bg-destructive/10"
            disabled={isProcessing}
            onClick={onReject}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Son distintos
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y border-t sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {task.items.map((item) => (
          <div
            key={item.variant_id ?? item.variant_name}
            className="space-y-1.5 p-3 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="truncate text-sm font-medium"
                title={item.variant_name}
              >
                {item.variant_name}
              </span>
              {item.is_suggested_winner && (
                <Badge className="bg-emerald-600 hover:bg-emerald-600">
                  Sugerida
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ReconciliationSourceChip source={item.source} />
              <span className="font-mono text-muted-foreground">
                {item.sku ?? item.company_sku ?? "Sin SKU"}
              </span>
              <span className="text-muted-foreground">
                {Math.round(item.confidence * 100)}% confianza
              </span>
            </div>
          </div>
        ))}
      </div>

      {allSameSource && (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          Todas están en {getReconciliationSourceLabel(sources[0])}: es un
          duplicado dentro del mismo canal. Después de unificar, eliminá el
          duplicado también en {getReconciliationSourceLabel(sources[0])}.
        </div>
      )}
    </div>
  );
}
