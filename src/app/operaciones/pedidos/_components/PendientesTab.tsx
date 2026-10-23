"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { commercialLeadHref, salesStatusBlockReason } from "@/utils/commercialOrders";
import { PackageCheck, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { OrderDetailButton } from "@/components/orders/OrderDetailModal";
import { FinancialStatusBadge } from "@/components/shared/FinancialStatusBadge";
import { SalesTableFilters, applyFilters, buildProductFilterOptions, emptySalesFilters, type SalesFilters } from "@/components/ventas/SalesTableFilters";
import { OPS_PERMISSIONS } from "@/config/operationsPermissions";
import { assignmentBlockReason } from "@/services/saleTrackingService";
import { ITEMS_PER_PAGE, money, type PedidosActions, type Sale } from "./types";
import { PaymentButton, ProductThumbnails, StatusPill, WhatsAppIcon } from "./shared";

/** Orders awaiting warehouse preparation; collecting payment never moves this queue. */
export function PendientesTab({ sales, actions, initialSearch }: { sales: Sale[]; actions: PedidosActions; initialSearch?: string }) {
  const [filters, setFilters] = useState<SalesFilters>({ ...emptySalesFilters, search: initialSearch ?? "" });
  const [page, setPage] = useState(1);
  const [preparing, setPreparing] = useState<string | null>(null);
  const filtered = useMemo(() => applyFilters(sales, filters), [sales, filters]);
  const products = useMemo(() => buildProductFilterOptions(sales), [sales]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const canPrepare = actions.can(OPS_PERMISSIONS.DISPATCH) || actions.can(OPS_PERMISSIONS.CHANGE_STATUS_MANUAL);

  async function prepare(sale: Sale) {
    setPreparing(sale.id);
    try { await actions.onChangeStatus(sale.id, "PREPARADO"); }
    catch { toast.error("No se pudo preparar el pedido. Vuelve a intentarlo."); }
    finally { setPreparing(null); }
  }

  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">Pedidos por preparar, pagados o con saldo. Prepara el paquete antes de asignarlo a una guía.</p>
    <SalesTableFilters filters={filters} onFiltersChange={(value) => { setFilters(value); setPage(1); }} showRegionFilter showProductFilter availableProducts={products} />
    <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
      <Table>
        <TableHeader className="bg-muted/60"><TableRow>
          <TableHead>N° Orden</TableHead><TableHead>Cliente</TableHead><TableHead>Productos</TableHead><TableHead>Etapa</TableHead><TableHead>Pago</TableHead><TableHead>Saldo</TableHead><TableHead className="text-right">Acciones</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {paged.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Sin pedidos pendientes de preparar</TableCell></TableRow>}
          {paged.map((sale) => {
            const blocked = salesStatusBlockReason(sale, "PREPARADO") || assignmentBlockReason(sale, "PREPARADO");
            return <TableRow key={sale.id}>
              <TableCell className="font-medium">{sale.orderNumber}</TableCell>
              <TableCell><div>{sale.clientName}</div><div className="text-xs text-muted-foreground">{sale.phoneNumber}</div></TableCell>
              <TableCell><ProductThumbnails items={sale.items} /></TableCell>
              <TableCell><StatusPill status={sale.status} />{blocked && <p className="mt-1 max-w-56 text-xs text-amber-700">{blocked}</p>}{sale.commercialLeadId && sale.commercialStockState === "DEFERRED" && <Link className="text-xs font-semibold text-violet-700 underline" href={commercialLeadHref(sale.commercialLeadId)}>Preparar reserva de stock</Link>}</TableCell>
              <TableCell><FinancialStatusBadge pendingAmount={sale.pendingPayment} /></TableCell>
              <TableCell className="tabular-nums">{money(sale.pendingPayment)}</TableCell>
              <TableCell><div className="flex items-center justify-end gap-1">
                <OrderDetailButton orderId={sale.id} orderNumber={sale.orderNumber} />
                <PaymentButton hasPendingApproval={sale.hasPendingApprovalPayments} onClick={() => actions.onOpenPayment(sale)} />
                <Button size="icon" variant="ghost" title="WhatsApp" onClick={() => actions.onWhatsApp(sale)}><WhatsAppIcon className="h-4 w-4" /></Button>
                {canPrepare && <>
                  <Button size="sm" variant="outline" title={blocked ?? "Imprimir etiqueta y preparar pedido"} disabled={!!blocked || actions.isBulkLoading || preparing !== null} onClick={() => actions.onBulkPrint([sale])}><Printer className="mr-1 h-3.5 w-3.5" />Imprimir</Button>
                  <Button size="sm" disabled={!!blocked || preparing !== null || actions.isBulkLoading} onClick={() => { void prepare(sale); }}><PackageCheck className="mr-1 h-3.5 w-3.5" />{preparing === sale.id ? "Preparando..." : "Preparar"}</Button>
                </>}
              </div></TableCell>
            </TableRow>;
          })}
        </TableBody>
      </Table>
    </div>
    <Pagination currentPage={page} totalPages={totalPages} totalItems={filtered.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setPage} itemName="pedidos" />
  </div>;
}
