"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdvertisingMetaAd } from "@/hooks/useAdvertisingMeta";
import type { MetaCatalogRow, MetaResultType } from "@/services/advertisingMetaService";
import { advertisingErrorMessage } from "@/services/advertisingService";
import {
  formatMetaCostPerResult,
  formatMetaNumber,
  formatMetaResultCount,
  formatMetaSpend,
  metaActionLabel,
  metaAdsManagerUrl,
  metaCoverageLabel,
  metaResultAvailabilityLabel,
  metaResultCostLabel,
  metaResultCountLabel,
  metaResultDescription,
  metaStatusLabel,
} from "./advertising-meta-model";
import { formatAdvertisingDate } from "./advertising-model";

interface Props {
  actorId: string | null | undefined;
  companyId: string | null | undefined;
  token: string | null | undefined;
  from: string;
  to: string;
  selected: MetaCatalogRow | null;
  onClose: () => void;
  resultType?: MetaResultType;
}

export function AdvertisingMetaAdDetail({
  selected,
  onClose,
  resultType = "messages",
  ...identity
}: Props) {
  const query = useAdvertisingMetaAd({
    ...identity,
    adId: selected?.id ?? null,
    accountId: selected?.accountId ?? null,
  });
  const detail = query.data;
  const manageUrl = detail ? metaAdsManagerUrl(detail.account.externalId) : null;
  const metric = detail?.row.insights.resultMetrics?.[resultType];
  const costLabel = metaResultCostLabel(resultType);
  const countLabel = metaResultCountLabel(resultType);
  const events =
    detail?.row.insights.actions?.filter(
      (action) => metaActionLabel(action.actionType) !== action.actionType,
    ) ?? [];
  return (
    <Dialog
      open={selected !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] min-w-0 overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{selected?.name ?? "Detalle de anuncio"}</DialogTitle>
          <DialogDescription>
            Resultados de Meta · {formatAdvertisingDate(identity.from)} {identity.from.slice(0, 4)}{" "}
            al {formatAdvertisingDate(identity.to)} {identity.to.slice(0, 4)}
          </DialogDescription>
        </DialogHeader>
        {query.isError ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm">
              {advertisingErrorMessage(query.error)}
            </p>
            <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
              Volver a intentar
            </Button>
          </div>
        ) : !detail ? (
          <Skeleton className="h-56" aria-label="Cargando anuncio" />
        ) : (
          <div className="min-w-0 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {metaResultDescription(resultType)} · {detail.account.name} · {detail.row.currency}
              </span>
              <Badge variant="outline">{metaResultAvailabilityLabel(metric)}</Badge>
            </div>
            <section
              className="grid grid-cols-2 gap-3 sm:grid-cols-3"
              aria-label="Resultados del anuncio"
            >
              {[
                [costLabel, formatMetaCostPerResult(metric, detail.row.currency)],
                [countLabel, formatMetaResultCount(metric)],
                ["Gasto", formatMetaSpend(detail.row.insights.spend, detail.row.currency)],
              ].map(([label, value], index) => (
                <Card key={label} className={index === 0 ? "col-span-2 sm:col-span-1" : undefined}>
                  <CardContent className="space-y-2 pt-4">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="break-words text-xl font-semibold tabular-nums">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </section>
            <section className="min-w-0 space-y-3" aria-label="Resultados diarios de Meta">
              <h3 className="text-sm font-semibold">Detalle diario</h3>
              <ul className="space-y-2 sm:hidden" aria-label="Resultados diarios en móvil">
                {detail.daily.map((day) => {
                  const dayMetric = day.resultMetrics?.[resultType];
                  return (
                    <li key={day.date} className="space-y-3 rounded-lg border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          {formatAdvertisingDate(day.date)} {day.date.slice(0, 4)}
                        </p>
                        <Badge variant="outline">{metaResultAvailabilityLabel(dayMetric)}</Badge>
                      </div>
                      <dl className="grid grid-cols-2 gap-3">
                        <div>
                          <dt className="min-h-8 text-xs text-muted-foreground">{costLabel}</dt>
                          <dd className="break-words font-semibold tabular-nums">
                            {formatMetaCostPerResult(dayMetric, detail.row.currency)}
                          </dd>
                        </div>
                        <div>
                          <dt className="min-h-8 text-xs text-muted-foreground">{countLabel}</dt>
                          <dd className="break-words font-semibold tabular-nums">
                            {formatMetaResultCount(dayMetric)}
                          </dd>
                        </div>
                        <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                          <dt className="text-xs text-muted-foreground">Gasto</dt>
                          <dd className="font-semibold tabular-nums">
                            {formatMetaSpend(day.spend, detail.row.currency)}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  );
                })}
              </ul>
              <div className="hidden sm:block">
                <Table aria-label="Resultados diarios del anuncio">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">{costLabel}</TableHead>
                      <TableHead className="text-right">{countLabel}</TableHead>
                      <TableHead className="text-right">Gasto</TableHead>
                      <TableHead>Disponibilidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.daily.map((day) => (
                      <TableRow key={day.date}>
                        <TableCell className="whitespace-nowrap">
                          {formatAdvertisingDate(day.date)} {day.date.slice(0, 4)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold tabular-nums">
                          {formatMetaCostPerResult(
                            day.resultMetrics?.[resultType],
                            detail.row.currency,
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold tabular-nums">
                          {formatMetaResultCount(day.resultMetrics?.[resultType])}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatMetaSpend(day.spend, detail.row.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {metaResultAvailabilityLabel(day.resultMetrics?.[resultType])}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
            <details className="group rounded-lg border border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg p-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                Más información
                <ChevronDown
                  className="size-4 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="space-y-4 border-t border-border p-4">
                <dl className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["Impresiones", formatMetaNumber(detail.row.insights.impressions)],
                    ["Clics", formatMetaNumber(detail.row.insights.clicks)],
                    ["Último estado registrado", metaStatusLabel(detail.row.effectiveStatus)],
                    ["Datos de gasto", metaCoverageLabel(detail.row.insights.coverage)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="text-sm font-medium tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
                <section className="space-y-3" aria-label="Eventos reportados por Meta">
                  <h3 className="text-sm font-semibold">Eventos reportados por Meta</h3>
                  {events.length ? (
                    <dl className="grid gap-3 sm:grid-cols-2">
                      {events.map((action) => (
                        <div key={action.actionType}>
                          <dt className="text-xs text-muted-foreground">
                            {metaActionLabel(action.actionType)}
                          </dt>
                          <dd className="font-semibold tabular-nums">
                            {formatMetaNumber(action.value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No hay otros eventos disponibles.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Estos eventos no son pedidos entregados ni cobros de Powip.
                  </p>
                </section>
              </div>
            </details>
            <section className="space-y-3 border-t border-border pt-4" aria-label="Fuente de datos">
              <div className="flex flex-wrap gap-2">
                {manageUrl ? (
                  <Button size="sm" variant="outline" asChild>
                    <a href={manageUrl} target="_blank" rel="noopener noreferrer">
                      Abrir Meta Ads Manager <ExternalLink aria-hidden="true" />
                    </a>
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Fuente: Meta · Atribución de 7 días por clic y 1 día por vista · Fecha de impresión.
                Zona horaria: {detail.account.timeZone}.
              </p>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
