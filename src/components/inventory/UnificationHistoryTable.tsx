"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { canSeeProductCosts } from "@/config/permissions.config";
import {
  listUnificationHistory,
  type UnificationHistoryItem,
  type UnificationHistoryStatus,
  type UnificationVariantSnapshot,
} from "@/services/unification.service";
import { getReconciliationTaskErrorMessage } from "@/services/reconciliationTask.service";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACTION_LABEL, STOCK_MODE_LABEL, VIA_LABEL, variantDisplayLabel } from "./unificationRules";

export const UNIFICATION_HISTORY_PAGE_SIZE = 10;
export const UNIFICATION_HISTORY_QUERY_KEY = "unification-history";

type StatusFilter = "" | UnificationHistoryStatus;

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "", label: "Todas" },
  { value: "confirmed", label: "Aplicadas" },
  { value: "rejected", label: "Rechazadas" },
];

const DERIVED_TITLE =
  "Resuelta antes del historial detallado: la variante que quedó y las que se unieron se dedujeron del catálogo, y no se guardó el modo de stock.";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short", timeZone: "America/Lima" });
}

function VariantLine({ variant }: { variant: UnificationVariantSnapshot }) {
  return (
    <div className="text-sm">
      <span className="font-medium">{variant.product_name || "Variante sin nombre"}</span>
      <span className="block text-xs text-muted-foreground">{variantDisplayLabel(variant.attribute_values)}</span>
      <span className="block font-mono text-[11px] text-muted-foreground">{variant.company_sku || variant.sku || "Sin SKU"}</span>
    </div>
  );
}

function stockText(item: UnificationHistoryItem): string {
  if (!item.stock_mode) return item.derived ? "Sin detalle" : "—";
  if (item.stock_mode === "count") return `${STOCK_MODE_LABEL.count}: ${item.counted_quantity ?? "—"}`;
  return STOCK_MODE_LABEL[item.stock_mode];
}

/**
 * FEAT-24 H11 (H11-D5) — Historial de la Unificación: tareas confirmadas y rechazadas, con quién y
 * cuándo, la variante que quedó, las que se unieron y el modo de stock. Es de solo lectura y sin
 * «deshacer»: el libro es inmutable y un error se corrige con un ajuste.
 */
export function UnificationHistoryTable({ companyId }: { companyId: string | undefined }) {
  const { auth } = useAuth();
  const showCost = canSeeProductCosts(auth?.user);
  const [status, setStatus] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);

  const history = useQuery({
    queryKey: [UNIFICATION_HISTORY_QUERY_KEY, companyId, auth?.user?.id, status, page],
    queryFn: () => listUnificationHistory({ page, limit: UNIFICATION_HISTORY_PAGE_SIZE, status: status || undefined }),
    enabled: Boolean(companyId && auth?.company?.id === companyId && auth?.user?.id && auth?.accessToken),
    placeholderData: keepPreviousData,
    retry: false,
  });

  const changeStatus = (next: StatusFilter) => {
    setStatus(next);
    setPage(1);
  };

  const rows = history.data?.data ?? [];

  return (
    <div className="flex flex-col space-y-4">
      <div className="inline-flex w-fit rounded-md border p-0.5" role="group" aria-label="Estado">
        {STATUS_FILTERS.map((filter) => (
          <Button
            key={filter.value || "todas"}
            type="button"
            size="sm"
            variant={status === filter.value ? "default" : "ghost"}
            aria-pressed={status === filter.value}
            onClick={() => changeStatus(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {history.isError ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-md border bg-card py-12 text-sm text-muted-foreground shadow-sm">
          {getReconciliationTaskErrorMessage(history.error, "No se pudo cargar el historial.")}
          <Button size="sm" variant="outline" onClick={() => void history.refetch()}>Reintentar</Button>
        </div>
      ) : history.isPending ? (
        <div className="flex flex-col space-y-3">
          {[0, 1, 2].map((index) => <Skeleton key={index} className="h-14 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border bg-card py-16 text-muted-foreground shadow-sm">
          <History className="mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm italic">No hay unificaciones en el historial para este filtro.</p>
        </div>
      ) : (
        <div className="overflow-auto rounded-md border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Vía</TableHead>
                <TableHead>Queda (madre)</TableHead>
                <TableHead>Se unió</TableHead>
                <TableHead>Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => {
                const rejectedNames = item.status === "rejected" && !item.winner && item.losers.length === 0
                  ? item.items.map((taskItem) => taskItem.variant_name).filter(Boolean)
                  : [];
                return (
                  <TableRow key={item.id} data-testid={`history-row-${item.id}`}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(item.resolved_at ?? item.created_at)}</TableCell>
                    <TableCell className="text-sm">{item.resolved_by.email || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <Badge variant={item.status === "rejected" ? "destructive" : "secondary"}>
                          {item.action ? ACTION_LABEL[item.action] : item.status === "rejected" ? ACTION_LABEL.reject : "Aplicada"}
                        </Badge>
                        {item.derived ? (
                          <Badge variant="outline" className="border-amber-300 text-amber-800" title={DERIVED_TITLE}>
                            Detalle reconstruido
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{VIA_LABEL[item.via] ?? item.via}</TableCell>
                    <TableCell>{item.winner ? <VariantLine variant={item.winner} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      {item.losers.length > 0 ? (
                        <div className="space-y-2">
                          {item.losers.map((loser) => <VariantLine key={loser.variant_id} variant={loser} />)}
                        </div>
                      ) : rejectedNames.length > 0 ? (
                        <span className="text-xs text-muted-foreground">No se unió: {rejectedNames.join(" · ")}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {stockText(item)}
                      {showCost && item.price_base !== null ? (
                        <span className="block text-xs text-muted-foreground">Costo {formatMoney(item.price_base)}</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {!history.isError && (history.data?.meta.totalPages ?? 0) > 1 ? (
        <Pagination
          currentPage={page}
          totalPages={history.data?.meta.totalPages ?? 1}
          totalItems={history.data?.meta.total ?? 0}
          itemsPerPage={UNIFICATION_HISTORY_PAGE_SIZE}
          onPageChange={setPage}
          itemName="registros"
        />
      ) : null}

      <p className="text-xs italic text-muted-foreground">
        El historial no se puede borrar ni editar. Una unificación no se deshace: si algo quedó mal, se corrige con un ajuste de stock.
      </p>
    </div>
  );
}
