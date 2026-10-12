"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { useAdvertisingBusinessAnalytics } from "@/hooks/useAdvertisingOrders";
import { getMetaCatalog, type MetaCatalogResponse } from "@/services/advertisingMetaService";
import type {
  AdvertisingBusinessAnalytics,
  AdvertisingBusinessRow,
  AdvertisingOrderBasis,
} from "@/services/advertisingOrdersService";
import { advertisingErrorMessage, advertisingErrorStatus } from "@/services/advertisingService";
import { AdvertisingOrderDateBasis } from "./AdvertisingOrderDateBasis";
import type { AdvertisingOrdersPanelProps } from "./AdvertisingOrdersPanel";
import { useAdvertisingStoreFilter } from "./AdvertisingStoreFilterContext";
import { businessResult } from "./advertising-business-results";
import { formatAdvertisingDate } from "./advertising-model";
import { formatOrderAmount } from "./advertising-orders-model";
import { advertisingSectionHref } from "./advertising-sections";

type View = "products" | "zones" | "quality" | "results";
const TITLE: Record<View, string> = {
  products: "Productos",
  zones: "Zonas",
  quality: "Calidad de datos",
  results: "Resultados de publicidad",
};
const timeZones = [
  "America/Lima",
  "UTC",
  ...Intl.supportedValuesOf("timeZone").filter((zone) => zone !== "America/Lima"),
];
const QUALITY = [
  ["unattributedCount", "Sin anuncio", "Revisa el anuncio que originó cada pedido."],
  ["unknownCurrencyCount", "Sin moneda", "Confirma la moneda para comparar importes."],
  [
    "incompleteCostCount",
    "Costos pendientes",
    "Completa los costos o marca los ceros confirmados.",
  ],
  [
    "missingDeliveredDateCount",
    "Entrega sin fecha",
    "Pedidos entregados sin una fecha verificable.",
  ],
  ["missingPaidDateCount", "Cobro sin fecha", "Pedidos cobrados sin una fecha verificable."],
  ["partiallyPaidCount", "Cobros parciales", "Se incluyen en pedidos; no en pedidos cobrados."],
] as const;

export function AdvertisingBusinessAnalyticsPanel(
  props: AdvertisingOrdersPanelProps & { view: View },
) {
  const id = useId();
  const { storeId } = useAdvertisingStoreFilter();
  const queryClient = useQueryClient();
  const [basis, setBasis] = useState<AdvertisingOrderBasis>(
    props.view === "results" ? "paid" : "created",
  );
  const [timeZone, setTimeZone] = useState("America/Lima");
  const [currency, setCurrency] = useState("all");
  const [page, setPage] = useState(1);
  const groupBy = props.view === "products" ? "product" : props.view === "zones" ? "zone" : "ad";
  const observedStore = useRef(storeId);
  useEffect(() => {
    if (observedStore.current === storeId) return;
    observedStore.current = storeId;
    setPage(1);
  }, [storeId]);
  const query = useAdvertisingBusinessAnalytics(
    { ...props, enabled: props.enabled !== false && storeId !== "none" },
    {
      from: props.from,
      to: props.to,
      basis: props.view === "quality" ? "created" : basis,
      timeZone,
      groupBy,
      storeId,
      channelId: "all",
    },
  );
  const data = query.data;
  const rows = (data?.rows ?? []).filter(
    (row) => currency === "all" || (row.currency ?? "unknown") === currency,
  );
  const visible = rows.slice((page - 1) * 25, page * 25);
  if (storeId === "none")
    return (
      <p className="p-4 text-sm text-muted-foreground">
        El gasto sin asignar no identifica una tienda de venta. Elige una tienda para consultar sus
        resultados.
      </p>
    );
  return (
    <section className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">{TITLE[props.view]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatAdvertisingDate(props.from)} {props.from.slice(0, 4)} al{" "}
            {formatAdvertisingDate(props.to)} {props.to.slice(0, 4)} · {timeZone}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!props.token || query.isFetching}
          onClick={() => {
            void query.refetch();
            void queryClient.invalidateQueries({
              queryKey: [
                "advertising-order-comparison",
                props.actorId ?? null,
                props.companyId ?? null,
              ],
            });
          }}
        >
          <RefreshCw className="size-4" />
          Actualizar
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {props.view === "quality"
          ? "Datos por completar en los pedidos creados durante este periodo."
          : props.view === "products"
            ? "Ventas y unidades registradas en Powip."
            : props.view === "zones"
              ? "Pedidos agrupados por la zona registrada en Powip."
              : "Compara el gasto de Meta con pedidos confirmados en Powip."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {props.view !== "quality" && (
          <AdvertisingOrderDateBasis
            value={basis}
            onChange={(value) => {
              setBasis(value);
              setPage(1);
            }}
          />
        )}
        <div>
          <Label htmlFor={`${id}-tz`}>Zona horaria de pedidos</Label>
          <Select
            value={timeZone}
            onValueChange={(value) => {
              setTimeZone(value);
              setPage(1);
            }}
          >
            <SelectTrigger id={`${id}-tz`} className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeZones.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {data && props.view !== "quality" && (
          <div>
            <Label htmlFor={`${id}-currency`}>Moneda</Label>
            <Select
              value={currency}
              onValueChange={(value) => {
                setCurrency(value);
                setPage(1);
              }}
            >
              <SelectTrigger id={`${id}-currency`} className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas · importes separados</SelectItem>
                {data.currencies.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
                <SelectItem value="unknown">Sin moneda</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {query.error && (
        <Alert variant="destructive">
          <AlertDescription>{advertisingErrorMessage(query.error)}</AlertDescription>
        </Alert>
      )}
      {query.isPending && props.token && (
        <Skeleton className="h-64" aria-label="Cargando análisis de pedidos" />
      )}
      {data &&
        (props.view === "quality" ? (
          <>
            <Badge variant="secondary">{data.quality.ordersCreated} pedidos creados</Badge>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {QUALITY.map(([key, title, description]) => (
                <Card key={key}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold">{data.quality[key]}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button asChild variant="outline">
              <Link
                href={advertisingSectionHref("/publicidad/atribucion", props.from, props.to, {
                  storeId,
                })}
              >
                Revisar pedidos
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">
              Las fechas antiguas sin evidencia se mantienen pendientes. Una actualización del
              pedido no confirma su fecha de entrega o cobro.
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{data.totalGroups} grupos</Badge>
              <Badge variant="outline">Pedidos Powip</Badge>
              {data.quality.unattributedCount > 0 && (
                <Badge variant="outline">
                  {data.quality.unattributedCount} pedidos creados sin anuncio
                </Badge>
              )}
            </div>
            {data.truncated && (
              <Alert>
                <AlertDescription>
                  Hay más de 500 grupos. Amplía la revisión con un periodo más corto. Los resultados
                  de publicidad están pendientes.
                </AlertDescription>
              </Alert>
            )}
            {!rows.length ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <p className="font-medium">Sin pedidos para este periodo</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Prueba otra fecha del pedido, moneda o periodo.
                  </p>
                </CardContent>
              </Card>
            ) : props.view === "results" ? (
              <BusinessResultsTable {...props} analytics={data} rows={visible} />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{props.view === "products" ? "Producto" : "Zona"}</TableHead>
                        <TableHead>Moneda</TableHead>
                        <TableHead>Pedidos</TableHead>
                        {props.view === "products" && <TableHead>Unidades</TableHead>}
                        <TableHead>Entregados</TableHead>
                        <TableHead>
                          {props.view === "products" ? "Venta de productos" : "Venta registrada"}
                        </TableHead>
                        {props.view === "zones" && (
                          <TableHead>Resultado antes de publicidad</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map((row) => (
                        <TableRow key={`${row.id ?? "unknown"}:${row.name}:${row.currency}`}>
                          <TableCell className="max-w-64 whitespace-normal font-medium">
                            {row.name ??
                              (props.view === "products" ? "Producto sin identificar" : "Sin zona")}
                          </TableCell>
                          <TableCell>{row.currency ?? "Sin confirmar"}</TableCell>
                          <TableCell>{row.orderCount}</TableCell>
                          {props.view === "products" && (
                            <TableCell>{row.units ?? "Pendiente"}</TableCell>
                          )}
                          <TableCell>{row.deliveredCount}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatOrderAmount(row.revenue, row.currency)}
                          </TableCell>
                          {props.view === "zones" && (
                            <TableCell className="whitespace-nowrap">
                              {formatOrderAmount(row.contributionBeforeAds, row.currency)}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                Página {page} de {Math.max(1, Math.ceil(rows.length / 25))}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * 25 >= rows.length}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {props.view === "products"
                ? "La venta de productos usa los importes de cada línea. Los costos del pedido y el gasto publicitario no se reparten entre productos."
                : props.view === "zones"
                  ? "El resultado antes de publicidad requiere moneda y cinco costos confirmados. No incluye un reparto del gasto publicitario."
                  : "Los pedidos cobrados tienen el pago completo y una fecha verificable. Las conversiones informadas por Meta usan su propia atribución."}
            </p>
          </>
        ))}
    </section>
  );
}

function BusinessResultsTable(
  props: AdvertisingOrdersPanelProps & {
    analytics: AdvertisingBusinessAnalytics;
    rows: AdvertisingBusinessRow[];
  },
) {
  const { storeId } = useAdvertisingStoreFilter();
  const groupKeys = props.rows.map((row) => `${row.accountId ?? ""}/${row.id ?? ""}`).join(",");
  const enabled = Boolean(props.token && props.companyId && props.actorId && props.rows.length);
  const meta = useQuery({
    queryKey: [
      "advertising-order-comparison",
      props.actorId ?? null,
      props.companyId ?? null,
      props.from,
      props.to,
      groupKeys,
      storeId,
    ],
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const result: Record<string, MetaCatalogResponse | null> = {};
      let cursor = 0;
      async function worker() {
        while (cursor < props.rows.length) {
          const row = props.rows[cursor++];
          if (!row.id || !row.accountId) continue;
          const key = `${row.accountId}/${row.id}`;
          try {
            result[key] = await getMetaCatalog(
              props.token ?? "",
              props.companyId ?? "",
              {
                from: props.from,
                to: props.to,
                level: "ad",
                accountId: row.accountId,
                adId: row.id,
                page: 1,
                pageSize: 1,
                storeId,
              },
              signal,
            );
          } catch (error) {
            if (signal.aborted || [401, 403].includes(advertisingErrorStatus(error) ?? 0))
              throw error;
            result[key] = null;
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, props.rows.length) }, worker));
      return result;
    },
  });
  const refetchMeta = meta.refetch;
  const observedToken = useRef(props.token);
  useEffect(() => {
    if (props.token === observedToken.current) return;
    observedToken.current = props.token;
    if (enabled) void refetchMeta();
  }, [props.token, enabled, refetchMeta]);
  const denied = [401, 403].includes(advertisingErrorStatus(meta.error) ?? 0);
  return (
    <div className="space-y-3">
      {meta.error && (
        <Alert variant="destructive">
          <AlertDescription>{advertisingErrorMessage(meta.error)}</AlertDescription>
        </Alert>
      )}
      {props.analytics.basis !== "paid" && (
        <p className="text-xs text-muted-foreground">
          El ROAS y el resultado después de publicidad requieren la fecha «Pedido cobrado».
        </p>
      )}
      {props.analytics.basis !== "delivered" && (
        <p className="text-xs text-muted-foreground">
          El costo por entregado requiere la fecha «Pedido entregado».
        </p>
      )}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Anuncio</TableHead>
                <TableHead>Pedidos</TableHead>
                <TableHead>Gasto Meta</TableHead>
                <TableHead>Costo por entregado</TableHead>
                <TableHead>ROAS cobrado</TableHead>
                <TableHead>Resultado después de publicidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.rows.map((row) => {
                const result = businessResult(
                  row,
                  props.analytics,
                  enabled && !denied ? (meta.data?.[`${row.accountId}/${row.id}`] ?? null) : null,
                );
                return (
                  <TableRow key={`${row.accountId}:${row.id}:${row.currency}`}>
                    <TableCell>
                      <p className="max-w-60 whitespace-normal font-medium">
                        {row.name ?? "Sin anuncio"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.currency ?? "Sin moneda"} ·{" "}
                        {result.reason ??
                          (row.incompleteCostCount > 0
                            ? "Costos pendientes"
                            : row.cancelledCount > 0
                              ? "Revisar pedidos anulados"
                              : "Cálculo disponible")}
                      </p>
                      {row.id && row.accountId && (
                        <Link
                          className="mt-1 inline-block text-xs text-primary hover:underline"
                          href={advertisingSectionHref(
                            "/publicidad/anuncios",
                            props.from,
                            props.to,
                            { accountId: row.accountId, adId: row.id, storeId },
                          )}
                        >
                          Ver anuncio
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>{row.orderCount}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatOrderAmount(result.spend, row.currency)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatOrderAmount(result.cpe, row.currency)}
                    </TableCell>
                    <TableCell>
                      {result.paidRoas === null ? "Pendiente" : `${result.paidRoas}×`}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatOrderAmount(result.contributionAfterAds, row.currency)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {meta.isFetching && (
        <p role="status" className="text-xs text-muted-foreground">
          Consultando el gasto guardado de los anuncios…
        </p>
      )}
    </div>
  );
}
