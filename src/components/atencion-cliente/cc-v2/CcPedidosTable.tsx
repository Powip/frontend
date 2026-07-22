"use client";

import { FileText, MessageCircle, DollarSign, AlertTriangle, UserPen, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderHeader, SubEstadoCc, TipoGestionCC } from "@/interfaces/IOrder";
import AliclikStatusBadge from "@/components/aliclik/AliclikStatusBadge";
import EvaStatusBadge from "@/components/eva/EvaStatusBadge";
import SendToEvaButton from "@/components/eva/SendToEvaButton";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/* ---------- Sub-estado chip ---------- */
const SUB_ESTADO_STYLES: Record<SubEstadoCc, { label: string; cls: string }> = {
  por_confirmar:        { label: "Por confirmar",  cls: "bg-red-100 text-red-700 border border-red-200" },
  contactado:           { label: "Contactado",     cls: "bg-blue-100 text-blue-700 border border-blue-200" },
  no_contesta:          { label: "No contesta",    cls: "bg-amber-100 text-amber-700 border border-amber-200" },
  anulado_cc:           { label: "Anulado CC",     cls: "bg-gray-100 text-gray-600 border border-gray-200" },
  confirmado:           { label: "Confirmado",     cls: "bg-green-100 text-green-700 border border-green-200" },
  reprogramado:         { label: "Reprogramado",   cls: "bg-violet-100 text-violet-700 border border-violet-200" },
  entrega_lima:         { label: "Entrega Lima",   cls: "bg-teal-100 text-teal-700 border border-teal-200" },
  carrito_sin_contactar:{ label: "Sin contactar",  cls: "bg-purple-100 text-purple-700 border border-purple-200" },
  carrito_contactado:   { label: "Contactado",     cls: "bg-blue-100 text-blue-700 border border-blue-200" },
  carrito_recuperado:   { label: "Recuperado ✓",   cls: "bg-green-100 text-green-700 border border-green-200" },
};

/* ---------- Canal chip ---------- */
const CANAL_COLORS: Record<string, string> = {
  releasit:           "bg-orange-100 text-orange-700",
  shopify_cod:        "bg-green-100 text-green-700",
  shopify_pagado:     "bg-emerald-100 text-emerald-700",
  tiktok_live:        "bg-pink-100 text-pink-700",
  catalogo_cod:       "bg-indigo-100 text-indigo-700",
  google_sheets:      "bg-yellow-100 text-yellow-700",
  whatsapp_manual:    "bg-green-100 text-green-700",
  carrito_abandonado: "bg-purple-100 text-purple-700",
};

function resolveStoreName(order: OrderHeader): string | null {
  const src = order.externalSource?.toLowerCase() ?? "";

  if (src === "shopify" || src.includes("shopify")) {
    const raw = order.externalData;
    if (!raw) return null;

    const parsed: any =
      typeof raw === "string"
        ? (() => { try { return JSON.parse(raw); } catch { return null; } })()
        : raw;
    if (!parsed) return null;

    const vendor = parsed?.line_items?.[0]?.vendor;
    if (vendor && String(vendor).trim()) return String(vendor).trim().toUpperCase();

    const statusUrl = parsed?.order_status_url;
    if (statusUrl) {
      try {
        const host = new URL(String(statusUrl)).hostname.replace(/^www\./, "").split(".")[0];
        if (host) return host.toUpperCase();
      } catch { /* URL malformada */ }
    }
    return null;
  }

  if (src === "google_sheets") return "SHEETS";
  if (src) return src.toUpperCase();
  return null;
}

function IntentoDots({ intentos, max = 3 }: { intentos: number; max?: number }) {
  return (
    <div className="flex gap-0.5 items-center">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full ${i < intentos ? "bg-red-500" : "bg-gray-200 dark:bg-slate-600"}`}
        />
      ))}
    </div>
  );
}

interface Props {
  data: OrderHeader[];
  tipoGestion: TipoGestionCC;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
  onVerPedido: (order: OrderHeader) => void;
  onWhatsApp: (order: OrderHeader) => void;
  onGestionarPago: (order: OrderHeader) => void;
  onReassignSeller?: (order: OrderHeader) => void;
  onRecuperar?: (order: OrderHeader) => void;
  onEvaSent?: (order: OrderHeader) => void;
  page?: number;
  totalPages?: number;
  total?: number;
  onPageChange?: (page: number) => void;
}

export function CcPedidosTable({
  data,
  tipoGestion,
  selectedIds,
  onToggle,
  onToggleAll,
  onVerPedido,
  onWhatsApp,
  onGestionarPago,
  onReassignSeller,
  onRecuperar,
  onEvaSent,
  page = 1,
  totalPages = 1,
  total,
  onPageChange,
}: Props) {
  const showAdelanto = tipoGestion === "cod";
  const showIntentos = tipoGestion === "cod" || tipoGestion === "carrito";

  const allSelected = data.length > 0 && data.every((o) => selectedIds.has(o.id));

  const showPagination = onPageChange && totalPages > 1;

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => onToggleAll(data.map((o) => o.id))}
                className="cursor-pointer"
              />
            </TableHead>
            <TableHead>N° Orden</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Tienda</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead>Sub-estado</TableHead>
            <TableHead>Aliclik</TableHead>
            <TableHead>EVA</TableHead>
            {showAdelanto && <TableHead>Adelanto</TableHead>}
            {showAdelanto && <TableHead>Por cobrar</TableHead>}
            <TableHead>Total</TableHead>
            <TableHead>Upsell</TableHead>
            {showIntentos && <TableHead>Intentos</TableHead>}
            <TableHead>Vendedor</TableHead>
            <TableHead>Región</TableHead>
            <TableHead>Resumen</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((order) => {
            const clientName = order.customer?.fullName ?? "—";
            const phone = order.customer?.phoneNumber ?? "—";
            const grandTotal = Number(order.grandTotal ?? 0);
            const totalPaid = (order.payments ?? [])
              .filter((p) => p.status === "PAID")
              .reduce((s, p) => s + Number(p.amount), 0);
            const porCobrar = Math.max(grandTotal - totalPaid, 0);

            const subEstado = order.subEstadoCc;
            const subStyle = subEstado ? SUB_ESTADO_STYLES[subEstado] : null;
            const canalStyle = order.canalOrigen
              ? (CANAL_COLORS[order.canalOrigen] ?? "bg-gray-100 text-gray-600")
              : "bg-gray-100 text-gray-600";

            const dniFaltante = !order.datosCompletos && !order.dniCliente;

            return (
              <TableRow key={order.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(order.id)}
                    onChange={() => onToggle(order.id)}
                    className="cursor-pointer"
                  />
                </TableCell>

                <TableCell className="font-mono text-xs font-semibold">
                  {order.orderNumber}
                </TableCell>

                {/* Fecha de creación */}
                <TableCell className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">
                  {order.created_at
                    ? format(new Date(order.created_at), "dd/MM/yy", { locale: es })
                    : "—"}
                </TableCell>

                {/* Cliente + badge DNI faltante */}
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{clientName}</span>
                    {dniFaltante && (
                      <span
                        title="DNI faltante — requerido para courier"
                        className="text-red-500 flex-shrink-0"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                </TableCell>

                <TableCell className="text-xs">{phone}</TableCell>

                {/* Tienda badge — vendor de Shopify o canal de origen */}
                <TableCell>
                  {(() => {
                    const name = resolveStoreName(order);
                    return name ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 uppercase tracking-wide">
                        {name}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    );
                  })()}
                </TableCell>

                {/* Canal chip */}
                <TableCell>
                  {order.canalOrigen ? (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${canalStyle}`}>
                      {order.canalOrigen}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </TableCell>

                {/* Sub-estado chip */}
                <TableCell>
                  {subStyle ? (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${subStyle.cls}`}>
                      {subStyle.label}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </TableCell>

                {/* Aliclik badge */}
                <TableCell>
                  <AliclikStatusBadge
                    aliclikDispatchStatus={order.aliclikDispatchStatus}
                    aliclikSyncedAt={order.aliclikSyncedAt}
                  />
                </TableCell>

                {/* EVA badge + envío */}
                <TableCell>
                  <div className="flex flex-col gap-1 items-start">
                    <EvaStatusBadge
                      evaStatus={order.evaStatus}
                      evaSyncedAt={order.evaSyncedAt}
                    />
                    <SendToEvaButton
                      orderId={order.id}
                      recipientName={clientName}
                      recipientPhone={order.customer?.phoneNumber ?? ""}
                      district={order.customer?.district ?? ""}
                      address={order.customer?.address ?? ""}
                      amount={grandTotal}
                      onSuccess={() => onEvaSent?.(order)}
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      label="Enviar"
                    />
                  </div>
                </TableCell>

                {showAdelanto && (
                  <TableCell className="text-green-600 text-sm font-medium">
                    S/{totalPaid.toFixed(2)}
                  </TableCell>
                )}
                {showAdelanto && (
                  <TableCell className="text-red-600 text-sm font-medium">
                    S/{porCobrar.toFixed(2)}
                  </TableCell>
                )}

                <TableCell className="text-sm">S/{grandTotal.toFixed(2)}</TableCell>

                {/* Upsell */}
                <TableCell className="text-center">
                  {(() => {
                    const count = (order.items ?? [])
                      .filter((i) => i.isPromoItem)
                      .reduce((s, i) => s + (i.quantity ?? 0), 0);
                    return count > 0 ? (
                      <span className="text-[11px] font-bold text-orange-600 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 px-2 py-0.5 rounded-full">
                        +{count}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    );
                  })()}
                </TableCell>

                {showIntentos && (
                  <TableCell>
                    <IntentoDots intentos={order.callAttempts ?? 0} />
                  </TableCell>
                )}

                <TableCell className="text-xs">
                  <span className="inline-flex items-center gap-1">
                    <span>{order.sellerName ?? "—"}</span>
                    {onReassignSeller && (
                      <button
                        title="Reasignar vendedor"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => onReassignSeller(order)}
                      >
                        <UserPen className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                </TableCell>

                <TableCell className="text-xs text-gray-500 dark:text-slate-400">{order.salesRegion}</TableCell>

                {/* Ver pedido */}
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => onVerPedido(order)}>
                    <FileText className="h-3.5 w-3.5 mr-1" />
                    Ver
                  </Button>
                </TableCell>

                {/* Acciones */}
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7 bg-amber-50 hover:bg-amber-100 text-amber-600"
                      onClick={() => onGestionarPago(order)}
                      title="Gestionar pagos"
                    >
                      <DollarSign className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7 bg-green-500 hover:bg-green-600 text-white border-green-600"
                      onClick={() => onWhatsApp(order)}
                      title="WhatsApp"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </Button>
                    {order.subEstadoCc === "anulado_cc" && onRecuperar && (
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-indigo-300"
                        onClick={() => onRecuperar(order)}
                        title="Recuperar venta"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {data.length === 0 && (
            <TableRow>
              <TableCell colSpan={19} className="text-center text-gray-400 dark:text-slate-500 py-8 text-sm">
                No hay pedidos en esta categoría
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Paginación */}
      {showPagination && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Página {page} de {totalPages}
            {total != null && ` — ${total} pedidos en total`}
          </p>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            {/* Números de página: ventana de 5 alrededor de la actual */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…" ? (
                  <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-gray-400">…</span>
                ) : (
                  <Button
                    key={p}
                    size="sm"
                    variant={p === page ? "default" : "outline"}
                    className="h-7 min-w-[28px] text-xs px-2"
                    onClick={() => onPageChange(p as number)}
                  >
                    {p}
                  </Button>
                ),
              )}

            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
