"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdvertisingBusinessMetrics } from "@/hooks/useAdvertisingBusinessMetrics";
import type { AdvertisingOrdersIdentity } from "@/hooks/useAdvertisingOrders";
import { advertisingErrorStatus } from "@/services/advertisingService";
import type { AdvertisingSummaryV11 } from "@/services/advertisingV11Service";
import { formatMetaSpend } from "./advertising-meta-model";
import { advertisingClosedPeriod, advertisingSalesCost } from "./advertising-sales-cost-model";
import { advertisingSectionHref } from "./advertising-sections";

export function AdvertisingSalesCostCard({
  identity,
  from,
  to,
  storeId,
  summary,
}: {
  identity: AdvertisingOrdersIdentity;
  from: string;
  to: string;
  storeId: string;
  summary?: AdvertisingSummaryV11;
}) {
  const id = useId();
  const [basis, setBasis] = useState<"created" | "delivered">("created");
  const query = useAdvertisingBusinessMetrics(identity, {
    from,
    to,
    storeId,
    channelId: "all",
    basis,
    timeZone: "America/Lima",
  });
  const business = !query.isError && query.data?.basis === basis ? query.data : undefined;
  const result = advertisingSalesCost(summary, business);
  const coverage = business?.countCoverage ?? business?.coverage;
  const count = business
    ? basis === "created"
      ? business.totalOrders
      : business.deliveredCount
    : null;
  const closed = advertisingClosedPeriod(from, to);
  const errorStatus = advertisingErrorStatus(query.error);
  const reason = query.isError
    ? errorStatus === 403
      ? "No tienes permiso para consultar las ventas."
      : errorStatus === 401
        ? "Vuelve a iniciar sesión para consultar las ventas."
        : "No se pudieron cargar las ventas."
    : result.reason;
  return (
    <Card aria-label="Inversión por venta de Powip">
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">Inversión por venta · Powip</CardTitle>
          <p className="text-xs text-muted-foreground">
            {storeId === "all"
              ? "Todo el negocio: todas las tiendas, cuentas, plataformas y canales."
              : "Toda la publicidad y los pedidos de la tienda consultada."}
          </p>
        </div>
        <div className="min-w-0 space-y-1 sm:w-48">
          <Label htmlFor={`${id}-basis`}>Contar pedidos</Label>
          <Select
            value={basis}
            onValueChange={(value) => {
              if (value === "created" || value === "delivered") setBasis(value);
            }}
          >
            <SelectTrigger id={`${id}-basis`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created">Registrados</SelectItem>
              <SelectItem value="delivered">Entregados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">
              {basis === "created" ? "Pedidos registrados" : "Entregas con fecha confirmada"}
            </dt>
            <dd className="font-mono text-2xl font-semibold tabular-nums">
              {typeof count === "number" && Number.isSafeInteger(count) && count >= 0
                ? new Intl.NumberFormat("es-PE").format(count)
                : query.isFetching
                  ? "Cargando…"
                  : "No disponible"}
            </dd>
            {coverage && !coverage.complete ? (
              <Badge variant="outline">Conteo parcial</Badge>
            ) : null}
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">
              {basis === "created" ? "Costo por pedido registrado" : "Costo por entrega"}
            </dt>
            <dd className="font-mono text-2xl font-semibold tabular-nums">
              {result.cost !== null && result.currency
                ? formatMetaSpend(result.cost, result.currency)
                : query.isFetching
                  ? "Cargando…"
                  : "No disponible"}
            </dd>
            <p className="text-xs text-muted-foreground">
              Inversión ÷ {basis === "created" ? "pedidos registrados" : "entregas"} del periodo.
            </p>
          </div>
        </dl>
        {reason ? <p className="text-sm text-muted-foreground">{reason}</p> : null}
        {query.isError ? (
          <Button
            size="sm"
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Reintentar ventas
          </Button>
        ) : null}
        {closed ? (
          <Button size="sm" variant="outline" asChild>
            <Link href={advertisingSectionHref("/publicidad", closed.from, closed.to, { storeId })}>
              Consultar publicidad hasta ayer
            </Link>
          </Button>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {basis === "created"
            ? "Registrados incluye todos los estados, también anulados. "
            : "Se usa la fecha real de entrega. "}
          Este indicador no atribuye cada venta a un anuncio.
        </p>
      </CardContent>
    </Card>
  );
}
