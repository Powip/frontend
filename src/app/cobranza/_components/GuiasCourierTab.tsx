"use client";

import { toast } from "sonner";
import { Info, Link2, Printer, Tag, Truck, FileSpreadsheet, MessageCircle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GUIA_ACTIVA, GUIA_PEDIDOS, money } from "../_lib/mock-data";

/* -----------------------------------------------------------------------
   Guías & Courier — la bisagra del Hito 1. Al "Registrar en Shalom" nace el
   link del repartidor, arranca el tracking y se imprime la guía (§7.4 de la
   especificación). Acciones sin backend real todavía → solo feedback visual.
------------------------------------------------------------------------ */

function notImplemented(label: string) {
  toast.info(`${label} — pendiente de integración con el courier`);
}

export default function GuiasCourierTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-500/30 dark:bg-blue-500/10">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700 dark:text-blue-300" />
          <p className="text-blue-900 dark:text-blue-200">
            Al <b>Registrar en Shalom</b> se crea la guía en su sistema, nace el <b>link del repartidor</b> de esta
            guía y empieza a llegar el <b>tracking de estados</b> por API.
          </p>
        </div>
        <Button size="sm" className="shrink-0 gap-1.5 bg-teal-600 text-white hover:bg-teal-700" onClick={() => notImplemented("Nueva guía")}>
          <Package className="h-4 w-4" />
          Nueva guía
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-base font-bold">{GUIA_ACTIVA.codigo}</div>
              <div className="text-xs text-muted-foreground">Creada {GUIA_ACTIVA.creada}</div>
            </div>
            <Badge className="border bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30">
              {GUIA_ACTIVA.estado}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <GuiaMeta label="Zona" value={GUIA_ACTIVA.zona} />
            <GuiaMeta label="Pedidos" value={String(GUIA_ACTIVA.pedidos)} />
            <GuiaMeta label="Cobranza total" value={money(GUIA_ACTIVA.cobranzaTotal)} className="text-red-600 dark:text-red-400" />
            <GuiaMeta label="Pendiente pago" value={money(GUIA_ACTIVA.pendientePago)} className="text-amber-600 dark:text-amber-400" />
          </div>

          <div className="flex items-center gap-3 rounded-xl border p-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-teal-600 dark:text-teal-400">
              <Truck className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">{GUIA_ACTIVA.courier}</div>
              <div className="text-xs text-muted-foreground">{GUIA_ACTIVA.tipoCobro}</div>
            </div>
            <Badge
              variant="outline"
              className="ml-auto border-green-200 bg-green-100 text-green-700 dark:border-green-500/30 dark:bg-green-500/15 dark:text-green-300"
            >
              Asignado
            </Badge>
          </div>

          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Cobrar</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {GUIA_PEDIDOS.map((o) => (
                  <TableRow key={o.orden}>
                    <TableCell>
                      <div className="text-sm font-medium">{o.orden}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.cliente} · {o.ciudad}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{money(o.total)}</TableCell>
                    <TableCell className={o.cobrar ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"}>
                      {o.cobrar ? money(o.cobrar) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className="border bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30">
                        Entregado
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-1.5 bg-teal-600 text-white hover:bg-teal-700" onClick={() => notImplemented("Registrar en Shalom")}>
              <Truck className="h-4 w-4" />
              Registrar en Shalom ({GUIA_PEDIDOS.length})
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => notImplemented("Exportar Excel")}>
              <FileSpreadsheet className="h-4 w-4" />
              Exportar Excel
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => notImplemented("Imprimir guía")}>
              <Printer className="h-4 w-4" />
              Imprimir guía
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => notImplemented("Imprimir etiqueta")}>
              <Tag className="h-4 w-4" />
              Imprimir etiqueta
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => notImplemented("WhatsApp masivo")}>
              <MessageCircle className="h-4 w-4" />
              WhatsApp masivo
            </Button>
          </div>

          <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
              <Link2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{GUIA_ACTIVA.linkRepartidor}</div>
              <div className="text-xs text-muted-foreground">Link del repartidor · se desactiva al terminar la entrega</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GuiaMeta({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-base font-bold ${className ?? ""}`}>{value}</div>
    </div>
  );
}
