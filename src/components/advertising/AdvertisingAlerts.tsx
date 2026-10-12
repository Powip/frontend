"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  AdvertisingRule,
  AdvertisingRulePayload,
  AdvertisingWorkspace,
} from "@/services/advertisingWorkspaceService";
import { useAdvertisingStoreFilter } from "./AdvertisingStoreFilterContext";
import { formatMetaSpend } from "./advertising-meta-model";
import { advertisingSectionHref } from "./advertising-sections";
import { advertisingInputDecimal } from "./advertising-workspace-model";

interface Props {
  workspace: AdvertisingWorkspace;
  busy: boolean;
  onSave: (ruleId: string | null, payload: AdvertisingRulePayload) => Promise<boolean>;
  onEvaluate: () => Promise<boolean>;
}
export function AdvertisingAlerts({ workspace, busy, onSave, onEvaluate }: Props) {
  const id = useId();
  const { storeId } = useAdvertisingStoreFilter();
  const [ruleId, setRuleId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState("all");
  const [currency, setCurrency] = useState("");
  const [threshold, setThreshold] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canConfigure = workspace.capabilities.canConfigure;
  const currencies = [...new Set(workspace.accounts.map((account) => account.currency))];
  function edit(rule: AdvertisingRule | null) {
    setRuleId(rule?.id ?? null);
    setVersion(rule?.version ?? 0);
    setName(rule?.name ?? "");
    setAccountId(rule?.accountId ?? "all");
    setCurrency(rule?.currency ?? "");
    setThreshold(rule?.threshold ?? "");
    setEnabled(rule?.enabled ?? true);
    setError(null);
  }
  async function save() {
    if (!canConfigure || busy) return;
    const amount = advertisingInputDecimal(threshold);
    if (!name.trim() || !currency || amount === null || !/^\d{1,18}(?:\.\d{1,12})?$/.test(amount)) {
      setError("Escribe el nombre, elige la moneda y un límite de gasto válido.");
      return;
    }
    setError(null);
    const saved = await onSave(ruleId, {
      name: name.trim(),
      accountId: accountId === "all" ? null : accountId,
      currency,
      threshold: amount,
      enabled,
      expectedVersion: version,
    });
    if (saved) edit(null);
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Avisos sobre conexión, cobertura y límites de gasto. Las reglas generan alertas; no
          cambian anuncios.
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={!canConfigure || busy}
          onClick={() => void onEvaluate()}
        >
          Evaluar periodo
        </Button>
      </div>
      {!canConfigure ? (
        <p className="text-xs text-muted-foreground">
          Necesitas permiso para configurar reglas y guardar evaluaciones.
        </p>
      ) : null}
      <section className="space-y-3" aria-label="Alertas del periodo">
        {workspace.alerts.length ? (
          workspace.alerts.map((item) => (
            <Alert key={item.id}>
              <AlertTitle>{item.title}</AlertTitle>
              <AlertDescription>
                {item.message}
                {item.amount !== null && item.currency ? (
                  <p className="mt-2 font-mono tabular-nums">
                    {item.amountSource === "meta-imported" ? "Gasto importado de Meta: " : ""}
                    {formatMetaSpend(item.amount, item.currency)}
                  </p>
                ) : null}
                {item.kind === "unassigned-store" ? (
                  <Button size="sm" variant="outline" asChild className="mt-2">
                    <Link
                      href={advertisingSectionHref(
                        "/publicidad/asignaciones",
                        workspace.from,
                        workspace.to,
                        { accountId: item.accountId, storeId },
                      )}
                    >
                      Asignar tienda
                    </Link>
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ))
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No hay alertas para este periodo. Revisa la cobertura antes de interpretar los
                resultados.
              </p>
            </CardContent>
          </Card>
        )}
      </section>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reglas de gasto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {workspace.rules.length ? (
            workspace.rules.map((rule) => (
              <div
                key={rule.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {rule.name}{" "}
                    <Badge variant="outline">{rule.enabled ? "Activa" : "Pausada"}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {rule.accountId
                      ? (workspace.accounts.find((account) => account.id === rule.accountId)
                          ?.name ?? "Cuenta")
                      : "Todas las cuentas"}{" "}
                    · Al alcanzar {formatMetaSpend(rule.threshold, rule.currency)} · Versión{" "}
                    {rule.version}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canConfigure || busy}
                  onClick={() => edit(rule)}
                >
                  Editar regla
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Aún no hay reglas guardadas.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{ruleId ? "Editar regla" : "Nueva regla"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
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
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-account`}>Cuenta</Label>
                  <Select
                    value={accountId}
                    onValueChange={(value) => {
                      setAccountId(value);
                      const account = workspace.accounts.find((item) => item.id === value);
                      if (account) setCurrency(account.currency);
                    }}
                    disabled={!canConfigure || busy}
                  >
                    <SelectTrigger id={`${id}-account`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las cuentas</SelectItem>
                      {workspace.accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-currency`}>Moneda</Label>
                  <Select
                    value={currency}
                    onValueChange={setCurrency}
                    disabled={!canConfigure || busy || accountId !== "all"}
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
                  <Label htmlFor={`${id}-threshold`}>Límite de gasto</Label>
                  <Input
                    id={`${id}-threshold`}
                    inputMode="decimal"
                    value={threshold}
                    onChange={(event) => setThreshold(event.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`${id}-enabled`}
                  checked={enabled}
                  disabled={!canConfigure || busy}
                  onCheckedChange={(value) => setEnabled(value === true)}
                />
                <Label htmlFor={`${id}-enabled`}>Regla activa</Label>
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!canConfigure || busy || !workspace.accounts.length}
                >
                  Guardar regla
                </Button>
                {ruleId ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => edit(null)}>
                    Cancelar edición
                  </Button>
                ) : null}
              </div>
            </fieldset>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
