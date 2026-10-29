"use client";

import { ArrowLeft, Check, Info, Link2, Pause, ShieldCheck } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  type AdvertisingAccount,
  type AdvertisingProvider,
  providerLabel,
} from "./advertising-model";

export interface AdvertisingConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: AdvertisingProvider;
  companyName: string;
  accounts: AdvertisingAccount[];
  enabledAccountIds: string[];
  mode: "connect" | "manage" | "reconnect";
  onConfirm: (ids: string[]) => void;
  isDemo: boolean;
}

type ConnectionStep = "intro" | "authorize" | "accounts" | "review" | "cancelled" | "no-accounts";
type AuthorizationOutcome = "success" | "cancel" | "no-accounts";

const actionClassName = "min-h-11 w-full whitespace-normal sm:w-auto";

function ConnectionFlow({
  provider,
  companyName,
  accounts,
  enabledAccountIds,
  mode,
  onConfirm,
  onOpenChange,
  isDemo,
}: Omit<AdvertisingConnectionDialogProps, "open">) {
  const id = useId();
  const availableAccounts = useMemo(
    () => accounts.filter((account) => account.provider === provider),
    [accounts, provider],
  );
  const [step, setStep] = useState<ConnectionStep>(mode === "manage" ? "accounts" : "intro");
  const [outcome, setOutcome] = useState<AuthorizationOutcome>("success");
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const previousStep = useRef(step);
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    mode === "connect"
      ? []
      : enabledAccountIds.filter((accountId) =>
          availableAccounts.some((account) => account.id === accountId),
        ),
  );
  const selectedAccounts = availableAccounts.filter((account) => selectedIds.includes(account.id));
  const pausedAccounts = availableAccounts.filter(
    (account) => enabledAccountIds.includes(account.id) && !selectedIds.includes(account.id),
  );
  const name = providerLabel(provider);
  const isPause = mode === "manage" && selectedAccounts.length === 0;
  const canContinue = selectedAccounts.length > 0 || mode === "manage";
  const close = () => onOpenChange(false);

  useEffect(() => {
    if (previousStep.current !== step) titleRef.current?.focus();
    previousStep.current = step;
  }, [step]);

  if (!isDemo) {
    return (
      <>
        <DialogHeader className="pr-5 text-left">
          <Badge variant="secondary">Próximamente</Badge>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>
            La conexión estará disponible cuando se habilite la integración.
          </DialogDescription>
        </DialogHeader>
        <p className="break-words text-sm text-muted-foreground">Empresa: {companyName}</p>
        <DialogFooter>
          <Button onClick={close} className={actionClassName}>
            Cerrar
          </Button>
        </DialogFooter>
      </>
    );
  }

  const titles: Record<ConnectionStep, string> = {
    intro: `${mode === "reconnect" ? "Reconectar" : "Conectar"} ${name}`,
    authorize: "Permitir consulta de gastos",
    accounts: "Elige tus cuentas",
    review: isPause ? "Pausar actualizaciones" : "Revisa la selección",
    cancelled: "Autorización cancelada",
    "no-accounts": "Sin cuentas disponibles",
  };

  function simulateAuthorization() {
    if (outcome === "cancel") {
      setStep("cancelled");
    } else if (outcome === "no-accounts" || availableAccounts.length === 0) {
      setStep("no-accounts");
    } else {
      setStep("accounts");
    }
  }

  return (
    <>
      <DialogHeader className="pr-5 text-left">
        <Badge variant="secondary" className="gap-1">
          <Info aria-hidden="true" />
          Simulación
        </Badge>
        <DialogTitle ref={titleRef} tabIndex={-1} className="leading-snug">
          {titles[step]}
        </DialogTitle>
        <DialogDescription className="break-words">
          {companyName} · {name}
        </DialogDescription>
      </DialogHeader>
      {step === "intro" && (
        <>
          <Card className="gap-0 py-4 shadow-none">
            <CardContent className="flex items-start gap-3 px-4">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">Sólo consulta</p>
                <p className="text-sm text-muted-foreground">
                  Powip consultará el gasto de las cuentas que elijas.
                </p>
              </div>
            </CardContent>
          </Card>
          <DialogFooter>
            <Button variant="outline" onClick={close} className={actionClassName}>
              Cancelar
            </Button>
            <Button onClick={() => setStep("authorize")} className={actionClassName}>
              <Link2 aria-hidden="true" />
              Continuar
            </Button>
          </DialogFooter>
        </>
      )}

      {step === "authorize" && (
        <>
          <div className="space-y-2">
            <Label htmlFor={`${id}-outcome`}>Resultado de la prueba</Label>
            <Select
              value={outcome}
              onValueChange={(value) => setOutcome(value as AuthorizationOutcome)}
            >
              <SelectTrigger id={`${id}-outcome`} className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="success">Acceso autorizado</SelectItem>
                <SelectItem value="cancel">Autorización cancelada</SelectItem>
                <SelectItem value="no-accounts">Sin cuentas disponibles</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep("intro")} className={actionClassName}>
              <ArrowLeft aria-hidden="true" />
              Volver
            </Button>
            <Button onClick={simulateAuthorization} className={actionClassName}>
              Simular autorización
            </Button>
          </DialogFooter>
        </>
      )}

      {(step === "cancelled" || step === "no-accounts") && (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            {step === "cancelled"
              ? "No se autorizó el acceso. Puedes volver a intentarlo."
              : "Prueba con un usuario que tenga acceso a las cuentas publicitarias."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={close} className={actionClassName}>
              Cerrar
            </Button>
            <Button onClick={() => setStep("authorize")} className={actionClassName}>
              Volver a intentar
            </Button>
          </DialogFooter>
        </>
      )}

      {step === "accounts" && (
        <>
          <div className="space-y-2">
            {availableAccounts.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay cuentas disponibles para esta plataforma.
              </p>
            )}
            {availableAccounts.map((account) => (
              <div key={account.id} className="flex items-start gap-3 rounded-lg border p-3">
                <Checkbox
                  id={`${id}-${account.id}`}
                  checked={selectedIds.includes(account.id)}
                  className="mt-1 size-5"
                  onCheckedChange={(checked) =>
                    setSelectedIds((current) =>
                      checked === true
                        ? [...current.filter((accountId) => accountId !== account.id), account.id]
                        : current.filter((accountId) => accountId !== account.id),
                    )
                  }
                />
                <Label
                  htmlFor={`${id}-${account.id}`}
                  className="min-h-11 min-w-0 flex-1 cursor-pointer items-start"
                >
                  <span className="min-w-0 space-y-1">
                    <span className="block break-words font-medium">{account.name}</span>
                    <span className="block break-all text-xs font-normal text-muted-foreground">
                      ID {account.externalId} · {account.currency}
                    </span>
                    <span className="block break-words text-xs font-normal text-muted-foreground">
                      {account.timeZone}
                    </span>
                  </span>
                </Label>
              </div>
            ))}
          </div>
          {mode === "manage" && (
            <p className="text-sm text-muted-foreground">
              Si desmarcas una cuenta, dejará de actualizarse. Los gastos anteriores seguirán
              visibles.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={close} className={actionClassName}>
              Cancelar
            </Button>
            <Button
              onClick={() => setStep("review")}
              disabled={!canContinue}
              className={actionClassName}
            >
              {isPause
                ? "Revisar pausa"
                : `Continuar con ${selectedAccounts.length} ${selectedAccounts.length === 1 ? "cuenta" : "cuentas"}`}
            </Button>
          </DialogFooter>
        </>
      )}

      {step === "review" && (
        <>
          <div className="space-y-3">
            {selectedAccounts.map((account) => (
              <div key={account.id} className="flex items-start gap-2 rounded-lg border p-3">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium">{account.name}</p>
                  <p className="break-all text-xs text-muted-foreground">
                    ID {account.externalId} · {account.currency} · {account.timeZone}
                  </p>
                </div>
              </div>
            ))}
            {mode === "manage" && pausedAccounts.length > 0 && (
              <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <Pause className="size-4" aria-hidden="true" />
                  {isPause ? "Se pausará esta plataforma" : "Cuentas que dejarán de actualizarse"}
                </p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {pausedAccounts.map((account) => (
                    <li key={account.id} className="break-words">
                      {account.name}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-muted-foreground">
                  Los gastos anteriores seguirán visibles.
                </p>
              </div>
            )}
            {isPause && pausedAccounts.length === 0 && (
              <p className="text-sm text-muted-foreground">No habrá cuentas actualizándose.</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStep("accounts")}
              className={actionClassName}
            >
              Cambiar cuentas
            </Button>
            <Button
              disabled={!canContinue}
              onClick={() => {
                onConfirm(selectedAccounts.map((account) => account.id));
                close();
              }}
              className={actionClassName}
            >
              {isPause
                ? "Simular pausa"
                : mode === "manage"
                  ? "Guardar selección"
                  : "Simular importación"}
            </Button>
          </DialogFooter>
        </>
      )}
    </>
  );
}

export function AdvertisingConnectionDialog(props: AdvertisingConnectionDialogProps) {
  const opener = useRef<HTMLElement | null>(null);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
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
        {props.open && (
          <ConnectionFlow key={`${props.provider}:${props.companyName}:${props.mode}`} {...props} />
        )}
      </DialogContent>
    </Dialog>
  );
}
