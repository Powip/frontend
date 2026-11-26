"use client";

import { useMutation } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { olvaStatusBadgeVariant } from "@/components/olva/utils/olva-status-badge-variant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getOlvaShipmentStatusLabel } from "@/features/olva/olva-shipment/utils/get-olva-shipment-status-label";
import { isOlvaShipmentFinal } from "@/features/olva/olva-shipment/utils/is-olva-shipment-final";
import { OLVA_TRACKING_BATCH_MAX_SIZE } from "@/features/olva/olva-tracking/constants/olva-tracking.constants";
import type { OlvaTrackingBatchItem } from "@/features/olva/olva-tracking/models/olva-tracking-batch-item";
import type { OlvaTrackingLookup } from "@/features/olva/olva-tracking/models/olva-tracking-lookup";
import { trackOlvaShipmentsBatch } from "@/features/olva/olva-tracking/services/olva-tracking.service";
import { formatOlvaTrackingDate } from "@/features/olva/olva-tracking/utils/format-olva-tracking-date";
import { toOlvaTrackingLookup } from "@/features/olva/olva-tracking/utils/to-olva-tracking-lookup";
import {
  OLVA_SHIPMENT_STATUSES,
  type OlvaShipmentStatus,
} from "@/features/olva/shared/constants/olva-enums.constants";
import { getOlvaErrorMessage } from "@/features/olva/shared/utils/olva-error.util";
import type { OrderHeader } from "@/interfaces/IOrder";

interface OlvaOrderRow {
  order: OrderHeader;
  status: OlvaShipmentStatus;
  lookup: OlvaTrackingLookup | null;
}

const guideKey = (orderNumber: string, orderCode: string | null | undefined) =>
  `${orderNumber}-${orderCode ?? ""}`;

/** Olva takes up to 50 guides per query; the batches go one at a time (per-minute limit). */
async function trackInBatches(lookups: OlvaTrackingLookup[]): Promise<OlvaTrackingBatchItem[]> {
  const items: OlvaTrackingBatchItem[] = [];
  for (let start = 0; start < lookups.length; start += OLVA_TRACKING_BATCH_MAX_SIZE) {
    items.push(
      ...(await trackOlvaShipmentsBatch(
        lookups.slice(start, start + OLVA_TRACKING_BATCH_MAX_SIZE),
      )),
    );
  }
  return items;
}

/**
 * The orders of a courier tab that were registered in Olva from Powip (FEAT-35): the status
 * ms-integrations saved (webhooks and reconciliation keep it current) and, on «Actualizar»,
 * what Olva says right now. Nothing is asked to Olva until the click: every query counts
 * against the account's monthly quota.
 */
export default function OlvaOrderTrackingView({ orders }: { orders: OrderHeader[] }) {
  const rows = useMemo<OlvaOrderRow[]>(
    () =>
      orders
        .filter((order) => order.olvaShipmentId || order.olvaStatus)
        .map((order) => ({
          order,
          status: (order.olvaStatus ?? OLVA_SHIPMENT_STATUSES.UNKNOWN) as OlvaShipmentStatus,
          lookup: toOlvaTrackingLookup(order.externalTrackingNumber),
        })),
    [orders],
  );

  // Only the guides that can still change (a delivered or returned one will not)
  const lookups = useMemo(() => {
    const seen = new Set<string>();
    const list: OlvaTrackingLookup[] = [];
    for (const { lookup, status } of rows) {
      if (!lookup || isOlvaShipmentFinal(status)) continue;
      const key = guideKey(lookup.orderNumber, lookup.orderCode);
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(lookup);
    }
    return list;
  }, [rows]);

  const tracking = useMutation({ mutationFn: trackInBatches });

  const liveByGuide = useMemo(() => {
    const map = new Map<string, OlvaTrackingBatchItem>();
    for (const item of tracking.data ?? [])
      map.set(guideKey(item.orderNumber, item.orderCode), item);
    return map;
  }, [tracking.data]);

  if (rows.length === 0) return null;

  const liveOf = (lookup: OlvaTrackingLookup | null) =>
    lookup
      ? (liveByGuide.get(guideKey(lookup.orderNumber, lookup.orderCode)) ??
        liveByGuide.get(guideKey(lookup.orderNumber, null)))
      : undefined;

  return (
    <Card className="mb-4 border-border shadow-sm">
      <CardHeader className="pb-3 px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Estado en Olva</CardTitle>
            <CardDescription>
              Se actualiza solo con los avisos de Olva. «Actualizar» lo consulta ahora (cuenta en la
              cuota mensual de Olva).
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => tracking.mutate(lookups)}
            disabled={lookups.length === 0 || tracking.isPending}
          >
            <RefreshCw className={`mr-1 size-4 ${tracking.isPending ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
        {tracking.isError ? (
          <p className="text-destructive text-sm" role="alert">
            {getOlvaErrorMessage(tracking.error)}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="px-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N° Pedido</TableHead>
              <TableHead>Guía Olva</TableHead>
              <TableHead>Estado guardado</TableHead>
              <TableHead>En Olva ahora</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ order, status, lookup }) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.orderNumber}</TableCell>
                <TableCell>{order.externalTrackingNumber || "—"}</TableCell>
                <TableCell>
                  <Badge variant={olvaStatusBadgeVariant(status)}>
                    {getOlvaShipmentStatusLabel(status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <LiveStatus item={liveOf(lookup)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function LiveStatus({ item }: { item: OlvaTrackingBatchItem | undefined }) {
  if (!item) return <span className="text-muted-foreground text-xs">—</span>;

  if (!item.success) return <span className="text-destructive text-xs">{item.error}</span>;

  const { tracking } = item;
  return (
    <div className="grid gap-1">
      <Badge variant={olvaStatusBadgeVariant(tracking.status)} className="w-fit">
        {getOlvaShipmentStatusLabel(tracking.status)}
      </Badge>
      {tracking.statusDetail ? (
        <span className="text-muted-foreground text-xs">{tracking.statusDetail}</span>
      ) : null}
      {tracking.deliveredAt ? (
        <span className="text-muted-foreground text-xs">
          Entregado el {formatOlvaTrackingDate(tracking.deliveredAt)}
        </span>
      ) : tracking.estimatedDelivery ? (
        <span className="text-muted-foreground text-xs">
          Entrega estimada: {formatOlvaTrackingDate(tracking.estimatedDelivery)}
        </span>
      ) : null}
    </div>
  );
}
