"use client";

import { ExternalLink } from "lucide-react";
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
import type { MetaCatalogRow } from "@/services/advertisingMetaService";
import { advertisingErrorMessage } from "@/services/advertisingService";
import {
  formatMetaNumber,
  formatMetaSpend,
  metaActionLabel,
  metaAdsManagerUrl,
  metaCoverageLabel,
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
}

export function AdvertisingMetaAdDetail({ selected, onClose, ...identity }: Props) {
  const query = useAdvertisingMetaAd({
    ...identity,
    adId: selected?.id ?? null,
    accountId: selected?.accountId ?? null,
  });
  const detail = query.data;
  const manageUrl = detail ? metaAdsManagerUrl(detail.account.externalId) : null;
  return (
    <Dialog
      open={selected !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
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
              <span className="text-xs text-muted-foreground">Último estado registrado:</span>
              <Badge variant="outline">{metaStatusLabel(detail.row.effectiveStatus)}</Badge>
              <Badge variant="outline">{metaCoverageLabel(detail.row.insights.coverage)}</Badge>
              <span className="text-xs text-muted-foreground">
                {detail.account.name} · {detail.row.currency} · {detail.row.timeZone}
              </span>
            </div>
            <p className="break-all text-xs text-muted-foreground">
              ID {detail.row.id} · Campaña {detail.row.campaignId ?? "No disponible"} · Conjunto{" "}
              {detail.row.adsetId ?? "No disponible"}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Gasto Meta", formatMetaSpend(detail.row.insights.spend, detail.row.currency)],
                ["Impresiones Meta", formatMetaNumber(detail.row.insights.impressions)],
                ["Clics Meta", formatMetaNumber(detail.row.insights.clicks)],
              ].map(([label, value]) => (
                <Card key={label}>
                  <CardContent className="space-y-2 pt-4">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-mono text-xl font-semibold tabular-nums">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <section className="space-y-3" aria-label="Eventos reportados por Meta">
              <h3 className="text-sm font-semibold">Eventos reportados por Meta</h3>
              <p className="text-xs text-muted-foreground">
                Atribución: 7 días después del clic y 1 día después de la vista. Fecha de impresión.
                Estos eventos no son pedidos entregados ni cobros de Powip.
              </p>
              {detail.row.insights.actions?.length ? (
                <dl className="grid gap-3 sm:grid-cols-2">
                  {detail.row.insights.actions.map((action) => (
                    <div key={action.actionType} className="rounded-lg border border-border p-3">
                      <dt className="text-sm">{metaActionLabel(action.actionType)}</dt>
                      <dd className="font-mono font-semibold tabular-nums">
                        {formatMetaNumber(action.value)}
                      </dd>
                      {metaActionLabel(action.actionType) !== action.actionType ? (
                        <p className="mt-1 break-all text-xs text-muted-foreground">
                          {action.actionType}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No hay eventos disponibles en este periodo.
                </p>
              )}
            </section>
            <section className="min-w-0 space-y-3" aria-label="Resultados diarios de Meta">
              <h3 className="text-sm font-semibold">Detalle diario</h3>
              <Table aria-label="Resultados diarios del anuncio">
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Gasto Meta</TableHead>
                    <TableHead className="text-right">Impresiones</TableHead>
                    <TableHead className="text-right">Clics</TableHead>
                    <TableHead>Datos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.daily.map((day) => (
                    <TableRow key={day.date}>
                      <TableCell className="whitespace-nowrap">
                        {formatAdvertisingDate(day.date)} {day.date.slice(0, 4)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatMetaSpend(day.spend, detail.row.currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatMetaNumber(day.impressions)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatMetaNumber(day.clicks)}
                      </TableCell>
                      <TableCell>
                        {day.coverage === "pending"
                          ? "Pendientes"
                          : day.provisional
                            ? "Provisionales"
                            : "Completos"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
            <section
              className="space-y-3 border-t border-border pt-4"
              aria-label="Gestión de anuncio"
            >
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled>
                  Pausar anuncio
                </Button>
                <Button size="sm" variant="outline" disabled>
                  Cambiar presupuesto
                </Button>
                {manageUrl ? (
                  <Button size="sm" variant="outline" asChild>
                    <a href={manageUrl} target="_blank" rel="noopener noreferrer">
                      Abrir Meta Ads Manager <ExternalLink aria-hidden="true" />
                    </a>
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Powip tiene acceso de lectura. Los cambios de anuncios y presupuesto requieren
                permisos de gestión de Meta.
              </p>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
