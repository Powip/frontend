"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AdvertisingPlanPayload,
  AdvertisingWorkspace,
} from "@/services/advertisingWorkspaceService";
import { formatMetaSpend, validMetaPeriod } from "./advertising-meta-model";
import {
  advertisingBasisPoints,
  advertisingInputDecimal,
  advertisingSharePercent,
} from "./advertising-workspace-model";

interface Props {
  workspace: AdvertisingWorkspace;
  busy: boolean;
  onSave: (payload: AdvertisingPlanPayload) => Promise<boolean>;
}
export function AdvertisingPlanner({ workspace, busy, onSave }: Props) {
  const id = useId();
  const nextKey = useRef(0);
  const [name, setName] = useState("");
  const [from, setFrom] = useState(workspace.from);
  const [to, setTo] = useState(workspace.to);
  const [currency, setCurrency] = useState("");
  const [budget, setBudget] = useState("");
  const [targets, setTargets] = useState<
    Array<{ key: string; accountId: string; percent: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const canConfigure = workspace.capabilities.canConfigure;
  const currencies = [...new Set(workspace.accounts.map((account) => account.currency))];
  const accounts = workspace.accounts.filter((account) => account.currency === currency);
  async function save() {
    if (!canConfigure || busy) return;
    const amount = advertisingInputDecimal(budget);
    const parsed = targets.map((target) => ({
      accountId: target.accountId,
      basisPoints: advertisingBasisPoints(target.percent),
    }));
    if (
      !name.trim() ||
      !currency ||
      amount === null ||
      !/^\d{1,18}(?:\.\d{1,12})?$/.test(amount) ||
      !validMetaPeriod(from, to)
    ) {
      setError("Escribe el nombre, la moneda, el presupuesto y un periodo de hasta 366 días.");
      return;
    }
    if (
      !parsed.length ||
      parsed.some(
        (target) =>
          !accounts.some((account) => account.id === target.accountId) ||
          target.basisPoints === null,
      ) ||
      new Set(parsed.map((target) => target.accountId)).size !== parsed.length ||
      parsed.reduce((sum, target) => sum + (target.basisPoints ?? 0), 0) !== 10_000
    ) {
      setError("Elige cuentas de la misma moneda, sin repetirlas, y reparte exactamente el 100 %.");
      return;
    }
    setError(null);
    const saved = await onSave({
      name: name.trim(),
      from,
      to,
      currency,
      budget: amount,
      targets: parsed.map((target) => ({ ...target, basisPoints: target.basisPoints ?? 0 })),
    });
    if (saved) {
      setName("");
      setBudget("");
      setTargets([]);
    }
  }
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Distribuye un presupuesto entre tus cuentas. El escenario se guarda en Powip; no modifica
        campañas ni predice ventas.
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nuevo escenario</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <fieldset disabled={!canConfigure || busy} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-name`}>Nombre</Label>
                <Input
                  id={`${id}-name`}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={140}
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-from`}>Desde</Label>
                  <Input
                    id={`${id}-from`}
                    type="date"
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-to`}>Hasta</Label>
                  <Input
                    id={`${id}-to`}
                    type="date"
                    min={from}
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-currency`}>Moneda</Label>
                  <Select
                    value={currency}
                    onValueChange={(value) => {
                      setCurrency(value);
                      setTargets([]);
                    }}
                    disabled={!canConfigure || busy}
                  >
                    <SelectTrigger id={`${id}-currency`} className="w-full">
                      <SelectValue placeholder="Elige moneda" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-budget`}>Presupuesto total</Label>
                  <Input
                    id={`${id}-budget`}
                    inputMode="decimal"
                    value={budget}
                    onChange={(event) => setBudget(event.target.value)}
                    required
                  />
                </div>
              </div>
              {targets.map((target, index) => (
                <div
                  key={target.key}
                  className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_140px_auto]"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor={`${id}-account-${index}`}>Cuenta Meta</Label>
                    <Select
                      value={target.accountId}
                      onValueChange={(value) =>
                        setTargets((items) =>
                          items.map((item, position) =>
                            position === index ? { ...item, accountId: value } : item,
                          ),
                        )
                      }
                      disabled={!canConfigure || busy}
                    >
                      <SelectTrigger id={`${id}-account-${index}`} className="w-full">
                        <SelectValue placeholder="Elige una cuenta" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${id}-share-${index}`}>Porcentaje</Label>
                    <Input
                      id={`${id}-share-${index}`}
                      inputMode="decimal"
                      value={target.percent}
                      onChange={(event) =>
                        setTargets((items) =>
                          items.map((item, position) =>
                            position === index ? { ...item, percent: event.target.value } : item,
                          ),
                        )
                      }
                      required
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="self-end"
                    aria-label={`Quitar cuenta ${index + 1}`}
                    onClick={() =>
                      setTargets((items) => items.filter((_, position) => position !== index))
                    }
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!currency || !accounts.length || targets.length >= 50}
                onClick={() => {
                  const key = `${id}-new-${nextKey.current++}`;
                  setTargets((items) => [
                    ...items,
                    { key, accountId: "", percent: items.length ? "" : "100" },
                  ]);
                }}
              >
                <Plus aria-hidden="true" />
                Añadir cuenta
              </Button>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!canConfigure || busy || !workspace.accounts.length}
                >
                  Guardar escenario
                </Button>
              </div>
            </fieldset>
          </form>
          {!canConfigure ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Necesitas permiso para guardar escenarios de presupuesto.
            </p>
          ) : null}
          {!workspace.accounts.length ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Elige cuentas en Conexiones para preparar un escenario.
            </p>
          ) : null}
        </CardContent>
      </Card>
      <section className="space-y-3" aria-label="Escenarios guardados">
        <h3 className="text-base font-semibold">Escenarios guardados</h3>
        {workspace.plans.length ? (
          workspace.plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {plan.name}
                  <Badge variant="outline">Escenario</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {plan.from} al {plan.to} · {plan.currency}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Presupuesto total</p>
                    <p className="font-mono font-semibold tabular-nums">
                      {formatMetaSpend(plan.budget, plan.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Promedio diario</p>
                    <p className="font-mono font-semibold tabular-nums">
                      {formatMetaSpend(plan.dailyBudget, plan.currency)}
                    </p>
                  </div>
                </div>
                {plan.allocations.map((allocation) => (
                  <div
                    key={allocation.accountId}
                    className="flex flex-wrap justify-between gap-2 border-t border-border pt-2 text-sm"
                  >
                    <span>
                      {workspace.accounts.find((account) => account.id === allocation.accountId)
                        ?.name ?? "Cuenta"}{" "}
                      ·{" "}
                      {advertisingSharePercent(
                        plan.targets.find((target) => target.accountId === allocation.accountId)
                          ?.basisPoints ?? 0,
                      )}{" "}
                      %
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatMetaSpend(allocation.amount, plan.currency)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Aún no hay escenarios guardados.</p>
        )}
      </section>
    </div>
  );
}
