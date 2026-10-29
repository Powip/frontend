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
import { useAdvertisingWorkspace } from "@/hooks/useAdvertisingWorkspace";
import { advertisingErrorMessage } from "@/services/advertisingService";
import { sumAdvertisingDecimals } from "./advertising-decimal";
import { formatMetaSpend, validMetaPeriod } from "./advertising-meta-model";
import { formatAdvertisingDate } from "./advertising-model";
import { advertisingSectionHref } from "./advertising-sections";

interface Props {
  from: string;
  to: string;
  storeId?: string;
  channel?: string;
}
function AssignedSpendContent({
  from,
  to,
  storeId,
  channel,
  actorId,
  companyId,
  token,
}: Props & { actorId: string; companyId: string; token: string }) {
  const id = useId();
  const [store, setStore] = useState(storeId ?? "all");
  const [channelId, setChannel] = useState(channel ?? "all");
  const validPeriod = validMetaPeriod(from, to);
  const query = useAdvertisingWorkspace({
    actorId,
    companyId,
    token,
    from,
    to,
    enabled: validPeriod,
  });
  const workspace = query.data;
  const totals =
    workspace?.allocated.totals.filter(
      (item) =>
        (store === "all" || item.storeId === store) &&
        (channelId === "all" || item.channel === channelId),
    ) ?? [];
  const currencies = [...new Set(totals.map((item) => item.currency))];
  const incompleteCoverage = workspace?.allocated.coverage.some(
    (item) => item.coverage !== "complete",
  );
  return (
    <Card className="min-w-0" aria-label="Gasto de publicidad asignado">
      <CardHeader className="flex flex-wrap items-start justify-between gap-3 sm:flex-row">
        <div className="space-y-1">
          <CardTitle className="text-base">Gasto de publicidad asignado</CardTitle>
          <p className="text-xs text-muted-foreground">
            {formatAdvertisingDate(from)} {from.slice(0, 4)} al {formatAdvertisingDate(to)}{" "}
            {to.slice(0, 4)} · Por tienda y moneda
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={advertisingSectionHref("/publicidad/asignaciones", from, to)}>
            Ver asignaciones
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4">
        {!validPeriod ? (
          <p role="status" className="text-sm text-muted-foreground">
            Elige un periodo de hasta 366 días para consultar las asignaciones.
          </p>
        ) : query.isError ? (
          <div className="space-y-2">
            <p role="alert" className="text-sm">
              {advertisingErrorMessage(query.error)}
            </p>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              Volver a intentar
            </Button>
          </div>
        ) : !workspace ? (
          <Skeleton className="h-32" aria-label="Cargando gasto asignado" />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-store`}>Tienda</Label>
                <Select value={store} onValueChange={setStore}>
                  <SelectTrigger id={`${id}-store`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las tiendas</SelectItem>
                    {workspace.stores.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-channel`}>Canal</Label>
                <Select value={channelId} onValueChange={setChannel}>
                  <SelectTrigger id={`${id}-channel`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los canales</SelectItem>
                    {workspace.channels.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {currencies.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {currencies.map((currency) => {
                  const coverage = workspace.allocated.coverage.find(
                    (item) => item.currency === currency,
                  );
                  return (
                    <div key={currency} className="space-y-2 rounded-lg border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">Gasto asignado · {currency}</p>
                        <Badge variant="outline">
                          {coverage?.coverage === "complete"
                            ? coverage.provisional
                              ? "Datos provisionales"
                              : "Datos completos"
                            : coverage?.coverage === "partial"
                              ? "Datos parciales"
                              : "Datos pendientes"}
                        </Badge>
                      </div>
                      <p className="font-mono text-xl font-semibold tabular-nums">
                        {formatMetaSpend(
                          sumAdvertisingDecimals(
                            totals
                              .filter((item) => item.currency === currency)
                              .map((item) => item.amount),
                          ),
                          currency,
                        )}
                      </p>
                      {coverage?.coverage !== "complete" ? (
                        <p className="text-xs text-muted-foreground">
                          La cobertura de empresa es incompleta. Se muestra el gasto disponible.
                        </p>
                      ) : null}
                      {coverage?.provisional ? (
                        <p className="text-xs text-muted-foreground">
                          Los datos provisionales pueden cambiar.
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {incompleteCoverage
                    ? "Aún no hay gasto asignado disponible. La importación del periodo está incompleta."
                    : "No hay gasto asignado para estas tiendas y canales en el periodo."}
                </p>
                {workspace.allocated.coverage.map((item) => (
                  <p key={item.currency} className="text-xs text-muted-foreground">
                    {item.currency} ·{" "}
                    {item.coverage === "complete"
                      ? item.provisional
                        ? "Datos provisionales"
                        : "Datos completos"
                      : item.coverage === "partial"
                        ? "Datos parciales"
                        : "Datos pendientes"}
                    {item.missingAccountDays
                      ? ` · Faltan ${item.missingAccountDays} días de cuenta por importar`
                      : ""}
                  </p>
                ))}
              </div>
            )}
            {totals.length ? (
              <Table aria-label="Gasto asignado por tienda y canal">
                <TableHeader>
                  <TableRow>
                    <TableHead>Tienda</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead className="text-right">Gasto disponible</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {totals.map((item) => (
                    <TableRow key={`${item.storeId}:${item.channel}:${item.currency}`}>
                      <TableCell>
                        {workspace.stores.find((candidate) => candidate.id === item.storeId)
                          ?.name ?? "Tienda"}
                      </TableCell>
                      <TableCell>{item.channel ?? "Sin canal"}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatMetaSpend(item.amount, item.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
            {workspace.allocated.unassigned.length ? (
              <section
                className="space-y-1.5 border-t border-border pt-3"
                aria-label="Gasto de empresa sin asignación"
              >
                <h4 className="text-sm font-medium">Gasto de empresa sin asignación</h4>
                {workspace.allocated.unassigned.map((item) => (
                  <p
                    key={`${item.accountId}:${item.currency}`}
                    className="text-xs text-muted-foreground"
                  >
                    {workspace.accounts.find((account) => account.id === item.accountId)?.name ??
                      "Cuenta"}{" "}
                    · {formatMetaSpend(item.amount, item.currency)}
                  </p>
                ))}
              </section>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Este gasto procede de la fuente empresarial conciliada. Los indicadores manuales de
              esta página se consultan por separado.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
export function AdvertisingAssignedSpend(props: Props) {
  const { auth, hasPermission } = useAuth();
  if (!auth?.company?.id || !auth.user.id || !auth.accessToken || !hasPermission("VIEW_FINANCES"))
    return null;
  return (
    <AssignedSpendContent
      key={`${auth.user.id}:${auth.company.id}`}
      {...props}
      actorId={auth.user.id}
      companyId={auth.company.id}
      token={auth.accessToken}
    />
  );
}
