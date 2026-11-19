"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, History, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { canSeeProductCosts } from "@/config/permissions.config";
import {
  UNIFICATION_HISTORY_EXPORT_LIMIT,
  listUnificationHistory,
  type UnificationHistoryFilters,
  type UnificationHistoryStatus,
  type UnificationVariantSnapshot,
  type UnificationVia,
} from "@/services/unification.service";
import { getReconciliationTaskErrorMessage } from "@/services/reconciliationTask.service";
import { formatMoney } from "@/lib/money";
import { downloadFile } from "@/utils/http/download-file";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VIA_LABEL, variantDisplayLabel } from "./unificationRules";
import {
  HISTORY_DATE_PRESETS,
  HISTORY_VIA_OPTIONS,
  buildHistoryCsv,
  formatHistoryDate,
  historyActionLabel,
  historyCsvFilename,
  historyDateRange,
  historyRejectedNames,
  historyStockText,
  normalizeEmailFilter,
  type HistoryDatePreset,
} from "./unificationHistoryFilters";

export const UNIFICATION_HISTORY_PAGE_SIZE = 10;
export const UNIFICATION_HISTORY_QUERY_KEY = "unification-history";
const EMAIL_DEBOUNCE_MS = 400;

type StatusFilter = "" | UnificationHistoryStatus;

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "", label: "Todas" },
  { value: "confirmed", label: "Aplicadas" },
  { value: "rejected", label: "Rechazadas" },
];

const DERIVED_TITLE =
  "Resuelta antes del historial detallado: la variante que quedó y las que se unieron se dedujeron del catálogo, y no se guardó el modo de stock.";

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-background px-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function VariantLine({ variant }: { variant: UnificationVariantSnapshot }) {
  return (
    <div className="text-sm">
      <span className="font-medium">{variant.product_name || "Variante sin nombre"}</span>
      <span className="block text-xs text-muted-foreground">{variantDisplayLabel(variant.attribute_values)}</span>
      <span className="block font-mono text-[11px] text-muted-foreground">{variant.company_sku || variant.sku || "Sin SKU"}</span>
    </div>
  );
}

/**
 * FEAT-24 H11 (H11-D5) — Historial de la Unificación: tareas confirmadas y rechazadas, con quién y
 * cuándo, la variante que quedó, las que se unieron y el modo de stock. Filtros por estado, fecha
 * (en hora de Lima), correo de quien resolvió y vía, y «Exportar CSV» con esos mismos filtros (hasta
 * 500 filas). Es de solo lectura y sin «deshacer»: el libro es inmutable y un error se corrige con un
 * ajuste.
 */
export function UnificationHistoryTable({ companyId }: { companyId: string | undefined }) {
  const { auth } = useAuth();
  const showCost = canSeeProductCosts(auth?.user);
  const [status, setStatus] = useState<StatusFilter>("");
  const [datePreset, setDatePreset] = useState<HistoryDatePreset>("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [resolvedBy, setResolvedBy] = useState<string | undefined>(undefined);
  const [via, setVia] = useState<"" | UnificationVia>("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [knownEmails, setKnownEmails] = useState<string[]>([]);

  // El correo se aplica cuando se deja de escribir.
  useEffect(() => {
    const next = normalizeEmailFilter(emailInput);
    if (next === resolvedBy) return;
    const timer = setTimeout(() => {
      setResolvedBy(next);
      setPage(1);
      setExportNotice(null);
    }, EMAIL_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [emailInput, resolvedBy]);

  const range = historyDateRange(datePreset, desde, hasta);
  const filters: UnificationHistoryFilters = {
    ...(status ? { status } : {}),
    ...(range.from ? { from: range.from } : {}),
    ...(range.to ? { to: range.to } : {}),
    ...(resolvedBy ? { resolvedBy } : {}),
    ...(via ? { via } : {}),
  };
  const hasFilters = Object.keys(filters).length > 0 || emailInput.trim() !== "" || datePreset !== "";

  const history = useQuery({
    queryKey: [UNIFICATION_HISTORY_QUERY_KEY, companyId, auth?.user?.id, filters, page],
    queryFn: () => listUnificationHistory({ page, limit: UNIFICATION_HISTORY_PAGE_SIZE, ...filters }),
    enabled: Boolean(companyId && auth?.company?.id === companyId && auth?.user?.id && auth?.accessToken && !range.error),
    placeholderData: keepPreviousData,
    retry: false,
  });

  // Correos vistos, para sugerirlos en el filtro (tiene que ser el correo exacto).
  const pageEmails = (history.data?.data ?? []).map((item) => item.resolved_by.email).filter((email): email is string => Boolean(email));
  const pageEmailsKey = pageEmails.join("\n");
  useEffect(() => {
    if (!pageEmailsKey) return;
    setKnownEmails((current) => {
      const merged = [...new Set([...current, ...pageEmailsKey.split("\n")])].sort();
      return merged.length === current.length ? current : merged;
    });
  }, [pageEmailsKey]);

  const changed = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
    setExportNotice(null);
  };

  const clearFilters = () => {
    setStatus("");
    setDatePreset("");
    setDesde("");
    setHasta("");
    setEmailInput("");
    setResolvedBy(undefined);
    setVia("");
    setPage(1);
    setExportNotice(null);
  };

  const exportCsv = async () => {
    if (range.error) return;
    setExporting(true);
    setExportNotice(null);
    try {
      const result = await listUnificationHistory({ page: 1, limit: UNIFICATION_HISTORY_EXPORT_LIMIT, ...filters });
      if (result.data.length === 0) {
        setExportNotice("No hay registros para exportar con estos filtros.");
        toast.info("No hay registros para exportar con estos filtros.");
        return;
      }
      downloadFile({
        blob: new Blob([buildHistoryCsv(result.data, showCost)], { type: "text/csv;charset=utf-8" }),
        filename: historyCsvFilename(),
      });
      if (result.meta.total > result.data.length) {
        const message = `Se exportaron los ${result.data.length} registros más recientes de ${result.meta.total}. Acota las fechas para exportar el resto.`;
        setExportNotice(message);
        toast.warning(message);
      } else {
        toast.success(`Se exportaron ${result.data.length} ${result.data.length === 1 ? "registro" : "registros"}.`);
      }
    } catch (error) {
      toast.error(getReconciliationTaskErrorMessage(error, "No se pudo exportar el historial."));
    } finally {
      setExporting(false);
    }
  };

  const rows = history.data?.data ?? [];

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="inline-flex w-fit rounded-md border p-0.5" role="group" aria-label="Estado">
          {STATUS_FILTERS.map((filter) => (
            <Button
              key={filter.value || "todas"}
              type="button"
              size="sm"
              variant={status === filter.value ? "default" : "ghost"}
              aria-pressed={status === filter.value}
              onClick={() => changed(setStatus)(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
        <select
          aria-label="Fecha"
          className={SELECT_CLASS}
          value={datePreset}
          onChange={(event) => changed(setDatePreset)(event.target.value as HistoryDatePreset)}
        >
          {HISTORY_DATE_PRESETS.map((option) => (
            <option key={option.value || "todas"} value={option.value}>{option.label}</option>
          ))}
        </select>
        {datePreset === "range" ? (
          <>
            <label className="flex flex-col text-xs text-muted-foreground">
              Desde
              <Input type="date" className="h-9 w-40" value={desde} onChange={(event) => changed(setDesde)(event.target.value)} />
            </label>
            <label className="flex flex-col text-xs text-muted-foreground">
              Hasta
              <Input type="date" className="h-9 w-40" value={hasta} onChange={(event) => changed(setHasta)(event.target.value)} />
            </label>
          </>
        ) : null}
        <div className="w-60">
          <Input
            type="email"
            aria-label="Correo del usuario"
            placeholder="Correo de quien resolvió"
            className="h-9"
            list="unification-history-emails"
            maxLength={320}
            value={emailInput}
            onChange={(event) => setEmailInput(event.target.value)}
          />
          <datalist id="unification-history-emails">
            {knownEmails.map((email) => <option key={email} value={email} />)}
          </datalist>
        </div>
        <select
          aria-label="Vía"
          className={SELECT_CLASS}
          value={via}
          onChange={(event) => changed(setVia)(event.target.value as "" | UnificationVia)}
        >
          {HISTORY_VIA_OPTIONS.map((option) => (
            <option key={option.value || "todas"} value={option.value}>{option.label}</option>
          ))}
        </select>
        {hasFilters ? (
          <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>Limpiar filtros</Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ml-auto"
          disabled={exporting || Boolean(range.error)}
          title={`Descarga hasta ${UNIFICATION_HISTORY_EXPORT_LIMIT} registros con los filtros actuales.`}
          onClick={() => void exportCsv()}
        >
          {exporting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
          Exportar CSV
        </Button>
      </div>
      {exportNotice ? (
        <p role="status" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          {exportNotice}
        </p>
      ) : null}

      {range.error ? (
        <p role="alert" className="rounded-md border border-destructive/40 px-3 py-6 text-center text-sm text-destructive">
          {range.error}
        </p>
      ) : history.isError ? (
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
          <p className="text-sm italic">No hay unificaciones en el historial para estos filtros.</p>
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
                const rejectedNames = historyRejectedNames(item);
                return (
                  <TableRow key={item.id} data-testid={`history-row-${item.id}`}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatHistoryDate(item.resolved_at ?? item.created_at)}</TableCell>
                    <TableCell className="text-sm">{item.resolved_by.email || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <Badge variant={item.status === "rejected" ? "destructive" : "secondary"}>
                          {historyActionLabel(item)}
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
                      {historyStockText(item)}
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

      {!range.error && !history.isError && (history.data?.meta.totalPages ?? 0) > 1 ? (
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
