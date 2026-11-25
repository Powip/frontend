"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Copy, FileDown, FileSpreadsheet, Loader2, MessageSquare, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import ImportSalesModal from "@/components/modals/ImportSalesModal";
import { useAuth } from "@/contexts/AuthContext";
import { useCrmMe } from "@/hooks/useCrmMe";
import { useRefreshQuote, useSalesBoard } from "@/hooks/useCrmSalesTools";
import { usePdfDownload } from "@/hooks/usePdfDownload";
import { crmError } from "@/services/crmService";
import type { PdfDocSpec } from "@/lib/pdf/document";
import type { SalesBoardRow, SalesBucket, SalesFilter } from "@/types/crmSalesTools";
import { NATIVE_SELECT_CLASS, bandejaUrl, formatMoney } from "./format";
import { useSalesBoardExtras } from "@/hooks/useCrmAjustesE";
import type { SalesBoardExtra } from "@/types/crmAjustesE";
import { CityCell, ExtraActions, PayShipCell } from "./VentasExtras";

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
  facebook: "Facebook",
  tiktok: "TikTok",
};

const FILTERS: Array<{ value: SalesFilter; label: string }> = [
  { value: "pending", label: "Pendientes" },
  { value: "cancelled", label: "Anuladas" },
  { value: "all", label: "Todas" },
];

const BUCKET_LABEL: Record<SalesBucket, string> = {
  pending: "Pendiente",
  cancelled: "Anulada",
  done: "Cerrada",
};

const BUCKET_VARIANT: Record<SalesBucket, "outline" | "destructive" | "secondary"> = {
  pending: "outline",
  cancelled: "destructive",
  done: "secondary",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

/** PDF de una cotización o pedido del chat, con el formato común de Powip. */
export function salesRowPdfSpec(row: SalesBoardRow): PdfDocSpec {
  const isQuote = row.kind === "quote";
  const number = row.number ?? row.coreId;
  const total = row.total ?? 0;
  return {
    title: isQuote ? "Cotización" : "Pedido",
    number,
    date: formatDate(row.createdAt),
    meta: [
      ["Cliente", row.contactName ?? "Sin nombre"],
      ["Vendedora", row.sellerName ?? "—"],
      ["Estado", row.status ?? BUCKET_LABEL[row.bucket]],
    ],
    tables: [
      {
        head: ["Concepto", "Monto"],
        rows: [
          ["Total", formatMoney(total)],
          ...(isQuote ? [] : [["Pagado", formatMoney(row.paid)], ["Saldo", formatMoney(Math.max(total - row.paid, 0))]]),
        ],
        align: ["left", "right"],
      },
    ],
    note: row.publicUrl ? `Ver y pagar en línea: ${row.publicUrl}` : undefined,
    fileName: `${isQuote ? "cotizacion" : "pedido"}-${number}.pdf`,
  };
}

function RowActions({ row, extra }: { row: SalesBoardRow; extra?: SalesBoardExtra }) {
  const download = usePdfDownload();
  const refresh = useRefreshQuote();
  const [pdfBusy, setPdfBusy] = useState(false);
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label={`Descargar PDF de ${row.number ?? row.coreId}`}
        disabled={pdfBusy}
        onClick={async () => {
          setPdfBusy(true);
          try {
            await download(salesRowPdfSpec(row));
          } catch {
            toast.error("No se pudo generar el PDF.");
          } finally {
            setPdfBusy(false);
          }
        }}
      >
        {pdfBusy ? <Loader2 className="animate-spin" /> : <FileDown />}
        PDF
      </Button>
      {row.publicUrl && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={`Copiar enlace de ${row.number ?? row.coreId}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(row.publicUrl ?? "");
              toast.success("Enlace copiado: pégalo en el chat para reenviarlo.");
            } catch {
              toast.error("No se pudo copiar el enlace.");
            }
          }}
        >
          <Copy />
          Enlace
        </Button>
      )}
      {row.kind === "quote" && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={`Actualizar ${row.number ?? row.coreId} desde el Core`}
          disabled={refresh.isPending}
          onClick={() => refresh.mutate(row.id)}
        >
          <RefreshCw className={refresh.isPending ? "animate-spin" : undefined} />
        </Button>
      )}
      <ExtraActions row={row} extra={extra} />
      <Button asChild size="sm" variant="ghost">
        <Link href={bandejaUrl(row.conversationId)} aria-label={`Abrir chat de ${row.contactName ?? "cliente"}`}>
          <MessageSquare />
          {row.channel === "whatsapp" ? "WhatsApp" : "Chat"}
        </Link>
      </Button>
    </div>
  );
}

/** Pestaña Ventas: cotizaciones y pedidos del chat, con accesos al Core (fila 58). */
export default function VentasView() {
  const [status, setStatus] = useState<SalesFilter>("pending");
  const [days, setDays] = useState(60);
  const { data, isLoading, isError, error, refetch } = useSalesBoard(status, days);
  // Contadores de las pestañas (mockup 152): una sola consulta «Todas» del mismo periodo.
  const allQuery = useSalesBoard("all", days);
  const counts = useMemo(() => {
    const list = allQuery.data ?? [];
    return {
      pending: list.filter((r) => r.bucket === "pending").length,
      cancelled: list.filter((r) => r.bucket === "cancelled").length,
      all: list.length,
    } satisfies Record<SalesFilter, number>;
  }, [allQuery.data]);
  // R5: solo el administrador importa ventas desde Excel.
  const { isAdmin } = useCrmMe();
  const err = isError ? crmError(error) : null;

  const { auth } = useAuth();
  const stores = auth?.company?.stores ?? [];
  const [storeId, setStoreId] = useState<string>("");
  const store = stores.find((s) => s.id === (storeId || stores[0]?.id));
  const [importOpen, setImportOpen] = useState(false);
  const sellerName = auth?.user ? `${auth.user.name || ""} ${auth.user.surname || ""}`.trim() : undefined;

  const rows = data ?? [];
  // V3: ciudad, envío y pagos vienen del Core (ms-ventas) por pedido.
  const extras = useSalesBoardExtras(rows.map((r) => r.orderId ?? ""));
  const extraOf = (r: SalesBoardRow) => (r.orderId ? extras.data?.[r.orderId] : undefined);
  const extrasLoading = extras.isLoading && extras.fetchStatus !== "idle";
  const totals = useMemo(
    () => rows.reduce((acc, r) => ({ total: acc.total + (r.total ?? 0), paid: acc.paid + r.paid }), { total: 0, paid: 0 }),
    [rows],
  );

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Ventas</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link href="/registrar-venta">
              <Plus />
              Nueva venta
            </Link>
          </Button>
          {isAdmin && (
            <Button type="button" size="sm" variant="outline" disabled={!store} onClick={() => setImportOpen(true)}>
              <FileSpreadsheet />
              {store ? `Importar Excel a ${store.name}` : "Importar Excel"}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div role="group" aria-label="Estado" className="inline-flex rounded-md border p-0.5">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              type="button"
              size="sm"
              variant={status === f.value ? "default" : "ghost"}
              aria-pressed={status === f.value}
              onClick={() => setStatus(f.value)}
            >
              {f.label}
              {allQuery.data && (
                <span aria-hidden title={`${counts[f.value]} documentos`} className="ml-1 rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-foreground" data-testid={`count-${f.value}`}>
                  {counts[f.value]}
                </span>
              )}
            </Button>
          ))}
        </div>
        <div className="w-36 space-y-1">
          <Label htmlFor="ventas-days">Periodo</Label>
          <select id="ventas-days" className={NATIVE_SELECT_CLASS} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={60}>Últimos 60 días</option>
            <option value={90}>Últimos 90 días</option>
          </select>
        </div>
        {isAdmin && stores.length > 1 && (
          <div className="w-44 space-y-1">
            <Label htmlFor="ventas-store">Tienda para importar</Label>
            <select
              id="ventas-store"
              className={NATIVE_SELECT_CLASS}
              value={store?.id ?? ""}
              onChange={(e) => setStoreId(e.target.value)}
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isLoading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando ventas…
        </p>
      )}
      {err && (
        <div role="alert" className="space-y-2 rounded-md border border-destructive/30 p-3 text-sm">
          <p className="font-medium text-destructive">{err.message}</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {data && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay cotizaciones ni pedidos del chat con este filtro.</p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 font-medium">Documento</th>
                <th className="px-2 py-1.5 font-medium">Cliente</th>
                <th className="px-2 py-1.5 font-medium">Ciudad / provincia</th>
                <th className="px-2 py-1.5 font-medium">Pago / envío</th>
                <th className="px-2 py-1.5 font-medium">Origen</th>
                <th className="px-2 py-1.5 font-medium">Vendedora</th>
                <th className="px-2 py-1.5 font-medium">Fecha</th>
                <th className="px-2 py-1.5 text-right font-medium">Total</th>
                <th className="px-2 py-1.5 text-right font-medium">Pagado</th>
                <th className="px-2 py-1.5 text-right font-medium">Saldo</th>
                <th className="px-2 py-1.5 font-medium">Estado</th>
                <th className="px-2 py-1.5 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.kind}-${r.id}`} className="border-t" data-testid="sales-row">
                  <td className="px-2 py-1.5">
                    <span className="font-medium">{r.kind === "quote" ? "Cotización" : "Pedido"}</span>{" "}
                    <span className="text-muted-foreground">{r.number ?? r.coreId}</span>
                  </td>
                  <td className="px-2 py-1.5">
                    {r.contactName ?? "Sin nombre"}
                    {extraOf(r)?.phone && <span className="block text-xs text-muted-foreground">{extraOf(r)?.phone}</span>}
                  </td>
                  <td className="px-2 py-1.5" data-testid="row-city">
                    <CityCell extra={extraOf(r)} loading={!!r.orderId && extrasLoading} />
                  </td>
                  <td className="px-2 py-1.5" data-testid="row-payship">
                    <PayShipCell extra={extraOf(r)} loading={!!r.orderId && extrasLoading} />
                  </td>
                  <td className="px-2 py-1.5">
                    {r.channel ? (CHANNEL_LABEL[r.channel] ?? r.channel) : "Chat"}
                  </td>
                  <td className="px-2 py-1.5">{r.sellerName ?? "—"}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.total === null ? "—" : formatMoney(r.total)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.kind === "order" ? formatMoney(r.paid) : "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" data-testid="row-balance">
                    {r.kind === "order" && r.total !== null ? formatMoney(Math.max(r.total - r.paid, 0)) : "—"}
                  </td>
                  <td className="px-2 py-1.5">
                    <Badge variant={BUCKET_VARIANT[r.bucket]}>{BUCKET_LABEL[r.bucket]}</Badge>
                  </td>
                  <td className="px-2 py-1.5">
                    <RowActions row={r} extra={extraOf(r)} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-medium">
                <td className="px-2 py-1.5" colSpan={7}>
                  {rows.length} documento{rows.length === 1 ? "" : "s"}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(totals.total)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(totals.paid)}</td>
                <td />
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {isAdmin && store && (
        <ImportSalesModal
          isOpen={importOpen}
          onClose={() => setImportOpen(false)}
          onSuccess={() => {
            setImportOpen(false);
            refetch();
          }}
          storeId={store.id}
          userId={auth?.user?.id}
          sellerName={sellerName}
        />
      )}
    </div>
  );
}
