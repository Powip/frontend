"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  apiErrorMessage,
  daysWaiting,
  daysWaitingLabel,
  stockStateInfo,
  type OrderStockAccess,
} from "@/lib/orderStock";
import {
  getStockTray,
  handleOutOfStockOrder,
  type StockHandlingAction,
  type StockTray,
  type StockTrayRow,
} from "@/services/orderStockService";

// FEAT-24 H2-F — Inventario › Pedidos sin stock. «Sin stock» es de Atención al
// cliente (cambio, espera con plantilla de WhatsApp, anular o volver a
// reservar); «Sin reserva» es de Operaciones (volver a reservar). Las
// alternativas sugeridas todavía no existen: no se muestra nada en su lugar.

const PAGE_SIZE = 50;

const HANDLING_LABEL: Record<string, string> = {
  cambio: "Cambio pedido",
  espera: "En espera",
  anulado: "Anulado",
};

interface Props {
  companyId: string;
  access: OrderStockAccess;
}

interface WaitTemplate {
  orderNumber: string;
  template: string;
  whatsappUrl: string | null;
}

export default function OutOfStockTab({ companyId, access }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tray, setTray] = useState<StockTray>(access.customer ? "sin-stock" : "sin-reserva");
  const [offsets, setOffsets] = useState<Record<StockTray, number>>({ "sin-stock": 0, "sin-reserva": 0 });
  const [waiting, setWaiting] = useState<WaitTemplate | null>(null);
  const [cancelling, setCancelling] = useState<StockTrayRow | null>(null);

  const trayQuery = (name: StockTray, enabled: boolean) => ({
    queryKey: ["stock-tray", companyId, name, offsets[name]],
    queryFn: () => getStockTray(name, { limit: PAGE_SIZE, offset: offsets[name] }),
    enabled: Boolean(companyId) && enabled,
    retry: false,
    staleTime: 0,
  });
  const sinStock = useQuery(trayQuery("sin-stock", access.customer));
  const sinReserva = useQuery(trayQuery("sin-reserva", access.sinReserva));

  const handling = useMutation({
    mutationFn: ({ row, action }: { row: StockTrayRow; action: StockHandlingAction }) => handleOutOfStockOrder(row.orderId, action),
    onSuccess: (result, { row }) => {
      void queryClient.invalidateQueries({ queryKey: ["stock-tray", companyId] });
      if (result.action === "espera") {
        setWaiting({ orderNumber: row.orderNumber, template: result.template, whatsappUrl: result.whatsappUrl });
      } else if (result.action === "cambio") {
        toast.info(result.next, {
          action: { label: "Editar pedido", onClick: () => router.push(`/registrar-venta?orderId=${encodeURIComponent(row.orderId)}`) },
        });
      } else if (result.action === "anular") {
        setCancelling(null);
        toast.success(`Pedido ${row.orderNumber} anulado`);
      } else if (result.stockState === "reserved") {
        toast.success(`Pedido ${row.orderNumber} reservado`);
      } else {
        const label = stockStateInfo(result.stockState)?.label;
        toast.info(`Pedido ${row.orderNumber}: ${label ? `sigue «${label}»` : "se volvió a pedir la reserva"}.`);
      }
    },
    onError: (error, { action }) => {
      if (action === "anular") setCancelling(null);
      toast.error(apiErrorMessage(error, "No se pudo gestionar el pedido. Inténtalo de nuevo."));
    },
  });
  const busyOrder = handling.isPending ? handling.variables?.row.orderId : null;

  const run = (row: StockTrayRow, action: StockHandlingAction) => handling.mutate({ row, action });

  const copyTemplate = async () => {
    if (!waiting) return;
    try {
      await navigator.clipboard.writeText(waiting.template);
      toast.success("Mensaje copiado");
    } catch {
      toast.error("No se pudo copiar. Selecciónalo y cópialo a mano.");
    }
  };

  const renderTable = (name: StockTray, query: typeof sinStock) => {
    if (query.isPending) return <p className="text-sm text-muted-foreground">Cargando pedidos…</p>;
    if (query.isError)
      return (
        <div role="alert" className="rounded-md border border-destructive p-4 text-sm">
          No se pudieron cargar los pedidos. {apiErrorMessage(query.error, "Inténtalo de nuevo.")}
          <Button variant="outline" size="sm" className="ml-3" onClick={() => void query.refetch()}>
            Reintentar
          </Button>
        </div>
      );
    const page = query.data;
    if (page.rows.length === 0)
      return (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed py-10 text-sm text-muted-foreground">
          <Inbox className="h-8 w-8 opacity-40" aria-hidden="true" />
          {name === "sin-stock" ? "No hay pedidos sin stock." : "No hay pedidos sin reserva."}
        </div>
      );
    const offset = offsets[name];
    return (
      <div className="space-y-3">
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-2">Pedido</th>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2">Productos</th>
                <th className="px-4 py-2">Esperando</th>
                <th className="px-4 py-2" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {page.rows.map((row) => {
                const busy = busyOrder === row.orderId;
                const handlingLabel = row.handling ? HANDLING_LABEL[row.handling] : undefined;
                return (
                  <tr key={row.orderId} className="border-t align-top" data-testid={`tray-row-${row.orderId}`}>
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold">{row.orderNumber}</span>
                      {handlingLabel ? (
                        <Badge variant="secondary" className="ml-2">
                          {handlingLabel}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span>{row.customer.fullName || "—"}</span>
                      {row.customer.phoneNumber ? (
                        <span className="block text-xs text-muted-foreground">{row.customer.phoneNumber}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <ul className="space-y-1">
                        {row.lines.map((line) => (
                          <li key={line.itemId}>
                            <span>{line.productName || line.sku || "Producto"}</span>{" "}
                            <span className="font-medium">× {line.quantity}</span>
                            {line.sku && line.productName ? (
                              <span className="block text-xs text-muted-foreground">SKU {line.sku}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{daysWaitingLabel(daysWaiting(row.outOfStockSince))}</td>
                    <td className="px-4 py-3">
                      {access.customer ? (
                        <div className="flex flex-wrap justify-end gap-1">
                          {name === "sin-stock" ? (
                            <>
                              <Button size="sm" variant="outline" disabled={busy} aria-label={`Cambio de ${row.orderNumber}`} onClick={() => run(row, "cambio")}>
                                Cambio
                              </Button>
                              <Button size="sm" variant="outline" disabled={busy} aria-label={`Espera de ${row.orderNumber}`} onClick={() => run(row, "espera")}>
                                Espera
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                disabled={busy}
                                aria-label={`Anular ${row.orderNumber}`}
                                onClick={() => setCancelling(row)}
                              >
                                Anular
                              </Button>
                            </>
                          ) : null}
                          <Button size="sm" disabled={busy} aria-label={`Re-reservar ${row.orderNumber}`} onClick={() => run(row, "re_reservar")}>
                            Re-reservar
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {page.total > PAGE_SIZE ? (
          <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
            <span>
              {offset + 1}–{Math.min(offset + page.rows.length, page.total)} de {page.total}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffsets((current) => ({ ...current, [name]: Math.max(0, offset - PAGE_SIZE) }))}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={offset + PAGE_SIZE >= page.total}
              onClick={() => setOffsets((current) => ({ ...current, [name]: offset + PAGE_SIZE }))}
            >
              Siguiente
            </Button>
          </div>
        ) : null}
        {!access.customer ? (
          <p className="text-xs text-muted-foreground">
            Volver a reservar es de Atención al cliente o de quien gestiona Operaciones.
          </p>
        ) : null}
      </div>
    );
  };

  if (!access.sinReserva) {
    return <p className="text-sm text-muted-foreground">No tienes permiso para ver los pedidos sin stock.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        <strong>Sin stock</strong>: no había unidades para reservar; Atención al cliente decide si ofrece un cambio, si el
        cliente espera o si se anula. <strong>Sin reserva</strong>: la reserva se liberó o no se pudo hacer; Operaciones la
        vuelve a pedir.
      </p>

      <Tabs value={tray} onValueChange={(value) => setTray(value as StockTray)}>
        <TabsList>
          {access.customer ? (
            <TabsTrigger value="sin-stock" className="gap-2">
              Sin stock
              {sinStock.isSuccess ? <Badge variant="secondary">{sinStock.data.total}</Badge> : null}
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="sin-reserva" className="gap-2">
            Sin reserva
            {sinReserva.isSuccess ? <Badge variant="secondary">{sinReserva.data.total}</Badge> : null}
          </TabsTrigger>
        </TabsList>
        {access.customer ? (
          <TabsContent value="sin-stock" className="mt-4">
            {renderTable("sin-stock", sinStock)}
          </TabsContent>
        ) : null}
        <TabsContent value="sin-reserva" className="mt-4">
          {renderTable("sin-reserva", sinReserva)}
        </TabsContent>
      </Tabs>

      <Dialog open={waiting !== null} onOpenChange={(open) => !open && setWaiting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avisar al cliente que espere</DialogTitle>
            <DialogDescription>
              Pedido {waiting?.orderNumber}: copia el mensaje o ábrelo en WhatsApp para enviarlo.
            </DialogDescription>
          </DialogHeader>
          <p
            data-testid="wait-template"
            className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm"
          >
            {waiting?.template}
          </p>
          {waiting && !waiting.whatsappUrl ? (
            <p className="text-xs text-muted-foreground">El cliente no tiene teléfono: copia el mensaje y envíalo por otro medio.</p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => void copyTemplate()}>
              <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
              Copiar
            </Button>
            {waiting?.whatsappUrl ? (
              <Button asChild>
                <a href={waiting.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  Abrir WhatsApp
                </a>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelling !== null} onOpenChange={(open) => !open && !handling.isPending && setCancelling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Anular el pedido {cancelling?.orderNumber}?</DialogTitle>
            <DialogDescription>El pedido se anula porque no hay stock. No se puede deshacer desde aquí.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={handling.isPending} onClick={() => setCancelling(null)}>
              Volver
            </Button>
            <Button
              variant="destructive"
              disabled={handling.isPending}
              onClick={() => cancelling && run(cancelling, "anular")}
            >
              Anular pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
