"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useId, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { useAdvertisingMetaCatalog } from "@/hooks/useAdvertisingMeta";
import {
  type AdvertisingOrdersIdentity,
  useAdvertisingOrderDetail,
  useAdvertisingOrders,
} from "@/hooks/useAdvertisingOrders";
import {
  type AdvertisingOrderBasis,
  type AdvertisingOrderCostKey,
  type AdvertisingOrderDetail,
  type AdvertisingOrderRow,
  reviewAdvertisingOrderAttribution,
  reviewAdvertisingOrderFinance,
} from "@/services/advertisingOrdersService";
import { advertisingErrorMessage, advertisingErrorStatus } from "@/services/advertisingService";
import { AdvertisingOrderDateBasis } from "./AdvertisingOrderDateBasis";
import { formatAdvertisingDate } from "./advertising-model";
import {
  financeInputValue,
  formatOrderAmount,
  formatOrderTimestamp,
  ORDER_COST_LABELS,
  validFinanceInput,
} from "./advertising-orders-model";

export interface AdvertisingOrdersPanelProps extends AdvertisingOrdersIdentity {
  from: string;
  to: string;
}

export function AdvertisingOrdersPanel(props: AdvertisingOrdersPanelProps) {
  const [basis, setBasis] = useState<AdvertisingOrderBasis>("created");
  const [page, setPage] = useState(1);
  const [orderId, setOrderId] = useState<string | null>(null);
  const query = useAdvertisingOrders(props, {
    from: props.from,
    to: props.to,
    basis,
    timeZone: "America/Lima",
    page,
    limit: 50,
  });
  const data = query.data;
  return (
    <section className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Atribución de pedidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatAdvertisingDate(props.from)} {props.from.slice(0, 4)} al{" "}
            {formatAdvertisingDate(props.to)} {props.to.slice(0, 4)} · America/Lima
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={query.isFetching || !props.token}
          onClick={() => void query.refetch()}
        >
          <RefreshCw className="size-4" />
          Actualizar
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Relaciona cada pedido con su anuncio y revisa los costos confirmados.
      </p>
      <AdvertisingOrderDateBasis
        value={basis}
        onChange={(next) => {
          setBasis(next);
          setPage(1);
        }}
      />
      {query.error && (
        <Alert variant="destructive">
          <AlertDescription>{advertisingErrorMessage(query.error)}</AlertDescription>
        </Alert>
      )}
      {query.isPending && props.token && (
        <Skeleton className="h-64" aria-label="Cargando pedidos" />
      )}
      {data && (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{data.total} pedidos</Badge>
            <Badge variant="outline">{data.quality.unattributedCount} sin anuncio</Badge>
            <Badge variant="outline">
              {data.quality.incompleteCostCount} con costos pendientes
            </Badge>
          </div>
          {basis !== "created" && (
            <p className="text-xs text-muted-foreground">
              Las alertas cuentan pedidos creados en este periodo. La lista usa la fecha elegida.
            </p>
          )}
          {!data.rows.length ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="font-medium">Sin pedidos para este periodo</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Prueba otra fecha del pedido o amplía el periodo.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Anuncio</TableHead>
                      <TableHead>Venta</TableHead>
                      <TableHead>Costos</TableHead>
                      <TableHead className="text-right">Revisión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <p className="font-medium">{row.orderNumber}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatOrderTimestamp(
                              basis === "paid"
                                ? row.paidAt
                                : basis === "delivered"
                                  ? row.deliveredAt
                                  : row.createdAt,
                            )}{" "}
                            · {row.status}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="max-w-56 truncate">
                            {row.attribution.adName ?? "Sin anuncio"}
                          </p>
                          {row.attribution.source === "reference" && <p className="text-xs text-muted-foreground">Referencia original validada</p>}
                          {row.attribution.originalReferencePresent && !row.attribution.adId && (
                            <p className="text-xs text-muted-foreground">
                              Referencia original sin validar
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatOrderAmount(row.revenue, row.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.costs.complete ? "secondary" : "outline"}>
                            {row.costs.complete ? "Revisados" : "Pendientes"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => setOrderId(row.id)}>
                            Ver pedido
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              Página {data.page} de {Math.max(1, Math.ceil(data.total / data.limit))}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || query.isFetching}
                onClick={() => setPage((current) => current - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * data.limit >= data.total || query.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}
      <AdvertisingOrderReviewDialog {...props} orderId={orderId} onClose={() => setOrderId(null)} />
    </section>
  );
}

function AdvertisingOrderReviewDialog(
  props: AdvertisingOrdersPanelProps & { orderId: string | null; onClose: () => void },
) {
  const detail = useAdvertisingOrderDetail(props, props.orderId);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"attribution" | "finance" | "history">("attribution");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const data = blocked ? undefined : detail.data;
  const canManage = data?.capabilities.reconcile === true;
  async function save(run: () => Promise<AdvertisingOrderDetail>, message: string) {
    if (!canManage || busy || conflict) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await run();
      queryClient.setQueryData(
        [
          "advertising-orders",
          props.actorId ?? null,
          props.companyId ?? null,
          "detail",
          props.orderId,
        ],
        updated,
      );
      await queryClient.invalidateQueries({
        queryKey: ["advertising-orders", props.actorId ?? null, props.companyId ?? null, "orders"],
      });
      await queryClient.invalidateQueries({
        queryKey: [
          "advertising-orders",
          props.actorId ?? null,
          props.companyId ?? null,
          "analytics",
        ],
      });
      setSuccess(message);
    } catch (failure) {
      const status = advertisingErrorStatus(failure);
      setConflict(status === 409);
      setBlocked(status === 401 || status === 403);
      setError(
        status === 409
          ? "Otra persona cambió esta revisión. Recarga el pedido antes de guardar."
          : advertisingErrorMessage(failure),
      );
    } finally {
      setBusy(false);
    }
  }
  function close() {
    if (busy) return;
    props.onClose();
    setTab("attribution");
    setError(null);
    setSuccess(null);
    setConflict(false);
    setBlocked(false);
  }
  return (
    <Dialog
      open={Boolean(props.orderId)}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{data ? `Pedido ${data.row.orderNumber}` : "Revisar pedido"}</DialogTitle>
          <DialogDescription>
            Las revisiones se guardan en el historial y conservan el dato original.
          </DialogDescription>
        </DialogHeader>
        {detail.isPending && <Skeleton className="h-48" aria-label="Cargando pedido" />}
        {(error || detail.error) && (
          <Alert variant="destructive">
            <AlertDescription>{error ?? advertisingErrorMessage(detail.error)}</AlertDescription>
          </Alert>
        )}
        {conflict && (
          <Button
            variant="outline"
            disabled={detail.isFetching}
            onClick={() => {
              void detail.refetch().then(() => {
                setConflict(false);
                setError(null);
                setSuccess(null);
              });
            }}
          >
            Recargar pedido
          </Button>
        )}
        {success && (
          <p role="status" className="text-sm text-primary">
            {success}
          </p>
        )}
        {data && (
          <>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <p className="text-muted-foreground">Venta</p>
                <p className="font-medium">
                  {formatOrderAmount(data.row.revenue, data.row.currency)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Entregado</p>
                <p>{formatOrderTimestamp(data.row.deliveredAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cobrado</p>
                <p>{formatOrderTimestamp(data.row.paidAt)}</p>
              </div>
            </div>
            <fieldset className="flex flex-wrap gap-2" aria-label="Secciones del pedido">
              {(
                [
                  ["attribution", "Anuncio"],
                  ["finance", "Costos"],
                  ["history", "Historial"],
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  variant={tab === key ? "default" : "outline"}
                  size="sm"
                  disabled={busy}
                  aria-pressed={tab === key}
                  onClick={() => {
                    setTab(key);
                    setSuccess(null);
                  }}
                >
                  {label}
                </Button>
              ))}
            </fieldset>
            {!canManage && tab !== "history" && (
              <p className="text-sm text-muted-foreground">
                Tienes acceso de lectura. Una persona con permiso para revisar publicidad puede
                guardar cambios.
              </p>
            )}
            {tab === "attribution" && (
              <AttributionForm
                key={`${data.row.id}:${data.row.attribution.version}`}
                {...props}
                row={data.row}
                canManage={canManage}
                disabled={busy || conflict}
                onSave={(accountId, adId, reason) =>
                  save(
                    () =>
                      reviewAdvertisingOrderAttribution(
                        props.token ?? "",
                        props.companyId ?? "",
                        data.row.id,
                        { expectedVersion: data.row.attribution.version, accountId, adId, reason },
                      ),
                    "Atribución guardada.",
                  )
                }
              />
            )}
            {tab === "finance" && (
              <FinanceForm
                key={`${data.row.id}:${data.row.costs.version}`}
                row={data.row}
                canManage={canManage}
                disabled={busy || conflict}
                onSave={(currency, costs, reason) =>
                  save(
                    () =>
                      reviewAdvertisingOrderFinance(
                        props.token ?? "",
                        props.companyId ?? "",
                        data.row.id,
                        { expectedVersion: data.row.costs.version, currency, ...costs, reason },
                      ),
                    "Costos guardados.",
                  )
                }
              />
            )}
            {tab === "history" && (
              <div className="space-y-4">
                {(
                  [
                    ["Anuncio", data.attributionHistory],
                    ["Costos", data.financeHistory],
                  ] as const
                ).map(([title, revisions]) => (
                  <div key={title}>
                    <h3 className="font-medium">{title}</h3>
                    {!revisions.length ? (
                      <p className="mt-1 text-sm text-muted-foreground">Sin revisiones</p>
                    ) : (
                      <ol className="mt-2 space-y-2">
                        {revisions.map((revision) => (
                          <li key={revision.version} className="rounded-md border p-3 text-sm">
                            <p className="font-medium">
                              Revisión {revision.version} ·{" "}
                              {formatOrderTimestamp(revision.createdAt)}
                            </p>
                            <p className="mt-1 break-words text-muted-foreground">
                              {revision.reason}
                            </p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface AttributionFormProps extends AdvertisingOrdersPanelProps {
  row: AdvertisingOrderRow;
  canManage: boolean;
  disabled: boolean;
  onSave: (accountId: string | null, adId: string | null, reason: string) => Promise<void>;
}
function AttributionForm(props: AttributionFormProps) {
  const id = useId();
  const [accountId, setAccountId] = useState(props.row.attribution.accountId ?? "all");
  const [selection, setSelection] = useState(
    props.row.attribution.adId && props.row.attribution.accountId
      ? `${props.row.attribution.accountId}/${props.row.attribution.adId}`
      : "none",
  );
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [page, setPage] = useState(1);
  const catalog = useAdvertisingMetaCatalog({
    token: props.token,
    actorId: props.actorId,
    companyId: props.companyId,
    enabled: props.canManage,
    from: props.from,
    to: props.to,
    level: "ad",
    accountId: accountId === "all" ? undefined : accountId,
    page,
    pageSize: 100,
  });
  const rows = (catalog.data?.rows ?? []).filter((row) =>
    `${row.name} ${row.id}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const currentValue =
    props.row.attribution.accountId && props.row.attribution.adId
      ? `${props.row.attribution.accountId}/${props.row.attribution.adId}`
      : "none";
  const currentMissing =
    currentValue !== "none" && !rows.some((row) => `${row.accountId}/${row.id}` === currentValue);
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!props.canManage || props.disabled || reason.trim().length < 8) return;
        const [account, ad] = selection === "none" ? [null, null] : selection.split("/");
        void props.onSave(account, ad, reason.trim());
      }}
    >
      <div>
        <Label htmlFor={`${id}-account`}>Cuenta publicitaria</Label>
        <Select
          value={accountId}
          disabled={!props.canManage || props.disabled}
          onValueChange={(value) => {
            setAccountId(value);
            setPage(1);
            setSelection("none");
          }}
        >
          <SelectTrigger id={`${id}-account`} className="mt-1 w-full">
            <SelectValue placeholder="Elige una cuenta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las cuentas</SelectItem>
            {catalog.data?.accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name} · {account.currency}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {props.canManage && (
        <div>
          <Label htmlFor={`${id}-search`}>Buscar en esta página</Label>
          <Input
            id={`${id}-search`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre o ID del anuncio"
            disabled={props.disabled}
          />
        </div>
      )}
      <div>
        <Label htmlFor={`${id}-ad`}>Anuncio</Label>
        <Select
          value={selection}
          disabled={!props.canManage || props.disabled || catalog.isFetching}
          onValueChange={setSelection}
        >
          <SelectTrigger id={`${id}-ad`} className="mt-1 w-full">
            <SelectValue placeholder="Elige un anuncio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin atribución</SelectItem>
            {currentMissing && (
              <SelectItem value={currentValue}>
                {props.row.attribution.adName ?? "Anuncio actual"} · {props.row.attribution.adId}
              </SelectItem>
            )}
            {rows.map((row) => (
              <SelectItem key={`${row.accountId}/${row.id}`} value={`${row.accountId}/${row.id}`}>
                {row.name} · {row.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {catalog.error && (
        <p role="alert" className="text-sm text-destructive">
          {advertisingErrorMessage(catalog.error)}
        </p>
      )}
      {catalog.data && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {catalog.data.pagination.total} anuncios · página {page}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || props.disabled || catalog.isFetching}
              onClick={() => setPage((current) => current - 1)}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!catalog.data.pagination.hasMore || props.disabled || catalog.isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
      {props.row.attribution.originalReferencePresent && (
        <p className="text-xs text-muted-foreground">
          La referencia original se conserva. El anuncio elegido debe pertenecer a esta empresa.
        </p>
      )}
      <div>
        <Label htmlFor={`${id}-reason`}>Motivo de la revisión</Label>
        <Textarea
          id={`${id}-reason`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          minLength={8}
          maxLength={500}
          disabled={!props.canManage || props.disabled}
          placeholder="Indica cómo confirmaste el anuncio"
        />
      </div>
      {props.canManage && (
        <Button
          type="submit"
          disabled={props.disabled || reason.trim().length < 8 || catalog.isAccessDenied}
        >
          Guardar atribución
        </Button>
      )}
    </form>
  );
}

interface FinanceFormProps {
  row: AdvertisingOrderRow;
  canManage: boolean;
  disabled: boolean;
  onSave: (
    currency: string | null,
    costs: Record<AdvertisingOrderCostKey, string | null>,
    reason: string,
  ) => Promise<void>;
}
function FinanceForm(props: FinanceFormProps) {
  const id = useId();
  const [currency, setCurrency] = useState(props.row.currency ?? "unknown");
  const [reason, setReason] = useState("");
  const [costs, setCosts] = useState(
    () =>
      Object.fromEntries(
        Object.keys(ORDER_COST_LABELS).map((key) => [
          key,
          props.row.costs[key as AdvertisingOrderCostKey] ?? "",
        ]),
      ) as Record<AdvertisingOrderCostKey, string>,
  );
  const valid = Object.values(costs).every(validFinanceInput);
  const currencies = [
    "PEN",
    "USD",
    ...Intl.supportedValuesOf("currency").filter((code) => code !== "PEN" && code !== "USD"),
  ];
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!props.canManage || props.disabled || !valid || reason.trim().length < 8) return;
        void props.onSave(
          currency === "unknown" ? null : currency,
          Object.fromEntries(
            Object.entries(costs).map(([key, value]) => [key, financeInputValue(value)]),
          ) as Record<AdvertisingOrderCostKey, string | null>,
          reason.trim(),
        );
      }}
    >
      <div>
        <Label htmlFor={`${id}-currency`}>Moneda del pedido</Label>
        <Select
          value={currency}
          onValueChange={setCurrency}
          disabled={!props.canManage || props.disabled}
        >
          <SelectTrigger id={`${id}-currency`} className="mt-1 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unknown">Desconocida</SelectItem>
            {currencies.map((code) => (
              <SelectItem key={code} value={code}>
                {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        Deja vacío un costo desconocido. Escribe 0 solo si confirmaste que no hay costo.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(ORDER_COST_LABELS).map(([key, label]) => (
          <div key={key}>
            <Label htmlFor={`${id}-${key}`}>{label}</Label>
            <Input
              id={`${id}-${key}`}
              inputMode="decimal"
              placeholder="Desconocido"
              value={costs[key as AdvertisingOrderCostKey]}
              aria-invalid={!validFinanceInput(costs[key as AdvertisingOrderCostKey])}
              disabled={!props.canManage || props.disabled}
              onChange={(event) =>
                setCosts((current) => ({ ...current, [key]: event.target.value }))
              }
            />
          </div>
        ))}
      </div>
      {!valid && (
        <p role="alert" className="text-sm text-destructive">
          Usa importes positivos con hasta dos decimales y punto decimal.
        </p>
      )}
      <div className="rounded-md bg-muted p-3 text-sm">
        <span className="text-muted-foreground">Resultado guardado antes de publicidad: </span>
        <span className="font-medium">
          {formatOrderAmount(props.row.costs.contributionBeforeAds, props.row.currency)}
        </span>
      </div>
      <div>
        <Label htmlFor={`${id}-reason`}>Motivo de la revisión</Label>
        <Textarea
          id={`${id}-reason`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          minLength={8}
          maxLength={500}
          disabled={!props.canManage || props.disabled}
          placeholder="Indica de dónde vienen los costos"
        />
      </div>
      {props.canManage && (
        <Button type="submit" disabled={props.disabled || !valid || reason.trim().length < 8}>
          Guardar costos
        </Button>
      )}
    </form>
  );
}
