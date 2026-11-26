"use client";
import { useEffect, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCrmMe } from "@/hooks/useCrmMe";
import { useCommissions, useUpdateCommissionRule } from "@/hooks/useCrmSalesTools";
import { crmError } from "@/services/crmService";
import type { CommissionBase, CommissionRule } from "@/types/crmSalesTools";
import { NATIVE_SELECT_CLASS, formatMoney } from "./format";

const BASE_LABEL: Record<CommissionBase, string> = {
  paid: "de lo cobrado",
  total: "del total vendido",
};

function RuleEditor({ rule }: { rule: CommissionRule }) {
  const [percent, setPercent] = useState(String(rule.percent));
  const [base, setBase] = useState<CommissionBase>(rule.base);
  const save = useUpdateCommissionRule();
  useEffect(() => {
    setPercent(String(rule.percent));
    setBase(rule.base);
  }, [rule.percent, rule.base]);
  const value = Number(percent.replace(",", "."));
  const valid = percent.trim() !== "" && Number.isFinite(value) && value >= 0 && value <= 100;
  return (
    <form
      aria-label="Regla de comisión"
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) save.mutate({ percent: Math.round(value * 100) / 100, base });
      }}
    >
      <div className="w-24 space-y-1">
        <Label htmlFor="commission-percent">Porcentaje</Label>
        <Input
          id="commission-percent"
          inputMode="decimal"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          aria-invalid={!valid}
        />
      </div>
      <div className="w-44 space-y-1">
        <Label htmlFor="commission-base">Se calcula sobre</Label>
        <select
          id="commission-base"
          className={NATIVE_SELECT_CLASS}
          value={base}
          onChange={(e) => setBase(e.target.value as CommissionBase)}
        >
          <option value="paid">Lo cobrado</option>
          <option value="total">El total vendido</option>
        </select>
      </div>
      <Button type="submit" size="sm" disabled={!valid || save.isPending}>
        {save.isPending && <Loader2 className="animate-spin" />}
        Guardar regla
      </Button>
    </form>
  );
}

/** Ventas reales y comisiones por vendedora (fila 51). */
export default function CommissionsSection() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const { isSupervisor } = useCrmMe();
  const { data, isLoading, isError, error, refetch } = useCommissions(days);
  const err = isError ? crmError(error) : null;

  return (
    <section aria-label="Comisiones" className="space-y-2 rounded-md border p-3" data-testid="commissions">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Ventas y comisiones</h2>
        <div role="group" aria-label="Periodo de comisiones" className="inline-flex rounded-md border p-0.5">
          {([7, 30, 90] as const).map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={days === d ? "default" : "ghost"}
              aria-pressed={days === d}
              onClick={() => setDays(d)}
            >
              {d} días
            </Button>
          ))}
        </div>
      </div>

      {isLoading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Calculando comisiones…
        </p>
      )}
      {err && (
        <div role="alert" className="space-y-2 text-sm">
          <p className="font-medium text-destructive">{err.message}</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {data && (
        <>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground" data-testid="commission-rule">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              Regla: {data.rule.percent} % {BASE_LABEL[data.rule.base]}. Cuentan los pedidos creados desde el chat;
              los anulados no suman.{" "}
              {data.rule.isDefault ? (
                <Badge variant="outline">Por defecto: 5 % de lo cobrado</Badge>
              ) : (
                data.rule.updatedByName && <>Cambiada por {data.rule.updatedByName}.</>
              )}
            </span>
          </p>
          {isSupervisor && <RuleEditor rule={data.rule} />}
          {data.onlyMine && <p className="text-xs text-muted-foreground">Ves solo tus ventas.</p>}

          {data.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin pedidos desde el chat en este periodo.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-2 font-medium">Vendedora</th>
                    <th className="py-1 pr-2 text-right font-medium">Pedidos</th>
                    <th className="py-1 pr-2 text-right font-medium">Anulados</th>
                    <th className="py-1 pr-2 text-right font-medium">Vendido</th>
                    <th className="py-1 pr-2 text-right font-medium">Cobrado</th>
                    <th className="py-1 text-right font-medium">Comisión</th>
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((m) => (
                    <tr key={m.userId} className="border-t" data-testid="commission-row">
                      <td className="py-1.5 pr-2">{m.userName ?? "Sin nombre"}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{m.orders}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{m.cancelled}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{formatMoney(m.sold)}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{formatMoney(m.collected)}</td>
                      <td className="py-1.5 text-right font-medium tabular-nums">{formatMoney(m.commission)}</td>
                    </tr>
                  ))}
                </tbody>
                {data.totals && data.members.length > 1 && (
                  <tfoot>
                    <tr className="border-t font-medium">
                      <td className="py-1.5 pr-2">Total</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{data.totals.orders}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{data.totals.cancelled}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{formatMoney(data.totals.sold)}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{formatMoney(data.totals.collected)}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatMoney(data.totals.commission)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
