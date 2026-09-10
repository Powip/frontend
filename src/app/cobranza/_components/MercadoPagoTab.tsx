"use client";

import { toast } from "sonner";
import { CheckCircle2, ExternalLink, RefreshCw, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MP_ACCOUNT, MP_COBROS_POR_CANAL, money } from "../_lib/mock-data";

/* -----------------------------------------------------------------------
   Mercado Pago — split Marketplace 99.5% negocio / 0.5% Powip (§7.1). Los
   pagos de cobranza, catálogo y upsell se acreditan solos; nada manual acá.
------------------------------------------------------------------------ */

export default function MercadoPagoTab() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sky-500 text-sm font-extrabold text-white">MP</div>
              <div>
                <div className="text-base font-bold">Cuenta conectada</div>
                <div className="text-sm text-muted-foreground">{MP_ACCOUNT.email}</div>
                <div className="text-sm text-muted-foreground">{MP_ACCOUNT.razonSocial}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="flex items-center justify-end gap-1 text-sm font-semibold text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Activa
                </div>
                <div className="text-xs text-muted-foreground">Desde: {MP_ACCOUNT.activaDesde}</div>
              </div>
            </div>

            <div>
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                Distribución automática por cada pago
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-teal-600" style={{ width: `${100 - MP_ACCOUNT.comisionPct}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[12.5px]">
                <b className="text-teal-600 dark:text-teal-400">
                  {(100 - MP_ACCOUNT.comisionPct).toFixed(1)}% → Tu cuenta MP (al instante)
                </b>
                <span className="font-semibold text-muted-foreground">{MP_ACCOUNT.comisionPct}% → Powip</span>
              </div>
            </div>

            <div className="flex gap-2.5 rounded-xl border border-green-200 bg-green-50 p-3 text-sm dark:border-green-500/30 dark:bg-green-500/10">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700 dark:text-green-300" />
              <p className="text-green-900 dark:text-green-200">
                Los pagos de cobranza, catálogo y upsell se acreditan <b>automáticamente</b> en tu cuenta MP. El{" "}
                {MP_ACCOUNT.comisionPct}% se descuenta al momento, sin acción manual.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Acciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <ActionRow label="Reconectar cuenta MP">
              <Button size="sm" variant="outline" onClick={() => toast.info("Reconectar — abre el OAuth de Mercado Pago")}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Reconectar
              </Button>
            </ActionRow>
            <ActionRow label="Desconectar (gestión manual)">
              <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => toast.warning("Esto pasa la cuenta a modo manual")}>
                <Unlink className="mr-1.5 h-3.5 w-3.5" />
                Desconectar
              </Button>
            </ActionRow>
            <ActionRow label="Ver en Mercado Pago">
              <Button size="sm" variant="outline" onClick={() => toast.info("Abrir panel de Mercado Pago")}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Ir a MP
              </Button>
            </ActionRow>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cobros este mes por canal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {MP_COBROS_POR_CANAL.map((c) => (
            <div key={c.label}>
              <div className="mb-1.5 flex justify-between text-sm font-semibold">
                <span>{c.label}</span>
                <span className="font-normal text-muted-foreground">
                  {money(c.monto)} · {c.pct}%
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${c.color}`} style={{ width: `${c.pct}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ActionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-t py-2.5 text-sm first:border-t-0">
      <span>{label}</span>
      {children}
    </div>
  );
}
