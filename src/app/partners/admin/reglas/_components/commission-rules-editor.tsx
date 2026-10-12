"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AdminCommissionPolicyDraftCommand } from "@/features/partners/models/admin-commission-policy";
import { adminCommissionPolicyDraftCommandSchema } from "@/features/partners/schemas/admin-commission-policy.schema";

export function CommissionRulesEditor({
  onCreate,
  isPending,
}: {
  onCreate: (command: AdminCommissionPolicyDraftCommand) => void;
  isPending: boolean;
}) {
  const [values, setValues] = useState({
    code: "",
    currency: "",
    firstPaymentRate: "",
    recurringPaymentRate: "",
    recurringPaymentCount: "",
    effectiveFrom: "",
    reason: "",
  });
  const [validation, setValidation] = useState<string | null>(null);
  function field(name: keyof typeof values, value: string) {
    setValues((previous) => ({ ...previous, [name]: value }));
    setValidation(null);
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validCount =
      values.recurringPaymentCount === "" || /^[1-9]\d*$/.test(values.recurringPaymentCount);
    const result = adminCommissionPolicyDraftCommandSchema.safeParse({
      ...values,
      recurringPaymentCount:
        values.recurringPaymentCount === "" ? null : Number(values.recurringPaymentCount),
      effectiveFrom: values.effectiveFrom === "" ? null : values.effectiveFrom,
    });
    if (!validCount || !result.success) {
      setValidation(
        "Revisá el código, la moneda ISO de 3 letras, las tasas entre 0 y 1 (máximo 10 decimales), la cantidad entera positiva, la fecha ISO con zona horaria y el motivo obligatorio.",
      );
      return;
    }
    onCreate(result.data);
  }
  const fields = [
    ["code", "Código", 64],
    ["currency", "Moneda ISO", 3],
    ["firstPaymentRate", "Tasa del primer pago", 12],
    ["recurringPaymentRate", "Tasa de pagos recurrentes", 12],
    ["recurringPaymentCount", "Cantidad de pagos recurrentes (opcional)", 10],
    ["effectiveFrom", "Fecha propuesta ISO (opcional)", 40],
  ] as const;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Crear versión DRAFT</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Guardar crea un borrador. No activa comisiones ni aplica tasas a referidos o pagos.
          </p>
          <fieldset disabled={isPending} className="space-y-4">
            {fields.map(([name, label, maxLength]) => (
              <div key={name} className="space-y-1">
                <Label htmlFor={`policy-${name}`}>{label}</Label>
                <Input
                  id={`policy-${name}`}
                  type="text"
                  maxLength={maxLength}
                  value={values[name]}
                  required={name !== "recurringPaymentCount" && name !== "effectiveFrom"}
                  onChange={(event) => field(name, event.target.value)}
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Las tasas son fracciones exactas entre 0 y 1, no porcentajes. La fecha requiere zona
              horaria; dejarla vacía guarda null.
            </p>
            <div className="space-y-1">
              <Label htmlFor="policy-reason">Motivo</Label>
              <Textarea
                id="policy-reason"
                required
                maxLength={2000}
                value={values.reason}
                onChange={(event) => field("reason", event.target.value)}
              />
            </div>
            {validation && (
              <p role="alert" className="text-sm text-destructive">
                {validation}
              </p>
            )}
            <Button type="submit">{isPending ? "Guardando borrador…" : "Guardar DRAFT"}</Button>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}
