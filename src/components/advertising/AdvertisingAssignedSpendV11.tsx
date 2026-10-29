"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useAdvertisingAssignmentsV11, useAdvertisingSummaryV11 } from "@/hooks/useAdvertisingV11";
import { advertisingErrorMessage } from "@/services/advertisingService";
import { AdvertisingSalesCostCard } from "./AdvertisingSalesCostCard";
import { AdvertisingStoreChannelCost } from "./AdvertisingStoreChannelCost";
import { sumAdvertisingDecimals } from "./advertising-decimal";
import { formatMetaSpend } from "./advertising-meta-model";

export function AdvertisingAssignedSpendV11({ from, to }: { from: string; to: string }) {
  const id = useId();
  const { auth } = useAuth();
  const [storeId, setStoreId] = useState("all");
  const [channelId, setChannelId] = useState("all");
  const scope = `${auth?.user.id ?? ""}:${auth?.company?.id ?? ""}`;
  const observedScope = useRef(scope);
  useEffect(() => {
    if (observedScope.current === scope) return;
    observedScope.current = scope;
    setStoreId("all");
    setChannelId("all");
  }, [scope]);
  const identity = {
    actorId: auth?.user.id,
    companyId: auth?.company?.id,
    token: auth?.accessToken,
  };
  const summary = useAdvertisingSummaryV11(identity, {
    from,
    to,
    storeId,
    seriesBy: "store",
  });
  const assignments = useAdvertisingAssignmentsV11({ ...identity, from, to });
  const grouped = useMemo(() => {
    const groups = new Map<
      string,
      {
        storeId: string | null;
        channelId: string | null;
        currency: string;
        amounts: string[];
        complete: boolean;
        provisional: boolean;
      }
    >();
    for (const row of summary.data?.channelDaily ?? []) {
      if (
        channelId !== "all" &&
        (channelId === "none" ? row.channelId !== null : row.channelId !== channelId)
      )
        continue;
      const key = `${row.storeId ?? "none"}:${row.channelId ?? "none"}:${row.currency}`;
      const group = groups.get(key) ?? {
        storeId: row.storeId,
        channelId: row.channelId,
        currency: row.currency,
        amounts: [],
        complete: true,
        provisional: false,
      };
      group.amounts.push(row.spend);
      group.complete = group.complete && row.coverage === "complete" && !row.provisional;
      group.provisional = group.provisional || row.provisional;
      groups.set(key, group);
    }
    try {
      return [...groups.entries()].map(([key, group]) => ({
        ...group,
        key,
        amount: sumAdvertisingDecimals(group.amounts),
      }));
    } catch {
      return null;
    }
  }, [summary.data, channelId]);
  if (!identity.actorId || !identity.companyId || !identity.token) return null;
  const salesCost =
    storeId !== "none" ? (
      <AdvertisingSalesCostCard
        identity={identity}
        from={from}
        to={to}
        storeId={storeId}
        summary={summary.isError ? undefined : summary.data}
      />
    ) : null;
  if (summary.isError || assignments.isError)
    return (
      <div className="space-y-4">
        {salesCost}
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{advertisingErrorMessage(summary.error ?? assignments.error)}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void summary.refetch();
                void assignments.refetch();
              }}
            >
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  if (!summary.data || !assignments.data)
    return (
      <div className="space-y-4">
        {salesCost}
        <Skeleton className="h-40" aria-label="Cargando publicidad por tienda y canal" />
      </div>
    );
  const stores = assignments.data.stores;
  const channels = assignments.data.channels.filter(
    (channel) => storeId === "all" || channel.storeId === storeId,
  );
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Publicidad por tienda y canal</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`${id}-store`}>Tienda</Label>
              <Select
                value={storeId}
                onValueChange={(value) => {
                  setStoreId(value);
                  setChannelId("all");
                }}
              >
                <SelectTrigger id={`${id}-store`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las tiendas</SelectItem>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="none">Sin asignar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-channel`}>Canal</Label>
              <Select value={channelId} onValueChange={setChannelId}>
                <SelectTrigger id={`${id}-channel`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los canales</SelectItem>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="none">Sin identificar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {!["all", "none"].includes(storeId) &&
          channels.some((channel) => channel.id === channelId && channel.storeId === storeId) ? (
            <AdvertisingStoreChannelCost
              key={`${scope}:${storeId}:${channelId}`}
              identity={identity}
              summary={summary.data}
              channelId={channelId}
              channelName={channels.find((channel) => channel.id === channelId)?.label ?? "Canal"}
              storeName={stores.find((store) => store.id === storeId)?.name ?? "Tienda"}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Selecciona tienda y canal para ver el costo por entregado.
            </p>
          )}
          {!summary.data.channelDaily ? (
            <p className="text-sm text-muted-foreground">
              El detalle por canal aún no está disponible.
            </p>
          ) : !grouped ? (
            <p role="alert" className="text-sm">
              Revisa los importes de publicidad.
            </p>
          ) : grouped.length ? (
            <Table aria-label="Consumo de publicidad por tienda y canal">
              <TableHeader>
                <TableRow>
                  <TableHead>Tienda</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead className="text-right">Gasto</TableHead>
                  <TableHead>Datos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>
                      {row.storeId
                        ? (stores.find((store) => store.id === row.storeId)?.name ??
                          "Tienda anterior")
                        : "Sin asignar"}
                    </TableCell>
                    <TableCell>
                      {row.channelId
                        ? (assignments.data?.channels.find(
                            (channel) => channel.id === row.channelId,
                          )?.label ?? "Canal registrado")
                        : "Sin identificar"}
                    </TableCell>
                    <TableCell>{row.currency}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatMetaSpend(row.amount, row.currency)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.complete &&
                      summary.data?.currencies.find((total) => total.currency === row.currency)
                        ?.coverage === "complete"
                        ? "Completo"
                        : row.provisional
                          ? "Provisional"
                          : "Parcial / pendiente"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sin gasto disponible para estos filtros.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Sin identificar conserva gasto histórico o destinos no confirmados; no se asigna un
            canal por suposición.
          </p>
        </CardContent>
      </Card>
      {salesCost}
    </div>
  );
}
