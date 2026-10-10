"use client";

import { History, RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import type {
  AdvertisingManualAuditEntry,
  AdvertisingManualExclusionKind,
  AdvertisingManualResolutionPayload,
  AdvertisingManualResolutionPreview,
  AdvertisingManualStatusWire,
  AdvertisingSnapshotWire,
} from "@/services/advertisingService";
import {
  AdvertisingApiError,
  advertisingErrorStatus,
  advertisingManualErrorMessage,
  getAdvertisingManualAudit,
  previewAdvertisingManualResolution,
  resolveAdvertisingManualRecord,
} from "@/services/advertisingService";
import type { EffectiveAdvertisingSpendWire } from "@/types/advertisingEffective";
import { AdvertisingManualImportDialog } from "./AdvertisingManualImportDialog";
import { formatAdvertisingDate, formatAdvertisingMoney } from "./advertising-model";

export interface AdvertisingLiveManualReviewProps {
  wire: AdvertisingSnapshotWire;
  companyId: string;
  token: string;
  storeIds: string[];
  canReconcile: boolean;
  onChanged: () => Promise<void>;
}

const LABELS: Record<AdvertisingManualStatusWire, string> = {
  pending: "Por revisar",
  represented: "Ya incluido",
  fallback: "Respaldo",
  additional: "Consumo adicional",
  excluded: "Fuera del consumo",
};
const EXCLUSION_LABELS = { payment: "Pago", service: "Servicio", allocation: "Asignación" };
const OUTCOMES: Record<AdvertisingManualResolutionPayload["action"], string> = {
  represented: "El registro queda vinculado al importado. No agrega gasto.",
  fallback: "Se usará como respaldo solo cuando falte consumo importado de esta cuenta y día.",
  additional: "Se sumará como consumo independiente al gasto de esta cuenta y día.",
  excluded: "Queda fuera del consumo. No se crea ningún pago o gasto nuevo.",
  reopened: "Vuelve a pendiente y queda fuera del gasto efectivo.",
};

function money(amount: string | null, currency: string): string {
  if (amount === null) return "Pendiente";
  try {
    return formatAdvertisingMoney(null, currency, amount);
  } catch {
    return "Importe no disponible";
  }
}

function DayComparison({
  before,
  after,
}: {
  before: EffectiveAdvertisingSpendWire;
  after: EffectiveAdvertisingSpendWire;
}) {
  const currencies = [
    ...new Set([...before.totals, ...after.totals].map((total) => total.currency)),
  ];
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-sm font-medium">
        Gasto efectivo de la empresa · {formatAdvertisingDate(before.from)}
      </p>
      {currencies.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          El registro queda fuera. No hay consumo confirmado para este día.
        </p>
      ) : (
        currencies.map((currency) => {
          const previous = before.totals.find((total) => total.currency === currency);
          const next = after.totals.find((total) => total.currency === currency);
          return (
            <div key={currency} className="space-y-1 border-t border-border pt-2 text-sm">
              <p className="font-medium">{currency}</p>
              <p>
                Antes: {money(previous?.amount ?? null, currency)} · Después:{" "}
                {money(next?.amount ?? null, currency)}
              </p>
              {next && (
                <p className="text-xs text-muted-foreground">
                  Importado: {money(next.importedAmount, currency)} · Respaldo:{" "}
                  {money(next.fallbackAmount, currency)} · Adicional:{" "}
                  {money(next.additionalAmount, currency)}
                </p>
              )}
              {next?.coverage !== "complete" && (
                <p className="text-xs text-muted-foreground">
                  Cobertura importada pendiente o parcial.
                </p>
              )}
            </div>
          );
        })
      )}
      <p className="text-xs text-muted-foreground">
        Por revisar: {before.pendingManualCount} → {after.pendingManualCount}. La revisión manual no
        cambia la cobertura del proveedor.
      </p>
      {after.conflictedManualIds.length > 0 && (
        <p role="alert" className="text-sm">
          Hay respaldos en conflicto. No se suman automáticamente.
        </p>
      )}
    </div>
  );
}

export function AdvertisingLiveManualReview({
  wire,
  companyId,
  token,
  storeIds,
  canReconcile,
  onChanged,
}: AdvertisingLiveManualReviewProps) {
  const id = useId();
  const [importOpen, setImportOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [action, setAction] = useState<AdvertisingManualResolutionPayload["action"] | "">("");
  const [currency, setCurrency] = useState("");
  const [accountId, setAccountId] = useState("");
  const [exclusionKind, setExclusionKind] = useState<AdvertisingManualExclusionKind | "">("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [prepared, setPrepared] = useState<{
    payload: AdvertisingManualResolutionPayload;
    result: AdvertisingManualResolutionPreview;
  } | null>(null);
  const [audit, setAudit] = useState<AdvertisingManualAuditEntry[] | null>(null);
  const [busy, setBusy] = useState<"preview" | "save" | "audit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const active = wire.manualRecords.find((record) => record.id === activeId);
  const consumption = action === "represented" || action === "fallback" || action === "additional";
  const allowedCurrencies = [
    ...new Set(
      wire.accounts
        .filter((account) => !active?.currency || account.currency === active.currency)
        .map((account) => account.currency),
    ),
  ];
  const accounts = wire.accounts.filter(
    (account) =>
      account.currency === currency && (!active?.currency || account.currency === active.currency),
  );
  const validAmount = !!active && active.amount !== null && /^\d+(?:\.\d+)?$/.test(active.amount);
  const validChoice = consumption
    ? validAmount && !!currency && accounts.some((account) => account.id === accountId) && confirmed
    : action === "excluded"
      ? !!exclusionKind && confirmed
      : action === "reopened";
  const canPreview =
    !!active &&
    canReconcile &&
    !!action &&
    !!reason.trim() &&
    reason.length <= 1000 &&
    validChoice &&
    busy === null;

  useEffect(
    () => () => {
      sequence.current += 1;
      controller.current?.abort();
    },
    [],
  );

  function close() {
    sequence.current += 1;
    controller.current?.abort();
    setActiveId(null);
    setPrepared(null);
    setAudit(null);
    setError(null);
    setBusy(null);
  }

  function open(recordId: string) {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    sequence.current += 1;
    controller.current?.abort();
    setActiveId(recordId);
    setAction("");
    setCurrency("");
    setAccountId("");
    setExclusionKind("");
    setReason("");
    setConfirmed(false);
    setPrepared(null);
    setAudit(null);
    setError(null);
    setBusy(null);
  }

  async function prepare() {
    if (!canPreview || !active || !action) return;
    const payload: AdvertisingManualResolutionPayload = {
      action,
      expectedVersion: active.resolutionVersion,
      reason: reason.trim(),
      ...(consumption ? { accountId, currency } : {}),
      ...(action === "excluded" && exclusionKind ? { exclusionKind } : {}),
      ...(action === "additional" ? { additionalConsumptionConfirmed: true as const } : {}),
    };
    const current = ++sequence.current;
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    setBusy("preview");
    setError(null);
    try {
      const result = await previewAdvertisingManualResolution(
        token,
        companyId,
        active.id,
        payload,
        nextController.signal,
      );
      if (
        result.recordId !== active.id ||
        result.expectedVersion !== payload.expectedVersion ||
        result.before.from !== active.date ||
        result.after.from !== active.date
      )
        throw new AdvertisingApiError("El registro cambió. Vuelve a revisarlo.", 409);
      if (sequence.current === current) setPrepared({ payload, result });
    } catch (failure: unknown) {
      if (sequence.current === current) {
        setError(advertisingManualErrorMessage(failure));
        if ([401, 403].includes(advertisingErrorStatus(failure) ?? 0)) await onChanged();
      }
    } finally {
      if (sequence.current === current) setBusy(null);
    }
  }

  async function save() {
    if (!active || !prepared || !canReconcile || busy) return;
    if (active.resolutionVersion !== prepared.payload.expectedVersion) {
      setPrepared(null);
      setError("El registro cambió. Vuelve a revisarlo.");
      return;
    }
    const current = ++sequence.current;
    setBusy("save");
    setError(null);
    try {
      const { record } = await resolveAdvertisingManualRecord(
        token,
        companyId,
        active.id,
        prepared.payload,
      );
      if (sequence.current !== current) return;
      setNotice(`Revisión guardada: ${LABELS[record.status].toLowerCase()}.`);
      await onChanged();
      if (sequence.current === current) close();
    } catch (failure: unknown) {
      if (sequence.current === current) {
        setError(advertisingManualErrorMessage(failure));
        if ([401, 403, 409].includes(advertisingErrorStatus(failure) ?? 0)) {
          setPrepared(null);
          await onChanged();
        }
      }
    } finally {
      if (sequence.current === current) setBusy(null);
    }
  }

  async function loadAudit() {
    if (!active || busy) return;
    const current = ++sequence.current;
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    setBusy("audit");
    setError(null);
    try {
      const result = await getAdvertisingManualAudit(
        token,
        companyId,
        active.id,
        nextController.signal,
      );
      if (sequence.current === current) setAudit(result.entries);
    } catch (failure: unknown) {
      if (sequence.current === current) {
        setError(advertisingManualErrorMessage(failure));
        if ([401, 403].includes(advertisingErrorStatus(failure) ?? 0)) await onChanged();
      }
    } finally {
      if (sequence.current === current) setBusy(null);
    }
  }

  return (
    <>
      <Card className="min-w-0">
        <CardHeader className="px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Histórico manual</CardTitle>
            <Badge variant="outline">
              {wire.manualRecords.filter((record) => record.status === "pending").length} por
              revisar
            </Badge>
          </div>
          <CardDescription>Los pendientes quedan fuera del gasto efectivo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-4 sm:px-6">
          {notice && (
            <p role="status" className="text-sm">
              {notice}
            </p>
          )}
          {canReconcile ? (
            <Button
              variant="outline"
              onClick={() => {
                setNotice(null);
                setImportOpen(true);
              }}
            >
              Revisar este navegador
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Necesitas permiso para revisar históricos. Puedes consultar los registros.
            </p>
          )}
          {wire.manualRecords.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay registros guardados para este periodo.
            </p>
          )}
          {wire.manualRecords.map((record) => (
            <div
              key={record.id}
              className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">
                  {formatAdvertisingDate(record.date)} ·{" "}
                  {record.source === "pauta"
                    ? "Pauta"
                    : record.source === "cierre"
                      ? "Cierre"
                      : "Manual"}
                </p>
                <p className="text-sm tabular-nums">
                  {record.amount ?? "Importe pendiente"} ·{" "}
                  {record.currency ?? "Moneda de origen por confirmar"}
                </p>
                <p className="break-all text-xs text-muted-foreground">
                  Referencia: {record.sourceId}
                </p>
                <Badge variant="outline">{LABELS[record.status]}</Badge>
                {record.classificationCurrency && (
                  <p className="text-xs text-muted-foreground">
                    Clasificado en {record.classificationCurrency}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                className="min-h-11 w-full sm:w-auto"
                onClick={() => open(record.id)}
              >
                {canReconcile ? "Revisar registro" : "Ver registro"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
      <AdvertisingManualImportDialog
        open={importOpen}
        companyId={companyId}
        token={token}
        storeIds={storeIds}
        canReconcile={canReconcile}
        onClose={() => setImportOpen(false)}
        onAccessDenied={onChanged}
        onImported={async (result) => {
          setNotice(
            `${result.counts.new} registros guardados por revisar. Los originales siguen en este navegador.`,
          );
          await onChanged();
        }}
      />
      <Dialog
        open={!!active}
        onOpenChange={(value) => {
          if (!value && !busy) close();
        }}
      >
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6"
          showCloseButton={!busy}
          onCloseAutoFocus={(event) => {
            if (opener.current?.isConnected) {
              event.preventDefault();
              opener.current.focus();
            }
          }}
        >
          <DialogHeader className="pr-5 text-left">
            <DialogTitle>Revisar registro</DialogTitle>
            <DialogDescription>
              {active
                ? `${formatAdvertisingDate(active.date)} · ${LABELS[active.status]} · versión ${active.resolutionVersion}`
                : "Histórico manual"}
            </DialogDescription>
          </DialogHeader>
          {active && (
            <>
              <p className="text-sm">
                Original: {active.amount ?? "Importe pendiente"} ·{" "}
                {active.currency ?? "Moneda por confirmar"}. Se conserva sin cambios.
              </p>
              <p className="break-all text-xs text-muted-foreground">
                Origen:{" "}
                {active.source === "pauta"
                  ? "Pauta"
                  : active.source === "cierre"
                    ? "Cierre"
                    : "Manual"}{" "}
                · Referencia: {active.sourceId}
              </p>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {prepared ? (
                <div className="space-y-3">
                  <p className="text-sm">{OUTCOMES[prepared.payload.action]}</p>
                  <DayComparison before={prepared.result.before} after={prepared.result.after} />
                  <p className="text-sm">Motivo: {prepared.payload.reason}</p>
                </div>
              ) : canReconcile ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor={`${id}-action`}>¿Qué representa?</Label>
                    <Select
                      value={action}
                      onValueChange={(value) => {
                        setAction(value as AdvertisingManualResolutionPayload["action"]);
                        setConfirmed(false);
                        setError(null);
                      }}
                    >
                      <SelectTrigger id={`${id}-action`}>
                        <SelectValue placeholder="Elige una opción" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="represented" disabled={!validAmount}>
                          Ya incluido en el importado
                        </SelectItem>
                        <SelectItem value="fallback" disabled={!validAmount}>
                          Respaldo de consumo sin importar
                        </SelectItem>
                        <SelectItem value="additional" disabled={!validAmount}>
                          Consumo adicional independiente
                        </SelectItem>
                        <SelectItem value="excluded">No es consumo de anuncios</SelectItem>
                        {active.status !== "pending" && (
                          <SelectItem value="reopened">Volver a revisar</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  {consumption && (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor={`${id}-currency`}>Confirma la moneda</Label>
                        <Select
                          value={currency}
                          onValueChange={(value) => {
                            setCurrency(value);
                            setAccountId("");
                            setConfirmed(false);
                          }}
                        >
                          <SelectTrigger
                            id={`${id}-currency`}
                            disabled={allowedCurrencies.length === 0}
                          >
                            <SelectValue placeholder="Sin moneda seleccionada" />
                          </SelectTrigger>
                          <SelectContent>
                            {allowedCurrencies.map((value) => (
                              <SelectItem key={value} value={value}>
                                {value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {allowedCurrencies.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            No hay cuentas en la moneda original. El consumo seguirá por revisar.
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`${id}-account`}>Cuenta y día del consumo</Label>
                        <Select
                          value={accountId}
                          onValueChange={(value) => {
                            setAccountId(value);
                            setConfirmed(false);
                          }}
                        >
                          <SelectTrigger
                            id={`${id}-account`}
                            disabled={!currency || accounts.length === 0}
                          >
                            <SelectValue placeholder="Elige una cuenta" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.name} · {account.currency} · {account.timeZone}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Se usará el día original: {formatAdvertisingDate(active.date)}.
                        </p>
                      </div>
                      <Label className="flex items-start gap-2">
                        <Checkbox
                          checked={confirmed}
                          onCheckedChange={(value) => setConfirmed(value === true)}
                        />
                        <span className="text-sm">
                          {action === "represented"
                            ? "Corresponde al consumo importado de esta cuenta y día."
                            : action === "additional"
                              ? "Es consumo independiente de anuncios; no es pago, servicio ni reparto del mismo gasto."
                              : "Es consumo de anuncios de esta cuenta y día; no es un pago ni un servicio."}
                        </span>
                      </Label>
                    </>
                  )}
                  {action === "excluded" && (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor={`${id}-kind`}>Tipo de registro</Label>
                        <Select
                          value={exclusionKind}
                          onValueChange={(value) => {
                            setExclusionKind(value as AdvertisingManualExclusionKind);
                            setConfirmed(false);
                          }}
                        >
                          <SelectTrigger id={`${id}-kind`}>
                            <SelectValue placeholder="Elige un tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(EXCLUSION_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Label className="flex items-start gap-2">
                        <Checkbox
                          checked={confirmed}
                          onCheckedChange={(value) => setConfirmed(value === true)}
                        />
                        <span className="text-sm">Confirmo que no es consumo de anuncios.</span>
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Queda fuera. Los pagos y servicios se registran en su sección
                        correspondiente.
                      </p>
                    </>
                  )}
                  {!!action && (
                    <div className="space-y-1.5">
                      <Label htmlFor={`${id}-reason`}>Motivo</Label>
                      <Textarea
                        id={`${id}-reason`}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        maxLength={1000}
                        placeholder="Explica por qué elegiste esta opción."
                      />
                    </div>
                  )}
                  {action === "reopened" && (
                    <p className="text-sm text-muted-foreground">
                      Volverá a pendiente y quedará fuera del gasto efectivo.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Vista de consulta. Necesitas permiso para guardar una revisión.
                </p>
              )}
              <div className="space-y-2 border-t border-border pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void loadAudit()}
                >
                  <History aria-hidden="true" />
                  {busy === "audit" ? "Consultando…" : "Ver historial"}
                </Button>
                {audit !== null &&
                  (audit.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Este registro aún no tiene revisiones.
                    </p>
                  ) : (
                    <ol className="space-y-2">
                      {audit.map((entry) => (
                        <li
                          key={entry.id}
                          className="space-y-1 rounded-md border border-border p-3 text-sm"
                        >
                          <p className="font-medium">
                            Versión {entry.resolutionVersion} ·{" "}
                            {entry.action === "reopened" ? "Reabierto" : LABELS[entry.action]}
                          </p>
                          <p>{entry.reason}</p>
                          <p className="break-all text-xs text-muted-foreground">
                            Actor: {entry.actorId} ·{" "}
                            {new Date(entry.createdAt).toLocaleString("es-PE")}
                          </p>
                          {entry.classificationCurrency && (
                            <p className="text-xs">
                              Moneda: {entry.classificationCurrency} · Cuenta: {entry.accountId}
                            </p>
                          )}
                          {entry.exclusionKind && (
                            <p className="text-xs">{EXCLUSION_LABELS[entry.exclusionKind]}</p>
                          )}
                        </li>
                      ))}
                    </ol>
                  ))}
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  disabled={busy !== null}
                  onClick={prepared ? () => setPrepared(null) : close}
                >
                  {prepared ? "Volver" : "Cerrar"}
                </Button>
                {canReconcile &&
                  (prepared ? (
                    <Button disabled={busy !== null} onClick={() => void save()}>
                      {busy === "save" ? "Guardando…" : "Guardar revisión"}
                    </Button>
                  ) : (
                    <Button disabled={!canPreview} onClick={() => void prepare()}>
                      {action === "reopened" && <RotateCcw aria-hidden="true" />}
                      {busy === "preview" ? "Consultando…" : "Ver antes y después"}
                    </Button>
                  ))}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
