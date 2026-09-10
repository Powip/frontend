"use client";

import { Bike, Lock, MapPin, Store } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FLOTA_REPARTIDORES } from "../_lib/mock-data";

/* -----------------------------------------------------------------------
   Mapa de flota — GPS del motorizado propio, SOLO visible para el negocio
   (regla §10.5). Nunca se expone en el link del cliente. Shalom no da GPS:
   aparece a nivel de estados en la fila de flota, sin pin en el mapa.
------------------------------------------------------------------------ */

const PINS = [
  { label: "Almacén Jook", left: "20%", top: "74%", origin: true, icon: <Store className="h-4 w-4" /> },
  { label: "Luis · 3 rest.", left: "56%", top: "36%", color: "bg-violet-600", icon: <Bike className="h-4 w-4" /> },
  { label: "Ana · 3 rest.", left: "76%", top: "62%", color: "bg-teal-600", icon: <Bike className="h-4 w-4" /> },
];

export default function MapaFlotaTab() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
        <p className="text-amber-900 dark:text-amber-200">
          <b>Solo tú ves esto.</b> La ubicación del motorizado no aparece en el link del cliente — el cliente ve su
          línea de estados y el ETA, no el punto GPS.
        </p>
      </div>

      <div className="relative h-[320px] overflow-hidden rounded-xl border bg-muted/40">
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          En vivo · actualizado hace 12 s
        </div>
        {PINS.map((p) => (
          <div key={p.label} className="absolute -translate-x-1/2 -translate-y-full text-center" style={{ left: p.left, top: p.top }}>
            <div
              className={`mx-auto grid h-8 w-8 place-items-center text-white shadow-md ${p.origin ? "rounded-lg bg-slate-700" : `rounded-full ${p.color}`}`}
            >
              {p.icon}
            </div>
            <div className="mt-1.5 whitespace-nowrap rounded-md border bg-card px-2 py-0.5 text-[11px] font-semibold shadow-sm">{p.label}</div>
          </div>
        ))}
      </div>

      <Card className="py-1">
        <CardContent className="divide-y">
          {FLOTA_REPARTIDORES.map((r) => (
            <div key={r.nombre} className="flex items-center gap-3 py-3 first:pt-4 last:pb-4">
              <div
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: r.color }}
              >
                {r.iniciales}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold">{r.nombre}</div>
                <div className="truncate text-xs text-muted-foreground">{r.detalle}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-sm font-semibold">{r.totalPedidos > 0 ? `${r.entregados} / ${r.totalPedidos} entregados` : "Guía activa"}</div>
                <div className="flex items-center justify-end gap-1 text-[11px] font-medium text-green-600 dark:text-green-400">
                  {r.conGps ? (
                    <>
                      <MapPin className="h-3 w-3" />
                      {r.ultimaActualizacion}
                    </>
                  ) : (
                    <span className="text-muted-foreground">{r.ultimaActualizacion}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
