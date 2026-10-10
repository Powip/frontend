"use client";

import { useEffect, useId, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  AdvertisingDiscoveredAccount,
  AdvertisingProviderWire,
  AdvertisingSelectionPayload,
} from "@/services/advertisingService";
import {
  advertisingErrorMessage,
  discoverAdvertisingAccounts,
} from "@/services/advertisingService";
import { providerLabel } from "./advertising-model";

interface Props {
  provider: AdvertisingProviderWire | null;
  companyId: string;
  companyName: string;
  token: string;
  from: string;
  today: string;
  initialSelectedIds: string[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (payload: AdvertisingSelectionPayload) => Promise<void>;
}

export function AdvertisingLiveAccountsDialog({
  provider,
  companyId,
  companyName,
  token,
  from,
  today,
  initialSelectedIds,
  busy,
  error,
  onClose,
  onSave,
}: Props) {
  const id = useId();
  const [accounts, setAccounts] = useState<AdvertisingDiscoveredAccount[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [syncFrom, setSyncFrom] = useState(from <= today ? from : today);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [review, setReview] = useState(false);
  const selectionKey = JSON.stringify(initialSelectedIds);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Changing attempt explicitly retries account discovery.
  useEffect(() => {
    if (!provider) return;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setLoadError(null);
    setAccounts([]);
    setSelected([]);
    setReview(false);
    setSyncFrom(from <= today ? from : today);
    discoverAdvertisingAccounts(token, companyId, provider, controller.signal)
      .then(({ accounts: available }) => {
        if (!active) return;
        setAccounts(available);
        const previous = JSON.parse(selectionKey) as string[];
        setSelected(
          previous.filter((externalId) =>
            available.some((account) => account.externalId === externalId),
          ),
        );
      })
      .catch((failure: unknown) => {
        if (active) setLoadError(advertisingErrorMessage(failure));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [provider, companyId, token, from, today, selectionKey, attempt]);

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(syncFrom) && syncFrom <= today;
  const chosen = accounts.filter((account) => selected.includes(account.externalId));
  const canContinue = !loading && !loadError && validDate && !busy;

  return (
    <Dialog
      open={provider !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:max-w-xl sm:p-6"
        showCloseButton={!busy}
      >
        <DialogHeader className="pr-5 text-left">
          <DialogTitle>{review ? "Revisa las cuentas" : "Elige tus cuentas"}</DialogTitle>
          <DialogDescription>
            {provider ? providerLabel(provider) : "Publicidad"} · {companyName}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="space-y-3" role="status" aria-label="Cargando cuentas">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : loadError ? (
          <Alert variant="destructive">
            <AlertDescription>
              <p>{loadError}</p>
              <Button variant="outline" size="sm" onClick={() => setAttempt((value) => value + 1)}>
                Volver a intentar
              </Button>
            </AlertDescription>
          </Alert>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No encontramos cuentas disponibles.</p>
        ) : review ? (
          <div className="space-y-3">
            {chosen.length ? (
              chosen.map((account) => (
                <div key={account.externalId} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">{account.name}</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    ID {account.externalId} · {account.currency} · {account.timeZone}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm">Las cuentas dejarán de actualizarse.</p>
            )}
            {chosen.length > 0 && (
              <p className="text-sm text-muted-foreground">Consultar desde {syncFrom}.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              {accounts.map((account, index) => (
                <Label
                  key={account.externalId}
                  htmlFor={`${id}-${index}`}
                  className="flex min-h-16 cursor-pointer items-start gap-3 rounded-lg border border-border p-3"
                >
                  <Checkbox
                    id={`${id}-${index}`}
                    className="mt-0.5 size-5"
                    checked={selected.includes(account.externalId)}
                    disabled={busy}
                    onCheckedChange={(checked) =>
                      setSelected((previous) =>
                        checked === true
                          ? [
                              ...previous.filter((value) => value !== account.externalId),
                              account.externalId,
                            ]
                          : previous.filter((value) => value !== account.externalId),
                      )
                    }
                  />
                  <span className="min-w-0 space-y-1">
                    <span className="block text-sm font-medium">{account.name}</span>
                    <span className="block break-all text-xs font-normal text-muted-foreground">
                      ID {account.externalId} · {account.currency} · {account.timeZone}
                    </span>
                  </span>
                </Label>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-from`}>Consultar desde</Label>
              <Input
                id={`${id}-from`}
                type="date"
                value={syncFrom}
                max={today}
                disabled={busy}
                aria-invalid={!validDate}
                onChange={(event) => setSyncFrom(event.target.value)}
              />
              {!validDate && <p className="text-xs text-destructive">Elige una fecha hasta hoy.</p>}
            </div>
            {initialSelectedIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Al quitar una cuenta, sus gastos anteriores siguen visibles.
              </p>
            )}
          </div>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={busy}
            onClick={review ? () => setReview(false) : onClose}
          >
            {review ? "Cambiar cuentas" : "Cancelar"}
          </Button>
          {!loading && !loadError && accounts.length > 0 && (
            <Button
              disabled={!canContinue || (selected.length === 0 && initialSelectedIds.length === 0)}
              onClick={() => {
                if (review) void onSave({ externalIds: selected, syncFrom });
                else setReview(true);
              }}
            >
              {busy
                ? "Guardando…"
                : review
                  ? "Guardar cuentas"
                  : `Continuar con ${selected.length} ${selected.length === 1 ? "cuenta" : "cuentas"}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
