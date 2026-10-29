"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  MetaCatalogLevel,
  MetaCatalogRow,
  MetaResultType,
} from "@/services/advertisingMetaService";
import {
  advertisingMetaExtraColumns,
  type advertisingMetaTableValues,
} from "./advertising-meta-table-model";

export function AdvertisingMetaMetricsTable({
  rows,
  level = rows[0]?.level ?? "ad",
  title,
  more,
  accountName,
  valuesFor,
  action,
}: {
  rows: MetaCatalogRow[];
  level?: MetaCatalogLevel;
  title: string;
  resultType: MetaResultType;
  more: boolean;
  accountName: (row: MetaCatalogRow) => string;
  valuesFor: (row: MetaCatalogRow) => ReturnType<typeof advertisingMetaTableValues>;
  action: (row: MetaCatalogRow) => ReactNode;
}) {
  const extraColumns = advertisingMetaExtraColumns(level);
  return (
    <>
      <div className="hidden md:block">
        <Table aria-label={title}>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-right">Gasto</TableHead>
              <TableHead>Tipo de resultado</TableHead>
              <TableHead className="text-right">Resultados</TableHead>
              <TableHead className="text-right">Costo por resultado · Meta</TableHead>
              <TableHead className="text-right">CTR de enlace</TableHead>
              <TableHead className="text-right">Frecuencia</TableHead>
              <TableHead className="text-right">Costo por entregado</TableHead>
              <TableHead>Recomendación</TableHead>
              {more ? (
                <>
                  {extraColumns.map((column) => (
                    <TableHead key={column.key} className="text-right">
                      {column.label}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Impresiones</TableHead>
                  <TableHead className="text-right">Clics en enlace</TableHead>
                  <TableHead className="text-right">Alcance</TableHead>
                </>
              ) : null}
              <TableHead>Disponibilidad</TableHead>
              <TableHead>
                <span className="sr-only">Consultar</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const values = valuesFor(row);
              return (
                <TableRow key={`${row.accountId}:${row.id}`}>
                  <TableCell className="max-w-72 whitespace-normal">
                    <p className="font-medium break-words">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {accountName(row)} · {row.currency}
                      {row.store
                        ? ` · ${row.store.name}`
                        : row.storeStatus === "mixed"
                          ? " · varias tiendas"
                          : ""}
                    </p>
                  </TableCell>
                  <NumberCell>{values.spend}</NumberCell>
                  <TableCell>
                    {values.resultType}
                    {row.insights.results?.limitation === "optimization-event-unconfirmed" ? (
                      <p className="text-xs text-muted-foreground">
                        Evento optimizado por confirmar.
                      </p>
                    ) : null}
                  </TableCell>
                  <NumberCell>{values.count}</NumberCell>
                  <NumberCell>{values.costPerResult}</NumberCell>
                  <NumberCell>{values.ctr}</NumberCell>
                  <NumberCell>{values.frequency}</NumberCell>
                  <TableCell className="max-w-56 text-right">
                    <p className="tabular-nums">{values.cpe}</p>
                    {values.cpeReason ? (
                      <p className="mt-1 whitespace-normal text-xs text-muted-foreground">
                        {values.cpeReason}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs">{values.recommendation}</TableCell>
                  {more ? (
                    <>
                      {extraColumns.map((column) => (
                        <NumberCell key={column.key}>{values.business[column.key]}</NumberCell>
                      ))}
                      <NumberCell>{values.impressions}</NumberCell>
                      <NumberCell>{values.linkClicks}</NumberCell>
                      <NumberCell>{values.reach}</NumberCell>
                    </>
                  ) : null}
                  <TableCell>
                    <Badge variant="outline">{values.availability}</Badge>
                  </TableCell>
                  <TableCell>{action(row)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <ul aria-label={`${title} en móvil`} className="space-y-3 md:hidden">
        {rows.map((row) => {
          const values = valuesFor(row);
          return (
            <li
              key={`${row.accountId}:${row.id}`}
              className="min-w-0 space-y-3 border-b border-border pb-3 last:border-0"
            >
              <div>
                <p className="text-sm font-medium break-words">{row.name}</p>
                <p className="text-xs text-muted-foreground">
                  {accountName(row)} · {row.currency} · {values.resultType}
                </p>
                {row.insights.results?.limitation === "optimization-event-unconfirmed" ? (
                  <p className="text-xs text-muted-foreground">Evento optimizado por confirmar.</p>
                ) : null}
              </div>
              <dl className="grid min-w-0 grid-cols-2 gap-3">
                <MobileMetric label="Gasto" value={values.spend} />
                <MobileMetric label="Resultados" value={values.count} />
                <MobileMetric label="Costo por resultado · Meta" value={values.costPerResult} />
                <MobileMetric label="CTR de enlace" value={values.ctr} />
                <MobileMetric label="Frecuencia" value={values.frequency} />
                <MobileMetric
                  label="Costo por entregado"
                  value={values.cpe}
                  description={values.cpeReason}
                />
                <MobileMetric label="Recomendación" value={values.recommendation} />
                {more ? (
                  <>
                    {extraColumns.map((column) => (
                      <MobileMetric
                        key={column.key}
                        label={column.label}
                        value={values.business[column.key]}
                      />
                    ))}
                    <MobileMetric label="Impresiones" value={values.impressions} />
                    <MobileMetric label="Clics en enlace" value={values.linkClicks} />
                    <MobileMetric label="Alcance" value={values.reach} />
                  </>
                ) : null}
              </dl>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="outline">{values.availability}</Badge>
                {action(row)}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
function NumberCell({ children }: { children: ReactNode }) {
  return <TableCell className="whitespace-nowrap text-right tabular-nums">{children}</TableCell>;
}
function MobileMetric({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description?: string | null;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-base font-semibold tabular-nums">{value}</dd>
      {description ? <dd className="text-xs text-muted-foreground">{description}</dd> : null}
    </div>
  );
}
