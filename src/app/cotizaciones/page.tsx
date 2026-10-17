"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCheck,
  Clock3,
  Eye,
  FileText,
  Link2,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { PacksProvider } from "@/contexts/PacksContext";
import {
  deleteQuotation,
  getQuotation,
  listQuotations,
  renewQuotation,
} from "@/services/quotationService";
import type { Quotation, QuotationListResponse, QuotationStatus } from "@/types/quotations";
import QuotationForm from "@/components/quotations/QuotationForm";
import {
  activeQuotationPayment,
  depositAmount,
  QuotationConvertDialog,
  QuotationDetailDialog,
  QuotationPaymentDialog,
  QuotationShareDialog,
} from "@/components/quotations/QuotationDialogs";
import {
  errorMessage,
  formatExpiry,
  money,
  quotationHasStockIssue,
  quotationStatus,
  quotationWhatsAppUrl,
  statusClasses,
  statusLabels,
} from "@/components/quotations/quotationHelpers";

type Panel = "detail" | "edit" | "payment" | "share" | "convert";
const tabs: { value: QuotationStatus | "ALL"; label: string }[] = [
  { value: "PREVENTA", label: "Pendientes" },
  { value: "CONVERTIDA", label: "Convertidas a venta" },
  { value: "VENCIDA", label: "Vencidas" },
  { value: "ALL", label: "Todas" },
];
const initialSummary = { PREVENTA: 0, CONVERTIDA: 0, VENCIDA: 0, totalAmount: 0 };

function QuotationsContent() {
  const { auth, selectedStoreId, setSelectedStore } = useAuth();
  const [result, setResult] = useState<QuotationListResponse>({
    data: [],
    total: 0,
    page: 1,
    limit: 15,
    summary: initialSummary,
  });
  const [tab, setTab] = useState<QuotationStatus | "ALL">("PREVENTA");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newQuotation, setNewQuotation] = useState(false);
  const [active, setActive] = useState<{ quotation: Quotation; panel: Panel } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Quotation[]>([]);
  const [busy, setBusy] = useState("");
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const request = useRef(0);
  const canReviewPayments = (auth?.user.permissions || []).includes("VIEW_FINANCES") || ["ADMIN", "SUPER_ADMIN", "OWNER"].includes(auth?.user.role?.toUpperCase() || "");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const reload = useCallback(
    async (quiet = false) => {
      const currentRequest = ++request.current;
      if (!selectedStoreId) {
        setLoading(false);
        return;
      }
      if (!quiet) setLoading(true);
      try {
        const data = await listQuotations({
          storeId: selectedStoreId,
          status: tab === "ALL" ? undefined : tab,
          page,
          limit: 15,
          search: debouncedSearch || undefined,
        });
        if (request.current !== currentRequest) return;
        setResult(data);
        setError("");
        setSelected(
          (previous) =>
            new Set(
              [...previous].filter((id) => data.data.some((quotation) => quotation.id === id)),
            ),
        );
        if (page > 1 && data.data.length === 0) setPage(page - 1);
      } catch (failure) {
        if (request.current === currentRequest)
          setError(errorMessage(failure, "No se pudieron cargar las cotizaciones."));
      } finally {
        if (request.current === currentRequest) setLoading(false);
      }
    },
    [selectedStoreId, tab, page, debouncedSearch],
  );
  useEffect(() => {
    void reload();
    const interval = setInterval(() => void reload(true), 30000);
    return () => {
      ++request.current;
      clearInterval(interval);
    };
  }, [reload]);
  useEffect(() => {
    setActive(null);
    setNewQuotation(false);
    setSelected(new Set());
    setPage(1);
    setResult({ data: [], total: 0, page: 1, limit: 15, summary: initialSummary });
  }, [selectedStoreId]);

  async function open(quotation: Quotation, panel: Panel) {
    setBusy(quotation.id);
    try {
      const fresh = await getQuotation(quotation.id);
      if ((panel === "edit" || panel === "convert") && quotationStatus(fresh) !== "PREVENTA") {
        toast.error("Esta cotización ya no está vigente. Actualiza el listado.");
        void reload();
        return;
      }
      setActive({ quotation: fresh, panel });
    } catch (failure) {
      toast.error(errorMessage(failure, "No se pudo abrir la cotización."));
    } finally {
      setBusy("");
    }
  }
  async function renew(quotation: Quotation) {
    setBusy(quotation.id);
    try {
      await renewQuotation(quotation.id);
      toast.success(`${quotation.number} renovada por 24 horas.`);
      await reload(true);
    } catch (failure) {
      toast.error(errorMessage(failure, "No se pudo renovar la cotización."));
    } finally {
      setBusy("");
    }
  }
  async function confirmDelete() {
    const targets = deleting;
    setDeleting([]);
    setBusy("delete");
    const responses = await Promise.allSettled(
      targets.map((quotation) => deleteQuotation(quotation.id)),
    );
    const succeeded = responses.filter((response) => response.status === "fulfilled").length;
    if (succeeded)
      toast.success(`${succeeded} cotización${succeeded > 1 ? "es eliminadas" : " eliminada"}.`);
    responses.forEach((response) => {
      if (response.status === "rejected")
        toast.error(errorMessage(response.reason, "No se pudo eliminar una cotización."));
    });
    setSelected(new Set());
    await reload(true);
    setBusy("");
  }
  function saved() {
    setActive(null);
    setNewQuotation(false);
    void reload();
  }
  function changeTab(value: QuotationStatus | "ALL") {
    setTab(value);
    setPage(1);
    setSelected(new Set());
  }
  const selectedRows = result.data.filter((quotation) => selected.has(quotation.id));
  const totalPages = Math.max(1, Math.ceil(result.total / result.limit));
  const summary = result.summary || initialSummary;
  const allCount = summary.PREVENTA + summary.VENCIDA + summary.CONVERTIDA;

  return (
    <>
      <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-teal-600" />
              <h1 className="text-2xl font-bold tracking-tight">Cotizaciones</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Cotiza rápido. Completa el despacho cuando tu cliente decida.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Tienda
              <select
                aria-label="Tienda de cotización"
                className="h-10 min-w-44 rounded-md border bg-background px-3 text-sm text-foreground"
                value={selectedStoreId ?? ""}
                onChange={(event) => setSelectedStore(event.target.value)}
              >
                <option value="" disabled>Selecciona una tienda</option>
                {(auth?.company?.stores ?? []).map((store) => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </label>
            <Button
              variant="outline"
              disabled={!selected.size}
              onClick={() => setWhatsAppOpen(true)}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Compartir por WhatsApp
            </Button>
            <Button
              className="bg-teal-600 text-white hover:bg-teal-700"
              disabled={!selectedStoreId}
              onClick={() => setNewQuotation(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nueva cotización
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            [Clock3, "Por cerrar", String(summary.PREVENTA)],
            [CheckCheck, "Convertidas a venta", String(summary.CONVERTIDA)],
            [Wallet, "Total cotizado", money(summary.totalAmount)],
          ].map(([Icon, label, value]) => {
            const MetricIcon = Icon as typeof Clock3;
            return (
              <div
                key={String(label)}
                className="flex items-center gap-3 rounded-2xl border bg-card p-4"
              >
                <span className="rounded-xl bg-teal-50 p-2.5 text-teal-600 dark:bg-teal-500/10">
                  <MetricIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">{String(label)}</p>
                  <p className="text-2xl font-semibold">{String(value)}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b px-4 pt-4">
            <div
              className="flex flex-wrap gap-1"
              role="tablist"
              aria-label="Estado de cotizaciones"
            >
              {tabs.map(({ value, label }) => (
                <button
                  key={value}
                  role="tab"
                  id={`quotation-tab-${value}`}
                  aria-selected={tab === value}
                  aria-controls="quotation-panel"
                  tabIndex={tab === value ? 0 : -1}
                  onKeyDown={(event) => {
                    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                    event.preventDefault();
                    const current = tabs.findIndex((item) => item.value === value);
                    const next =
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? tabs.length - 1
                          : (current + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) %
                            tabs.length;
                    changeTab(tabs[next].value);
                    document.getElementById(`quotation-tab-${tabs[next].value}`)?.focus();
                  }}
                  onClick={() => changeTab(value)}
                  className={`border-b-2 px-3 py-3 text-sm font-medium ${tab === value ? "border-teal-600 text-teal-700 dark:text-teal-300" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {label}{" "}
                  <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                    {value === "ALL" ? allCount : summary[value]}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 pb-4">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  aria-label="Buscar cotizaciones"
                  className="pl-9"
                  placeholder="Buscar por cliente, teléfono o cotización…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                aria-label="Actualizar cotizaciones"
                disabled={loading}
                onClick={() => void reload()}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-teal-50/60 px-4 py-3 text-sm dark:bg-teal-500/5">
              <span>
                {selected.size} seleccionada{selected.size > 1 ? "s" : ""}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
                  Quitar selección
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    !!busy ||
                    selectedRows.every((quotation) => quotationStatus(quotation) === "CONVERTIDA")
                  }
                  onClick={() =>
                    setDeleting(
                      selectedRows.filter(
                        (quotation) => quotationStatus(quotation) !== "CONVERTIDA",
                      ),
                    )
                  }
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Eliminar
                </Button>
              </div>
            </div>
          )}
          <div
            id="quotation-panel"
            role="tabpanel"
            aria-labelledby={`quotation-tab-${tab}`}
            className="overflow-x-auto"
          >
            {!selectedStoreId ? (
              <p className="p-12 text-center text-sm text-muted-foreground">
                Selecciona una tienda para ver sus cotizaciones.
              </p>
            ) : error ? (
              <div className="p-10 text-center">
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
                <Button variant="outline" className="mt-4" onClick={() => void reload()}>
                  Reintentar
                </Button>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center gap-2 p-16 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Cargando cotizaciones…
              </div>
            ) : result.data.length === 0 ? (
              <div className="p-14 text-center">
                <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-3 font-semibold">
                  {debouncedSearch
                    ? "No encontramos cotizaciones"
                    : "Todavía no hay cotizaciones aquí"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {debouncedSearch
                    ? "Prueba con otro cliente, teléfono o número."
                    : "Crea tu primera cotización con nombre, teléfono y productos."}
                </p>
                {!debouncedSearch && (
                  <Button
                    className="mt-5 bg-teal-600 hover:bg-teal-700"
                    onClick={() => setNewQuotation(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Nueva cotización
                  </Button>
                )}
              </div>
            ) : (
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-muted/30 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="w-10 p-3">
                      <Checkbox
                        aria-label="Seleccionar cotizaciones visibles"
                        checked={
                          selected.size === result.data.length
                            ? true
                            : selected.size
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={(checked) =>
                          setSelected(
                            checked
                              ? new Set(result.data.map((quotation) => quotation.id))
                              : new Set(),
                          )
                        }
                      />
                    </th>
                    {[
                      "N° Cotización",
                      "Cliente / Teléfono",
                      "Producto",
                      "Total",
                      "Adelanto",
                      "Vigencia",
                      "Estado",
                      "Fecha / Vendedor",
                      "Acciones",
                    ].map((label) => (
                      <th key={label} className="p-3 font-medium">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((quotation) => {
                    const status = quotationStatus(quotation);
                    const stockIssue = quotationHasStockIssue(quotation);
                    const deposit = depositAmount(quotation);
                    const pendingPayment =
                      activeQuotationPayment(quotation)?.status === "PENDIENTE";
                    const soon =
                      status === "PREVENTA" &&
                      new Date(quotation.expiresAt).getTime() - Date.now() < 3 * 3600000;
                    return (
                      <tr key={quotation.id} className="border-t hover:bg-muted/20">
                        <td className="p-3">
                          <Checkbox
                            aria-label={`Seleccionar ${quotation.number}`}
                            checked={selected.has(quotation.id)}
                            onCheckedChange={(checked) =>
                              setSelected((previous) => {
                                const next = new Set(previous);
                                if (checked) next.add(quotation.id);
                                else next.delete(quotation.id);
                                return next;
                              })
                            }
                          />
                        </td>
                        <td className="p-3">
                          <button
                            className="font-semibold text-teal-700 hover:underline dark:text-teal-300"
                            onClick={() => void open(quotation, "detail")}
                          >
                            {quotation.number}
                          </button>
                          {quotation.customerConfirmed && (
                            <p className="mt-1 text-[11px] text-emerald-700">
                              Confirmada por cliente
                            </p>
                          )}
                        </td>
                        <td className="p-3">
                          <p className="font-medium">{quotation.customerName}</p>
                          <p className="text-xs text-muted-foreground">{quotation.customerPhone}</p>
                        </td>
                        <td className="max-w-[220px] p-3">
                          <p
                            className="truncate"
                            title={quotation.lines.map((line) => line.name).join(", ")}
                          >
                            {quotation.lines[0]?.name || "—"}
                            {quotation.lines.length > 1 && (
                              <strong className="ml-1 text-teal-700">
                                +{quotation.lines.length - 1}
                              </strong>
                            )}
                          </p>
                          {stockIssue && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Revisar stock
                            </p>
                          )}
                        </td>
                        <td className="p-3 font-semibold whitespace-nowrap">
                          {money(quotation.total)}
                        </td>
                        <td className="p-3">
                          {deposit > 0 ? (
                            <>
                              <p className="font-medium">{money(deposit)}</p>
                              <p
                                className={`text-[11px] ${pendingPayment ? "text-amber-700" : "text-emerald-700"}`}
                              >
                                {pendingPayment ? "Por aprobar" : "Aprobado"}
                              </p>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td
                          className={`p-3 whitespace-nowrap text-xs ${status === "VENCIDA" ? "text-red-600" : soon ? "text-amber-700" : "text-muted-foreground"}`}
                        >
                          {formatExpiry(quotation)}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses[status]}`}
                          >
                            {statusLabels[status]}
                          </span>
                        </td>
                        <td className="p-3 text-xs">
                          <p>{new Date(quotation.createdAt).toLocaleDateString("es-PE")}</p>
                          <p className="mt-1 text-muted-foreground">
                            {quotation.sellerName || "—"}
                          </p>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            {busy === quotation.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : status === "PREVENTA" ? (
                              <Button
                                size="sm"
                                className="bg-teal-600 hover:bg-teal-700"
                                disabled={stockIssue}
                                title={
                                  stockIssue ? "Revisa el stock antes de convertir" : undefined
                                }
                                onClick={() => void open(quotation, "convert")}
                              >
                                Convertir
                                <ArrowRight className="ml-1 h-3.5 w-3.5" />
                              </Button>
                            ) : status === "VENCIDA" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void renew(quotation)}
                              >
                                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                                Renovar
                              </Button>
                            ) : (
                              <Link
                                href="/ventas"
                                className="text-xs font-medium text-teal-700 hover:underline"
                              >
                                {quotation.orderNumber || "Ver venta"}
                              </Link>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Acciones ${quotation.number}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => void open(quotation, "detail")}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Ver detalle
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => void open(quotation, "share")}>
                                  <Link2 className="mr-2 h-4 w-4" />
                                  Compartir link
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <a
                                    href={quotationWhatsAppUrl(quotation)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <MessageCircle className="mr-2 h-4 w-4" />
                                    Abrir WhatsApp
                                  </a>
                                </DropdownMenuItem>
                                {status !== "CONVERTIDA" && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => void open(quotation, "payment")}
                                    >
                                      <Wallet className="mr-2 h-4 w-4" />
                                      Registrar adelanto
                                    </DropdownMenuItem>
                                    {status === "PREVENTA" && (
                                      <DropdownMenuItem
                                        onClick={() => void open(quotation, "edit")}
                                      >
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Editar
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => setDeleting([quotation])}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Eliminar
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="flex items-center justify-between border-t p-4 text-xs text-muted-foreground">
            <p>
              {result.total} cotización{result.total !== 1 ? "es" : ""}
            </p>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => setPage((value) => value - 1)}
              >
                Anterior
              </Button>
              <span>
                {page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((value) => value + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      </div>
      {newQuotation && selectedStoreId && (
        <QuotationForm
          storeId={selectedStoreId}
          onClose={() => setNewQuotation(false)}
          onSaved={() => {
            toast.success("Cotización creada.");
            saved();
          }}
        />
      )}
      {active?.panel === "edit" && (
        <QuotationForm
          quotation={active.quotation}
          storeId={active.quotation.storeId}
          onClose={() => setActive(null)}
          onSaved={() => {
            toast.success("Cotización actualizada.");
            saved();
          }}
        />
      )}
      {active?.panel === "share" && (
        <QuotationShareDialog quotation={active.quotation} onClose={() => setActive(null)} />
      )}
      {active?.panel === "payment" && (
        <QuotationPaymentDialog
          quotation={active.quotation}
          onClose={() => setActive(null)}
          onSaved={saved}
        />
      )}
      {active?.panel === "convert" && (
        <QuotationConvertDialog
          quotation={active.quotation}
          onClose={() => setActive(null)}
          onSaved={saved}
        />
      )}
      {active?.panel === "detail" && (
        <QuotationDetailDialog
          quotation={active.quotation}
          canReviewPayments={canReviewPayments}
          onClose={() => setActive(null)}
          onUpdated={() => {
            void open(active.quotation, "detail");
            void reload(true);
          }}
          onEdit={() => setActive({ ...active, panel: "edit" })}
          onConvert={() => setActive({ ...active, panel: "convert" })}
          onPayment={() => setActive({ ...active, panel: "payment" })}
          onShare={() => setActive({ ...active, panel: "share" })}
        />
      )}
      <AlertDialog open={deleting.length > 0} onOpenChange={(open) => !open && setDeleting([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Eliminar{" "}
              {deleting.length === 1 ? deleting[0]?.number : `${deleting.length} cotizaciones`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción elimina las cotizaciones seleccionadas. Las cotizaciones convertidas se
              conservan en Ventas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={whatsAppOpen} onOpenChange={setWhatsAppOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Compartir cotizaciones</DialogTitle>
            <DialogDescription>
              Abre cada conversación para revisar el mensaje y enviarlo desde WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {selectedRows.map((quotation) => (
              <div
                className="flex items-center justify-between gap-3 rounded-xl border p-3"
                key={quotation.id}
              >
                <div>
                  <p className="text-sm font-semibold">{quotation.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {quotation.number} · {quotation.customerPhone}
                  </p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <a
                    href={quotationWhatsAppUrl(quotation)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir WhatsApp
                  </a>
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function QuotationsPage() {
  return (
    <PacksProvider>
      <QuotationsContent />
    </PacksProvider>
  );
}
