"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Layers, Store } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { AdvertisingSnapshotOptions } from "@/hooks/useAdvertisingSnapshot";
import { advertisingV11Key, useAdvertisingAssignmentsV11 } from "@/hooks/useAdvertisingV11";
import { advertisingErrorMessage, advertisingErrorStatus } from "@/services/advertisingService";
import {
  type AdvertisingAccountAssignmentV11,
  type AdvertisingAdsetAssignment,
  type AdvertisingAssignmentApply,
  type AdvertisingAssignmentsV11,
  applyAdvertisingSuggestedAssignments,
  changeAdvertisingAccountStore,
  changeAdvertisingAdsetStore,
  getAdvertisingAssignmentHistoryV11,
} from "@/services/advertisingV11Service";
import { advertisingAssignmentSpendPeriod } from "./advertising-assignment-period";

export { advertisingAssignmentSpendPeriod } from "./advertising-assignment-period";

import { formatMetaSpend } from "./advertising-meta-model";
import { formatAdvertisingDate } from "./advertising-model";

type Change =
  | { kind: "account"; account: AdvertisingAccountAssignmentV11; value: string }
  | {
      kind: "adset";
      account: AdvertisingAccountAssignmentV11;
      adset: AdvertisingAdsetAssignment;
      value: string;
    }
  | {
      kind: "suggestions";
      suggestions: Array<{
        account: AdvertisingAccountAssignmentV11;
        adset: AdvertisingAdsetAssignment;
      }>;
    };
interface HistorySelection {
  accountId: string;
  adsetId?: string;
  name: string;
}

export function AdvertisingStoreAssignmentsPanel(identity: AdvertisingSnapshotOptions) {
  const [spendPeriod] = useState(advertisingAssignmentSpendPeriod);
  const [onboarding, setOnboarding] = useState(false);
  const query = useAdvertisingAssignmentsV11({ ...identity, ...spendPeriod });
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    setOnboarding(new URLSearchParams(window.location.search).get("step") === "store");
    return () => {
      mounted.current = false;
    };
  }, []);
  async function run(action: (token: string, companyId: string) => Promise<unknown>) {
    if (!identity.token || !identity.companyId || !query.data?.capabilities.canConfigure || busy)
      return false;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action(identity.token, identity.companyId);
      if (!mounted.current) return false;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: advertisingV11Key(identity.actorId, identity.companyId),
        }),
        queryClient.invalidateQueries({
          queryKey: ["advertising-workspace", identity.actorId, identity.companyId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["advertising-meta", identity.actorId, identity.companyId],
        }),
      ]);
      if (mounted.current) setNotice("Asignación guardada.");
      return mounted.current;
    } catch (failure: unknown) {
      const status = advertisingErrorStatus(failure);
      if ([401, 403, 409].includes(status ?? 0) && mounted.current) await query.refetch();
      if (mounted.current)
        setError(
          status === 409
            ? "La asignación cambió. Cierra y revisa los datos antes de guardar de nuevo."
            : status === 400
              ? "Revisa la tienda y los canales antes de guardar."
              : advertisingErrorMessage(failure),
        );
      return false;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  if (!identity.token || !identity.actorId || !identity.companyId)
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Inicia sesión con una empresa para consultar asignaciones.
      </p>
    );
  return (
    <section
      className="min-w-0 space-y-5 p-4 sm:p-6 lg:p-8"
      aria-label="Asignaciones de publicidad"
    >
      <div>
        <h2 className="font-semibold">Asignaciones</h2>
        {onboarding ? <p className="mt-2 text-sm font-semibold">Asigna la tienda</p> : null}
        <p className="mt-1 text-sm text-muted-foreground">
          Indica para qué tienda anuncia cada cuenta.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Gasto de los últimos 30 días: {formatAdvertisingDate(spendPeriod.from)} al{" "}
          {formatAdvertisingDate(spendPeriod.to)}.
        </p>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}
      {query.isError ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm">
            {[404, 503].includes(advertisingErrorStatus(query.error) ?? 0)
              ? "Las asignaciones por tienda aún no están disponibles."
              : advertisingErrorMessage(query.error)}
          </p>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            Volver a intentar
          </Button>
        </div>
      ) : !query.data ? (
        <Skeleton className="h-64" aria-label="Cargando asignaciones" />
      ) : (
        <AdvertisingStoreAssignments
          workspace={query.data}
          busy={busy}
          mutationError={error}
          onAccountChange={(accountId, payload) =>
            run((token, companyId) =>
              changeAdvertisingAccountStore(token, companyId, accountId, payload),
            )
          }
          onAdsetChange={(adsetId, payload) =>
            run((token, companyId) =>
              changeAdvertisingAdsetStore(token, companyId, adsetId, payload),
            )
          }
          onSuggestions={(payload) =>
            run((token, companyId) =>
              applyAdvertisingSuggestedAssignments(token, companyId, payload),
            )
          }
          identity={identity}
        />
      )}
    </section>
  );
}

interface AssignmentProps {
  workspace: AdvertisingAssignmentsV11;
  busy: boolean;
  mutationError?: string | null;
  identity?: AdvertisingSnapshotOptions;
  onAccountChange: (
    accountId: string,
    payload: Parameters<typeof changeAdvertisingAccountStore>[3],
  ) => Promise<boolean>;
  onAdsetChange: (
    adsetId: string,
    payload: Parameters<typeof changeAdvertisingAdsetStore>[3],
  ) => Promise<boolean>;
  onSuggestions: (
    payload: Parameters<typeof applyAdvertisingSuggestedAssignments>[2],
  ) => Promise<boolean>;
}
export function AdvertisingStoreAssignments({
  workspace,
  busy,
  mutationError,
  identity,
  onAccountChange,
  onAdsetChange,
  onSuggestions,
}: AssignmentProps) {
  const id = useId();
  const [change, setChange] = useState<Change | null>(null);
  const [apply, setApply] = useState<AdvertisingAssignmentApply>("all_history");
  const [reason, setReason] = useState("");
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [history, setHistory] = useState<HistorySelection | null>(null);
  const canConfigure = workspace.capabilities.canConfigure;
  const storeName = (storeId: string | null) =>
    !storeId
      ? "Sin asignar"
      : (workspace.stores.find((store) => store.id === storeId)?.name ?? "Tienda anterior");
  const suggestions = workspace.accounts.flatMap((account) =>
    account.mode === "multi"
      ? account.adsets
          .filter(
            (adset) =>
              !adset.storeId &&
              adset.suggestion &&
              workspace.stores.some((store) => store.id === adset.suggestion?.storeId),
          )
          .map((adset) => ({ account, adset }))
      : [],
  );
  const reviewedSuggestions = change?.kind === "suggestions" ? change.suggestions : [];
  function open(next: Change) {
    setChange(next);
    setApply("all_history");
    setReason("");
    setSelectedSuggestions([]);
  }
  async function save() {
    if (!change || !canConfigure || busy || reason.trim().length < 3) return;
    let saved = false;
    if (change.kind === "account")
      saved = await onAccountChange(change.account.id, {
        mode: change.value === "multi" ? "multi" : "single",
        storeId: change.value === "multi" ? null : change.value,
        apply,
        expectedVersion: change.account.version,
        reason: reason.trim(),
      });
    else if (change.kind === "adset")
      saved = await onAdsetChange(change.adset.id, {
        accountId: change.account.id,
        storeId: change.value === "none" ? null : change.value,
        apply,
        expectedVersion: change.adset.version,
        reason: reason.trim(),
      });
    else {
      const selections = change.suggestions
        .filter(({ account, adset }) => selectedSuggestions.includes(`${account.id}:${adset.id}`))
        .map(({ account, adset }) => ({
          accountId: account.id,
          adsetId: adset.id,
          storeId: adset.suggestion?.storeId ?? "",
          expectedVersion: adset.version,
        }));
      if (!selections.length) return;
      saved = await onSuggestions({ apply, reason: reason.trim(), selections });
    }
    if (saved) setChange(null);
  }
  return (
    <div className="space-y-5">
      {workspace.pending.adsetCount ? (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>
              <strong>
                {workspace.pending.adsetCount}{" "}
                {workspace.pending.adsetCount === 1
                  ? "conjunto sin asignar"
                  : "conjuntos sin asignar"}
                .
              </strong>{" "}
              {workspace.pending.byCurrency
                .map((total) => formatMetaSpend(total.spend, total.currency))
                .join(" · ")}{" "}
              permanecen en el total del negocio.
            </span>
            {suggestions.length && canConfigure ? (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => open({ kind: "suggestions", suggestions })}
              >
                Revisar {suggestions.length}{" "}
                {suggestions.length === 1 ? "sugerencia" : "sugerencias"}
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      {workspace.accounts.length ? (
        <Card>
          <CardContent className="min-w-0 pt-4">
            <Table aria-label="Asignación por cuenta y conjunto">
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta / conjunto</TableHead>
                  <TableHead className="text-right">Gasto 30 días</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Tienda</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>
                    <span className="sr-only">Historial</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspace.accounts.map((account) => (
                  <AssignmentAccountRows
                    key={account.id}
                    account={account}
                    workspace={workspace}
                    busy={busy}
                    storeName={storeName}
                    onChange={open}
                    onHistory={setHistory}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-2 py-10 text-center">
            <Store className="mx-auto size-7 text-primary" aria-hidden="true" />
            <h3 className="font-semibold">No hay cuentas para asignar</h3>
            <Button variant="outline" size="sm" asChild>
              <Link href="/publicidad/conexiones">Ver conexiones</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Canales de cada tienda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {workspace.stores.map((store) => (
            <div key={store.id} className="space-y-1">
              <p className="text-sm font-medium">{store.name}</p>
              <p className="text-xs text-muted-foreground">
                {workspace.channels
                  .filter((channel) => channel.storeId === store.id)
                  .map(
                    (channel) =>
                      `${channel.label}${channel.identifier ? ` · ${channel.identifier}` : ""}`,
                  )
                  .join(" / ") || "Sin canales configurados"}
              </p>
            </div>
          ))}
          <Button variant="outline" size="sm" asChild>
            <Link href="/configuracion/tiendas?tab=canales">Configurar tiendas y canales</Link>
          </Button>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Una tienda: todo el gasto de la cuenta. Varias tiendas: cada conjunto se asigna por
        separado. Las sugerencias requieren tu revisión.
      </p>
      <Dialog
        open={change !== null}
        onOpenChange={(openDialog) => {
          if (!openDialog && !busy) setChange(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {change?.kind === "suggestions" ? "Revisar sugerencias" : "Confirmar asignación"}
            </DialogTitle>
            <DialogDescription>
              {change?.kind === "account"
                ? change.account.name
                : change?.kind === "adset"
                  ? change.adset.name
                  : "Selecciona las sugerencias que quieres aplicar."}
            </DialogDescription>
          </DialogHeader>
          {change?.kind === "suggestions" ? (
            <div className="space-y-3">
              {reviewedSuggestions.map(({ account, adset }) => {
                const key = `${account.id}:${adset.id}`;
                return (
                  <label
                    key={key}
                    htmlFor={`${id}-${key}`}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3"
                  >
                    <Checkbox
                      id={`${id}-${key}`}
                      checked={selectedSuggestions.includes(key)}
                      disabled={busy}
                      onCheckedChange={(checked) =>
                        setSelectedSuggestions((current) =>
                          checked === true
                            ? [...current, key]
                            : current.filter((item) => item !== key),
                        )
                      }
                      aria-label={`Aplicar ${adset.name} a ${storeName(adset.suggestion?.storeId ?? null)}`}
                    />
                    <span className="min-w-0 space-y-1 text-sm">
                      <span className="block font-medium">
                        {adset.name} → {storeName(adset.suggestion?.storeId ?? null)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {account.name} ·{" "}
                        {adset.suggestion?.reason === "destination-match"
                          ? "Coincide con el destino"
                          : "Coincide con el nombre"}
                        {adset.destinations.length ? ` · ${adset.destinations.join(" / ")}` : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : change ? (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p>
                {change.kind === "account"
                  ? change.account.mode === "multi"
                    ? "Varias tiendas"
                    : storeName(change.account.storeId)
                  : storeName(change.adset.storeId)}{" "}
                →{" "}
                <strong>
                  {change.value === "multi"
                    ? "Varias tiendas"
                    : storeName(change.value === "none" ? null : change.value)}
                </strong>
              </p>
              {change.kind === "account" && change.value === "multi" ? (
                <p className="text-xs text-muted-foreground">
                  Los conjuntos actuales conservan la tienda de la cuenta. Los nuevos quedan sin
                  asignar.
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={`${id}-apply`}>Aplicar el cambio</Label>
            <Select
              value={apply}
              disabled={busy}
              onValueChange={(value) => {
                if (value === "all_history" || value === "from_today") setApply(value);
              }}
            >
              <SelectTrigger id={`${id}-apply`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_history">Todo el historial</SelectItem>
                <SelectItem value="from_today">Desde hoy</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {apply === "all_history"
                ? "Reasigna el gasto importado del historial. No cambia la tienda de las ventas."
                : `El gasto anterior conserva su asignación. El cambio empieza el ${formatAdvertisingDate(workspace.today)}.`}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-reason`}>Motivo del cambio</Label>
            <Textarea
              id={`${id}-reason`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              disabled={busy}
            />
          </div>
          {mutationError ? (
            <p role="alert" className="text-sm text-destructive">
              {mutationError}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setChange(null)}>
              Cancelar
            </Button>
            <Button
              disabled={
                busy ||
                !canConfigure ||
                reason.trim().length < 3 ||
                (change?.kind === "suggestions" && selectedSuggestions.length === 0)
              }
              onClick={() => void save()}
            >
              {busy ? "Guardando…" : "Confirmar y guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {identity ? (
        <AssignmentHistoryDialog
          selection={history}
          identity={identity}
          stores={workspace.stores}
          onClose={() => setHistory(null)}
        />
      ) : null}
    </div>
  );
}

function AssignmentAccountRows({
  account,
  workspace,
  busy,
  storeName,
  onChange,
  onHistory,
}: {
  account: AdvertisingAccountAssignmentV11;
  workspace: AdvertisingAssignmentsV11;
  busy: boolean;
  storeName: (id: string | null) => string;
  onChange: (change: Change) => void;
  onHistory: (selection: HistorySelection) => void;
}) {
  const canConfigure = workspace.capabilities.canConfigure;
  return (
    <>
      <TableRow>
        <TableCell className="min-w-44 whitespace-normal">
          <p className="font-medium">{account.name}</p>
          <p className="text-xs text-muted-foreground">
            Meta · ID {account.externalId} · {account.currency}
          </p>
        </TableCell>
        <TableCell className="text-right whitespace-nowrap tabular-nums">
          {formatMetaSpend(account.spend, account.currency)}
        </TableCell>
        <TableCell className="max-w-52 whitespace-normal text-xs text-muted-foreground">
          {account.mode === "multi"
            ? "Varios destinos"
            : account.destinations.join(" / ") || "Por confirmar"}
        </TableCell>
        <TableCell>
          <Select
            value={account.mode === "multi" ? "multi" : (account.storeId ?? "none")}
            disabled={busy || !canConfigure}
            onValueChange={(value) => onChange({ kind: "account", account, value })}
          >
            <SelectTrigger aria-label={`Tienda de ${account.name}`} className="min-w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {!account.storeId && account.mode === "single" ? (
                <SelectItem value="none" disabled>
                  Elige una tienda
                </SelectItem>
              ) : null}
              {account.storeId &&
              !workspace.stores.some((store) => store.id === account.storeId) ? (
                <SelectItem value={account.storeId} disabled>
                  Tienda anterior
                </SelectItem>
              ) : null}
              {workspace.stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
              <SelectItem value="multi">Varias tiendas</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Badge variant="outline">
            {account.status === "assigned"
              ? "Asignada"
              : account.status === "partial"
                ? "Por completar"
                : "Sin asignar"}
          </Badge>
        </TableCell>
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Ver historial de ${account.name}`}
            onClick={() => onHistory({ accountId: account.id, name: account.name })}
          >
            <History className="size-4" aria-hidden="true" />
          </Button>
        </TableCell>
      </TableRow>
      {account.mode === "multi"
        ? account.adsets.map((adset) => (
            <TableRow key={`${account.id}:${adset.id}`} className="bg-muted/20">
              <TableCell className="whitespace-normal">
                <p className="flex items-center gap-2 text-sm">
                  <Layers className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {adset.name}
                </p>
                <p className="pl-5 text-xs text-muted-foreground">{adset.campaignName}</p>
              </TableCell>
              <TableCell className="text-right whitespace-nowrap tabular-nums">
                {formatMetaSpend(adset.spend, account.currency)}
              </TableCell>
              <TableCell className="max-w-52 whitespace-normal text-xs text-muted-foreground">
                {adset.destinations.join(" / ") || "Destino por confirmar"}
                {!adset.storeId && adset.suggestion ? (
                  <span className="mt-1 block text-primary">
                    Sugerencia: {storeName(adset.suggestion.storeId)}
                  </span>
                ) : null}
                {adset.unresolvedChannelCount ? (
                  <span className="mt-1 block">Canal por confirmar</span>
                ) : null}
              </TableCell>
              <TableCell>
                <Select
                  value={adset.storeId ?? "none"}
                  disabled={busy || !canConfigure}
                  onValueChange={(value) => onChange({ kind: "adset", account, adset, value })}
                >
                  <SelectTrigger aria-label={`Tienda de ${adset.name}`} className="min-w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {adset.storeId &&
                    !workspace.stores.some((store) => store.id === adset.storeId) ? (
                      <SelectItem value={adset.storeId} disabled>
                        Tienda anterior
                      </SelectItem>
                    ) : null}
                    {workspace.stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{adset.storeId ? "Asignado" : "Sin asignar"}</Badge>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Ver historial de ${adset.name}`}
                  onClick={() =>
                    onHistory({ accountId: account.id, adsetId: adset.id, name: adset.name })
                  }
                >
                  <History className="size-4" aria-hidden="true" />
                </Button>
              </TableCell>
            </TableRow>
          ))
        : null}
    </>
  );
}

function AssignmentHistoryDialog({
  selection,
  identity,
  stores,
  onClose,
}: {
  selection: HistorySelection | null;
  identity: AdvertisingSnapshotOptions;
  stores: AdvertisingAssignmentsV11["stores"];
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: [
      ...advertisingV11Key(identity.actorId, identity.companyId),
      "history",
      selection?.accountId,
      selection?.adsetId,
    ],
    queryFn: ({ signal }) => {
      if (!selection || !identity.token || !identity.companyId)
        throw new Error("Sesión no disponible");
      return getAdvertisingAssignmentHistoryV11(
        identity.token,
        identity.companyId,
        selection.accountId,
        selection.adsetId,
        signal,
      );
    },
    enabled: !!selection && !!identity.token && !!identity.actorId && !!identity.companyId,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const refetch = query.refetch;
  const observedToken = useRef(identity.token);
  useEffect(() => {
    if (observedToken.current === identity.token) return;
    observedToken.current = identity.token;
    if (selection && identity.token && identity.actorId && identity.companyId) void refetch();
  }, [identity.token, identity.actorId, identity.companyId, selection, refetch]);
  const denied = [401, 403].includes(advertisingErrorStatus(query.error) ?? 0);
  return (
    <Dialog
      open={selection !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historial de asignaciones</DialogTitle>
          <DialogDescription>{selection?.name}</DialogDescription>
        </DialogHeader>
        {query.isError ? (
          <p role="alert" className="text-sm">
            {advertisingErrorMessage(query.error)}
          </p>
        ) : !query.data || denied ? (
          <Skeleton className="h-32" />
        ) : query.data.history.length ? (
          <ol className="space-y-3">
            {query.data.history.map((entry) => (
              <li
                key={entry.version}
                className="space-y-1 rounded-lg border border-border p-3 text-sm"
              >
                <p className="font-medium">
                  {entry.mode === "multi"
                    ? "Varias tiendas"
                    : entry.storeId
                      ? (stores.find((store) => store.id === entry.storeId)?.name ??
                        "Tienda anterior")
                      : "Sin asignar"}{" "}
                  · v{entry.version}
                </p>
                <p className="text-xs text-muted-foreground">
                  {entry.apply === "all_history"
                    ? "Todo el historial"
                    : `Desde ${formatAdvertisingDate(entry.effectiveFrom)}`}{" "}
                  · {entry.superseded ? "Anterior" : "Vigente"}
                </p>
                <p>{entry.reason}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">Sin cambios registrados.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
