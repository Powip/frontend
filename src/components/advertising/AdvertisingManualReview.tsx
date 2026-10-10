"use client";

import { CheckCircle2, FileClock, Info, RotateCcw } from "lucide-react";
import { useId, useRef, useState } from "react";
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
import type { AdvertisingLiveManualReviewProps } from "./AdvertisingLiveManualReview";
import { AdvertisingLiveManualReview } from "./AdvertisingLiveManualReview";
import {
  type AdvertisingSnapshot,
  formatAdvertisingDate,
  formatAdvertisingMoney,
  hasAdvertisingAmount,
  providerLabel,
} from "./advertising-model";

export interface AdvertisingManualReviewProps {
  snapshot: AdvertisingSnapshot;
  onResolve?: (recordId: string, accountId: string) => void;
  onReopen?: (recordId: string) => void;
  isDemo: boolean;
  live?: AdvertisingLiveManualReviewProps;
}

export function AdvertisingManualReview({ live, ...props }: AdvertisingManualReviewProps) {
  return live ? (
    <AdvertisingLiveManualReview {...live} />
  ) : (
    <AdvertisingExampleManualReview {...props} />
  );
}

function AdvertisingExampleManualReview({
  snapshot,
  onResolve,
  onReopen,
  isDemo,
}: AdvertisingManualReviewProps) {
  const id = useId();
  const opener = useRef<HTMLElement | null>(null);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const activeRecord = snapshot.manualRecords.find((record) => record.id === activeRecordId);
  const selectedAccount = snapshot.accounts.find((account) => account.id === accountId);
  const importedDay = snapshot.days.find(
    (day) => day.accountId === accountId && day.date === activeRecord?.date,
  );
  const canCompare = Boolean(
    activeRecord?.currency &&
      selectedAccount?.currency === activeRecord.currency &&
      hasAdvertisingAmount(importedDay),
  );
  const canResolve = Boolean(
    onResolve && canCompare && confirmed && activeRecord?.status === "pending",
  );
  const linkedAccount = activeRecord?.importedAccountId
    ? snapshot.accounts.find((account) => account.id === activeRecord.importedAccountId)
    : undefined;
  const linkedDay = linkedAccount
    ? snapshot.days.find(
        (day) => day.accountId === linkedAccount.id && day.date === activeRecord?.date,
      )
    : undefined;
  const pendingCount = snapshot.manualRecords.filter(
    (record) => record.status === "pending",
  ).length;

  function openRecord(recordId: string) {
    setAccountId("");
    setConfirmed(false);
    setActiveRecordId(recordId);
  }

  function closeReview() {
    setActiveRecordId(null);
    setAccountId("");
    setConfirmed(false);
  }

  return (
    <>
      <Card className="min-w-0 gap-4">
        <CardHeader className="px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Gastos manuales</CardTitle>
            <Badge variant="outline">{pendingCount} por revisar</Badge>
          </div>
          <CardDescription>
            Los pendientes se conservan separados del gasto importado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-4 sm:px-6">
          {snapshot.manualRecords.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay registros manuales para revisar.</p>
          )}
          {snapshot.manualRecords.map((record) => {
            const representedAccount = snapshot.accounts.find(
              (account) => account.id === record.importedAccountId,
            );
            return (
              <div
                key={record.id}
                className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {record.status === "represented" ? (
                      <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    ) : (
                      <FileClock
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                    {formatAdvertisingDate(record.date)}
                  </p>
                  <p className="text-sm font-semibold tabular-nums">
                    {record.currency
                      ? formatAdvertisingMoney(
                          record.amountMinor,
                          record.currency,
                          record.amountDecimal,
                        )
                      : "Moneda por confirmar"}
                  </p>
                  <p className="break-words text-xs text-muted-foreground">
                    {record.status === "represented"
                      ? `Ya incluido${representedAccount ? ` en ${providerLabel(representedAccount.provider)} · ${representedAccount.name}` : " en el gasto importado"}`
                      : record.currency
                        ? "Cuenta y origen por revisar"
                        : "Confirma la moneda antes de revisar"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="min-h-11 w-full sm:w-auto"
                  onClick={() => openRecord(record.id)}
                >
                  {record.status === "represented" ? "Ver gasto" : "Revisar gasto"}
                </Button>
              </div>
            );
          })}
          {!onResolve && snapshot.manualRecords.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Vista de consulta. Un administrador puede revisar estos registros.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(activeRecord)}
        onOpenChange={(open) => {
          if (!open) closeReview();
        }}
      >
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:max-w-xl sm:p-6"
          onOpenAutoFocus={() => {
            opener.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            if (opener.current?.isConnected) {
              event.preventDefault();
              opener.current.focus();
            }
          }}
        >
          {activeRecord && (
            <>
              <DialogHeader className="pr-5 text-left">
                {isDemo && (
                  <Badge variant="secondary">
                    <Info aria-hidden="true" />
                    Simulación
                  </Badge>
                )}
                <DialogTitle className="leading-snug">
                  {activeRecord.status === "represented" ? "Gasto revisado" : "Compara los gastos"}
                </DialogTitle>
                <DialogDescription>
                  {formatAdvertisingDate(activeRecord.date)} ·{" "}
                  {activeRecord.currency ?? "Moneda por confirmar"}
                </DialogDescription>
              </DialogHeader>

              {activeRecord.status === "represented" ? (
                <>
                  <div className="rounded-lg border bg-muted/50 p-4 text-sm">
                    <p className="font-medium">Este registro no añade otro gasto.</p>
                    <p className="mt-1 break-words text-muted-foreground">
                      {linkedAccount
                        ? `${providerLabel(linkedAccount.provider)} · ${linkedAccount.name}`
                        : "El registro está vinculado al gasto importado."}
                    </p>
                    {linkedAccount && (
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        ID {linkedAccount.externalId} · {linkedAccount.timeZone}
                      </p>
                    )}
                    <p className="mt-3 font-medium">
                      {linkedAccount && linkedDay && hasAdvertisingAmount(linkedDay)
                        ? `Se cuenta una sola vez: ${formatAdvertisingMoney(linkedDay.amountMinor, linkedAccount.currency, linkedDay.amountDecimal)}`
                        : "Consulta el gasto importado para comprobar el importe vigente."}
                    </p>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={closeReview}
                      className="min-h-11 w-full sm:w-auto"
                    >
                      Cerrar
                    </Button>
                    {onReopen && (
                      <Button
                        variant="secondary"
                        className="min-h-11 w-full sm:w-auto"
                        onClick={() => {
                          onReopen(activeRecord.id);
                          setAccountId("");
                          setConfirmed(false);
                        }}
                      >
                        <RotateCcw aria-hidden="true" />
                        Volver a revisar
                      </Button>
                    )}
                  </DialogFooter>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor={`${id}-account`}>Cuenta importada para comparar</Label>
                    <Select
                      value={accountId}
                      onValueChange={(value) => {
                        setAccountId(value);
                        setConfirmed(false);
                      }}
                    >
                      <SelectTrigger
                        id={`${id}-account`}
                        className="min-h-11"
                        disabled={snapshot.accounts.length === 0}
                      >
                        <SelectValue
                          placeholder={
                            snapshot.accounts.length ? "Elige una cuenta" : "Sin cuentas importadas"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {snapshot.accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name} · {account.currency} · {account.externalId}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedAccount && (
                      <p className="break-words text-xs text-muted-foreground">
                        {providerLabel(selectedAccount.provider)} · {selectedAccount.timeZone} · ID{" "}
                        {selectedAccount.externalId}
                      </p>
                    )}
                  </div>

                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    <div className="min-w-0 rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Registrado a mano</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {activeRecord.currency
                          ? formatAdvertisingMoney(
                              activeRecord.amountMinor,
                              activeRecord.currency,
                              activeRecord.amountDecimal,
                            )
                          : "Moneda pendiente"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatAdvertisingDate(activeRecord.date)}
                      </p>
                    </div>
                    <div className="min-w-0 rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Gasto importado del día</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {selectedAccount && importedDay && hasAdvertisingAmount(importedDay)
                          ? formatAdvertisingMoney(
                              importedDay.amountMinor,
                              selectedAccount.currency,
                              importedDay.amountDecimal,
                            )
                          : "Sin dato comparable"}
                      </p>
                      <p className="mt-1 break-words text-xs text-muted-foreground">
                        {selectedAccount ? selectedAccount.name : "Elige una cuenta"}
                      </p>
                    </div>
                  </div>

                  {!activeRecord.currency && (
                    <p className="text-sm text-muted-foreground" role="status">
                      Falta confirmar la moneda original. Este registro sigue pendiente.
                    </p>
                  )}
                  {activeRecord.currency &&
                    selectedAccount &&
                    selectedAccount.currency !== activeRecord.currency && (
                      <p className="text-sm text-muted-foreground" role="status">
                        Las monedas son diferentes. Elige una cuenta con la moneda del registro.
                      </p>
                    )}
                  {activeRecord.currency &&
                    selectedAccount?.currency === activeRecord.currency &&
                    !hasAdvertisingAmount(importedDay) && (
                      <p className="text-sm text-muted-foreground" role="status">
                        No hay gasto importado disponible para esta cuenta y fecha.
                      </p>
                    )}
                  {canCompare &&
                    selectedAccount &&
                    importedDay &&
                    hasAdvertisingAmount(importedDay) && (
                      <div className="space-y-3 rounded-lg border bg-muted/50 p-3">
                        <p className="text-sm">
                          Al confirmar, se contará una sola vez:{" "}
                          <strong>
                            {formatAdvertisingMoney(
                              importedDay.amountMinor,
                              selectedAccount.currency,
                              importedDay.amountDecimal,
                            )}
                          </strong>
                          .
                        </p>
                        {onResolve && (
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id={`${id}-confirm`}
                              checked={confirmed}
                              onCheckedChange={(value) => setConfirmed(value === true)}
                              className="mt-0.5 size-5"
                            />
                            <Label
                              htmlFor={`${id}-confirm`}
                              className="min-h-11 cursor-pointer items-start text-sm font-normal leading-snug"
                            >
                              Confirmo que es el mismo gasto de esta cuenta y día.
                            </Label>
                          </div>
                        )}
                      </div>
                    )}
                  {!onResolve && (
                    <p className="text-xs text-muted-foreground">
                      Vista de consulta. Solicita la revisión a un administrador.
                    </p>
                  )}
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={closeReview}
                      className="min-h-11 w-full sm:w-auto"
                    >
                      Cancelar
                    </Button>
                    {onResolve && (
                      <Button
                        disabled={!canResolve}
                        className="min-h-11 w-full whitespace-normal sm:w-auto"
                        onClick={() => {
                          if (canResolve) {
                            onResolve(activeRecord.id, accountId);
                            setConfirmed(false);
                          }
                        }}
                      >
                        Confirmar mismo gasto
                      </Button>
                    )}
                  </DialogFooter>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
