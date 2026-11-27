"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { OrderDetailButton, OrderDetailModalProvider } from "@/components/orders/OrderDetailModal";
import { settlementMoney } from "@/services/courierSettlementsService";
import {
  fromCents,
  pendingIssueHelp,
  pendingIssueLabels,
  type PendingCollection,
} from "./pendingCollections";

const PERIODS = [
  { value: "7", label: "Últimos 7 días" },
  { value: "30", label: "Últimos 30 días" },
  { value: "60", label: "Últimos 60 días" },
  { value: "90", label: "Últimos 90 días" },
  { value: "all", label: "Todo" },
] as const;
type Period = (typeof PERIODS)[number]["value"];
const ALL = "__all__";
const PAGE_SIZE = 25;
export const MAX_LIQUIDATION_ORDERS = 100;
const selectClass = "rounded-md border bg-background px-2 py-2 text-sm";

const money = (cents: number, currency: string | null) => settlementMoney(fromCents(cents), currency ?? "");
const courierKey = (row: PendingCollection) => `${row.courierLabel}\u0000${row.currency ?? ""}`;
export const canLiquidate = (row: PendingCollection) =>
  !row.issue && !!row.courierId && !!row.currency && row.pendingCents > 0;
const compatible = (a: PendingCollection, b: PendingCollection) =>
  a.courierId === b.courierId && a.currency === b.currency;

export function PorLiquidarPanel({
  rows,
  readOnly,
  onConfirm,
  onRegister,
}: {
  rows: PendingCollection[];
  /** Sin permiso financiero: solo consulta y exportación. */
  readOnly: boolean;
  onConfirm: (row: PendingCollection) => void;
  onRegister: (rows: PendingCollection[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [courier, setCourier] = useState<string>(ALL);
  const [period, setPeriod] = useState<Period>("60");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const inPeriod = useMemo(
    () => (period === "all" ? rows : rows.filter((row) => row.days <= Number(period))),
    [rows, period],
  );
  const summary = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; currency: string | null; count: number; cents: number; oldest: number; blocked: number }>();
    for (const row of inPeriod) {
      const key = courierKey(row);
      const group = groups.get(key) ?? { key, label: row.courierLabel, currency: row.currency, count: 0, cents: 0, oldest: 0, blocked: 0 };
      group.count += 1;
      if (Number.isFinite(row.pendingCents)) group.cents += row.pendingCents;
      group.oldest = Math.max(group.oldest, row.days);
      if (!canLiquidate(row)) group.blocked += 1;
      groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => b.cents - a.cents || a.label.localeCompare(b.label));
  }, [inPeriod]);
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return inPeriod.filter(
      (row) =>
        (courier === ALL || courierKey(row) === courier) &&
        (!term || `${row.orderNumber} ${row.customerName}`.toLocaleLowerCase().includes(term)),
    );
  }, [inPeriod, courier, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selected = rows.filter((row) => selectedIds.has(row.orderId) && canLiquidate(row));
  const first = selected[0];
  const selectedCents = selected.reduce((sum, row) => sum + row.pendingCents, 0);

  function selectable(row: PendingCollection) {
    if (readOnly || !canLiquidate(row)) return false;
    if (selectedIds.has(row.orderId)) return true;
    return (!first || compatible(first, row)) && selected.length < MAX_LIQUIDATION_ORDERS;
  }
  function toggle(row: PendingCollection) {
    if (!selectable(row)) return;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(row.orderId)) next.delete(row.orderId);
      else next.add(row.orderId);
      return next;
    });
  }
  function selectVisible() {
    const base = first ?? visible.find((row) => !readOnly && canLiquidate(row));
    if (!base) return;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      for (const row of visible) {
        if (next.size >= MAX_LIQUIDATION_ORDERS) break;
        if (canLiquidate(row) && compatible(base, row)) next.add(row.orderId);
      }
      return next;
    });
  }
  async function exportRows() {
    const source = selected.length ? selected : filtered;
    if (!source.length || exporting) return;
    setExporting(true);
    try {
      const [XLSX, { saveAs }] = await Promise.all([import("xlsx"), import("file-saver")]);
      const sheet = XLSX.utils.json_to_sheet(
        source.map((row) => ({
          Pedido: row.orderNumber,
          Cliente: row.customerName,
          Tienda: row.storeName ?? "",
          Courier: row.courierLabel,
          "Última actualización": row.updatedAt?.slice(0, 10) ?? "",
          Días: row.days,
          Moneda: row.currency ?? "",
          Total: fromCents(row.totalCents),
          "Pagado directo al negocio": fromCents(row.paidToBusinessCents),
          "Esperado del courier": fromCents(row.expectedCents),
          "Ya confirmado": fromCents(row.confirmedCents),
          Pendiente: fromCents(row.pendingCents),
          Observación: row.issue ? pendingIssueLabels[row.issue] : "",
        })),
      );
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Por liquidar");
      const buffer = XLSX.write(book, { bookType: "xlsx", type: "array" });
      saveAs(
        new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `por-liquidar_${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <OrderDetailModalProvider isOperaciones showTracking>
      <div className="space-y-4">
        <p className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
          Pedidos entregados cuyo cobro el courier todavía no rindió. Esperado = total del pedido − pagos
          recibidos directo por el negocio (los pagos contraentrega y en efectivo los tiene el courier). Es una
          estimación para reclamar: el cobro queda registrado recién cuando lo confirmas.
        </p>

        {summary.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumen por courier">
            {summary.map((group) => (
              <button
                key={group.key}
                type="button"
                aria-pressed={courier === group.key}
                onClick={() => {
                  setCourier((value) => (value === group.key ? ALL : group.key));
                  setPage(1);
                }}
                className={`rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/40 ${courier === group.key ? "border-primary bg-primary/5" : "bg-card"}`}
              >
                <p className="font-semibold">{group.label}</p>
                <p className="mt-1 text-lg font-bold">{money(group.cents, group.currency)}</p>
                <p className="text-xs text-muted-foreground">
                  {group.count} {group.count === 1 ? "pedido" : "pedidos"} · el más antiguo hace {group.oldest}{" "}
                  {group.oldest === 1 ? "día" : "días"}
                  {group.blocked > 0 && ` · ${group.blocked} con observación`}
                </p>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="max-w-xs"
            aria-label="Buscar pedido o cliente por liquidar"
            placeholder="Buscar pedido o cliente"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <select
            aria-label="Filtrar por courier"
            className={selectClass}
            value={courier}
            onChange={(event) => {
              setCourier(event.target.value);
              setPage(1);
            }}
          >
            <option value={ALL}>Todos los couriers</option>
            {summary.map((group) => (
              <option key={group.key} value={group.key}>
                {group.label}
                {group.currency && group.currency !== "PEN" ? ` (${group.currency})` : ""}
              </option>
            ))}
          </select>
          <select
            aria-label="Período por última actualización"
            className={selectClass}
            value={period}
            onChange={(event) => {
              setPeriod(event.target.value as Period);
              setPage(1);
            }}
          >
            {PERIODS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            disabled={exporting || (!selected.length && !filtered.length)}
            onClick={() => void exportRows()}
          >
            {exporting ? "Exportando…" : selected.length ? "Exportar selección" : "Exportar Excel"}
          </Button>
        </div>

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">
                Selecciona pedidos del mismo courier para registrar su liquidación (máximo{" "}
                {MAX_LIQUIDATION_ORDERS}).
              </span>
            ) : (
              <>
                <span>
                  {selected.length} {selected.length === 1 ? "pedido" : "pedidos"} de {first.courierLabel} ·{" "}
                  {money(selectedCents, first.currency)}
                </span>
                <Button type="button" onClick={() => onRegister(selected)}>
                  Registrar liquidación
                </Button>
                <Button type="button" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                  Limpiar selección
                </Button>
              </>
            )}
            <Button type="button" variant="link" className="ml-auto" disabled={!visible.length} onClick={selectVisible}>
              Seleccionar los de esta página
            </Button>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40">
              <tr>
                {!readOnly && <th className="p-3">Sel.</th>}
                <th className="p-3">Pedido / cliente</th>
                <th className="p-3">Courier</th>
                <th className="p-3">Actualizado</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Pagado al negocio</th>
                <th className="p-3 text-right">Por cobrar al courier</th>
                {!readOnly && <th className="p-3">Acción</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.orderId} className="border-t align-top">
                  {!readOnly && (
                    <td className="p-3">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar ${row.orderNumber}`}
                        checked={selectedIds.has(row.orderId) && canLiquidate(row)}
                        disabled={!selectable(row)}
                        onChange={() => toggle(row)}
                      />
                    </td>
                  )}
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{row.orderNumber}</span>
                      <OrderDetailButton orderId={row.orderId} orderNumber={row.orderNumber} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {row.customerName}
                      {row.storeName ? ` · ${row.storeName}` : ""}
                    </p>
                  </td>
                  <td className="p-3">
                    <p>{row.courierLabel}</p>
                    {row.issue && (
                      <p className="mt-1 text-xs text-amber-700" title={pendingIssueHelp[row.issue]}>
                        {pendingIssueLabels[row.issue]}
                        {(row.issue === "COURIER_NOT_REGISTERED" ||
                          row.issue === "COURIER_INACTIVE" ||
                          row.issue === "COURIER_AMBIGUOUS") && (
                          <>
                            {" · "}
                            <Link href="/configuracion/tiendas" className="underline">
                              Ver couriers
                            </Link>
                          </>
                        )}
                      </p>
                    )}
                  </td>
                  <td className="p-3">
                    <p>{row.updatedAt?.slice(0, 10) ?? "—"}</p>
                    <p className={`text-xs ${row.days > 15 ? "font-medium text-red-600" : "text-muted-foreground"}`}>
                      hace {row.days} {row.days === 1 ? "día" : "días"}
                    </p>
                  </td>
                  <td className="p-3 text-right">{money(row.totalCents, row.currency)}</td>
                  <td className="p-3 text-right">{money(row.paidToBusinessCents, row.currency)}</td>
                  <td className="p-3 text-right">
                    <p className="font-semibold">{money(row.pendingCents, row.currency)}</p>
                    {row.confirmedCents > 0 && (
                      <p className="text-xs text-muted-foreground">
                        ya confirmado {money(row.confirmedCents, row.currency)}
                      </p>
                    )}
                  </td>
                  {!readOnly && (
                    <td className="p-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!canLiquidate(row)}
                        title={row.issue ? pendingIssueHelp[row.issue] : undefined}
                        onClick={() => onConfirm(row)}
                      >
                        Confirmar cobro
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {rows.length === 0
                ? "No hay pedidos entregados con cobro pendiente del courier."
                : "No hay pedidos por liquidar para estos filtros."}
            </p>
          )}
        </div>
        {filtered.length > PAGE_SIZE && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filtered.length}
            itemsPerPage={PAGE_SIZE}
            onPageChange={setPage}
            itemName="pedidos"
          />
        )}
      </div>
    </OrderDetailModalProvider>
  );
}
