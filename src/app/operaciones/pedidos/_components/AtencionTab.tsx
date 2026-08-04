"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Eye, Clock3, MessageCircle, PackageCheck, TrendingDown } from "lucide-react";
import {
  SalesTableFilters,
  SalesFilters,
  emptySalesFilters,
  applyFilters,
} from "@/components/ventas/SalesTableFilters";
import { ITEMS_PER_PAGE, PedidosActions, Sale, money, daysSince } from "./types";
import { FailureBadge, DiasBadge, WhatsAppIcon, formatDateTime, guessFailureReason } from "./shared";

type AtencionSubView = "trabados" | "reprogramados" | "devoluciones";

/**
 * Clasificación de sub-vista dentro de "Necesita Atención".
 *
 * No existe hoy un campo estructurado de "motivo de reprogramación de
 * entrega" separado de `callbackAt` (ver operations-pedidos-tabs.ts) — acá
 * se usa la misma señal: si tiene `callbackAt` seteado y no es una
 * devolución, se considera "reprogramado". Devoluciones = shalomStatus
 * DEVUELTO. Todo lo demás con error de courier cae en "Trabados".
 */
function classify(sale: Sale): AtencionSubView {
  if (sale.shalomStatus === "DEVUELTO") return "devoluciones";
  if (sale.callbackAt) return "reprogramados";
  return "trabados";
}

function isVencido(sale: Sale): boolean {
  if (!sale.callbackAt) return false;
  return new Date(sale.callbackAt).getTime() < Date.now();
}

const SUB_VIEWS: { value: AtencionSubView; label: string }[] = [
  { value: "trabados", label: "Trabados" },
  { value: "reprogramados", label: "Reprogramados" },
  { value: "devoluciones", label: "Devoluciones" },
];

export function AtencionTab({
  sales,
  actions,
  initialSearch,
  initialQf,
}: {
  sales: Sale[];
  actions: PedidosActions;
  initialSearch?: string;
  initialQf?: string;
}) {
  const [filters, setFilters] = useState<SalesFilters>({
    ...emptySalesFilters,
    search: initialSearch ?? "",
  });
  const [subView, setSubView] = useState<AtencionSubView>(
    initialQf === "fallidos" ? "devoluciones" : initialQf === "errores-agencia" ? "trabados" : "trabados",
  );
  const [motivoChip, setMotivoChip] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const bySubView = useMemo(() => sales.filter((s) => classify(s) === subView), [sales, subView]);

  const motivoOptions = useMemo(() => {
    if (subView !== "trabados") return [];
    const set = new Set<string>();
    for (const s of bySubView) set.add(guessFailureReason(s));
    return Array.from(set);
  }, [bySubView, subView]);

  const byMotivo = useMemo(
    () => (subView === "trabados" && motivoChip ? bySubView.filter((s) => guessFailureReason(s) === motivoChip) : bySubView),
    [bySubView, subView, motivoChip],
  );

  const filtered = useMemo(() => applyFilters(byMotivo, filters), [byMotivo, filters]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const enJuego = useMemo(() => bySubView.reduce((sum, s) => sum + s.total, 0), [bySubView]);

  const selectedSales = filtered.filter((s) => selectedIds.has(s.id));
  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllPage = () => {
    setSelectedIds((prev) => {
      const allSelected = paged.every((s) => prev.has(s.id));
      const next = new Set(prev);
      paged.forEach((s) => (allSelected ? next.delete(s.id) : next.add(s.id)));
      return next;
    });
  };

  const changeSubView = (v: AtencionSubView) => {
    setSubView(v);
    setMotivoChip("");
    setSelectedIds(new Set());
    setPage(1);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {SUB_VIEWS.map((v) => {
          const count = sales.filter((s) => classify(s) === v.value).length;
          return (
            <button
              key={v.value}
              onClick={() => changeSubView(v.value)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                subView === v.value
                  ? "border-red-500 bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                  : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
              }`}
            >
              {v.label} ({count})
            </button>
          );
        })}
      </div>

      {subView === "trabados" && bySubView.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          <span>💰</span>
          <div>
            <b>{money(enJuego)} en juego</b> — valor total de los {bySubView.length} pedidos trabados en agencia o con
            error del courier.
          </div>
        </div>
      )}

      {subView === "trabados" && motivoOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setMotivoChip("")}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${motivoChip === "" ? "border-violet-500 bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"}`}
          >
            Todos los motivos
          </button>
          {motivoOptions.map((m) => (
            <button
              key={m}
              onClick={() => setMotivoChip(motivoChip === m ? "" : m)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${motivoChip === m ? "border-violet-500 bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"}`}
            >
              {m} ({bySubView.filter((s) => guessFailureReason(s) === m).length})
            </button>
          ))}
        </div>
      )}

      <SalesTableFilters
        filters={filters}
        onFiltersChange={(f) => {
          setFilters(f);
          setPage(1);
        }}
        showZoneFilter
        showCourierFilter
        availableCouriers={actions.apiCouriers}
      />

      {subView !== "devoluciones" && selectedSales.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
          <span className="text-xs font-semibold text-muted-foreground">{selectedSales.length} seleccionados</span>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            onClick={() => actions.onBulkDeliveryReschedule(selectedSales.map((s) => s.id))}
          >
            <Clock3 className="h-3.5 w-3.5" />
            Reprogramar en lote
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => actions.onBulkWhatsApp(selectedSales)}>
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp masivo
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted/60">
            <TableRow>
              {subView !== "devoluciones" && (
                <TableHead className="w-8">
                  <Checkbox checked={paged.length > 0 && paged.every((s) => selectedIds.has(s.id))} onCheckedChange={toggleAllPage} />
                </TableHead>
              )}
              <TableHead>N° Orden</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Distrito</TableHead>
              <TableHead>Guía / Courier</TableHead>
              <TableHead>Detalle</TableHead>
              {subView === "trabados" && <TableHead>Trabado hace</TableHead>}
              <TableHead>Total / Saldo</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  Nada pendiente en esta sub-vista
                </TableCell>
              </TableRow>
            )}
            {paged.map((sale) => {
              const vencido = subView === "reprogramados" && isVencido(sale);
              return (
                <TableRow key={sale.id} className={vencido ? "bg-red-50 dark:bg-red-500/5" : undefined}>
                  {subView !== "devoluciones" && (
                    <TableCell>
                      <Checkbox checked={selectedIds.has(sale.id)} onCheckedChange={() => toggle(sale.id)} />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{sale.orderNumber}</TableCell>
                  <TableCell>
                    <div className="font-medium">{sale.clientName}</div>
                    <div className="text-xs text-muted-foreground">{sale.phoneNumber}</div>
                  </TableCell>
                  <TableCell className="text-sm">{sale.district || "—"}</TableCell>
                  <TableCell className="text-sm">
                    {sale.guideNumber || "—"} · {sale.courier || "—"}
                  </TableCell>
                  <TableCell>
                    {subView === "reprogramados" ? (
                      <span className={`text-xs font-medium ${vencido ? "text-red-600" : "text-muted-foreground"}`}>
                        {vencido ? "Vencido — era para " : "Reprogramado para "}
                        {formatDateTime(sale.callbackAt)}
                      </span>
                    ) : subView === "devoluciones" ? (
                      <FailureBadge shalomError={sale.shalomError} syncErrors={sale.syncErrors} />
                    ) : (
                      <FailureBadge shalomError={sale.shalomError} syncErrors={sale.syncErrors} />
                    )}
                  </TableCell>
                  {subView === "trabados" && (
                    <TableCell>
                      <DiasBadge days={daysSince(sale.updatedAt)} />
                    </TableCell>
                  )}
                  <TableCell className="text-sm tabular-nums">
                    {money(sale.total)}
                    {sale.pendingPayment > 0 && (
                      <div className="text-xs font-semibold text-red-600">Saldo {money(sale.pendingPayment)}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {subView === "devoluciones" ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-xs"
                            onClick={() => actions.onReturnToStock(sale)}
                          >
                            <PackageCheck className="h-3 w-3" />
                            Reingresar a stock
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-xs text-amber-700 hover:text-amber-800"
                            onClick={() => actions.onMarkAsLoss(sale)}
                          >
                            <TrendingDown className="h-3 w-3" />
                            Marcar merma
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          onClick={() => actions.onDeliveryReschedule(sale)}
                        >
                          <Clock3 className="h-3 w-3" />
                          Reprogramar
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:text-green-700" title="WhatsApp" onClick={() => actions.onWhatsApp(sale)}>
                        <WhatsAppIcon className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Ver pedido" onClick={() => actions.onView(sale)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={filtered.length}
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={setPage}
        itemName="pedidos"
      />
    </div>
  );
}
