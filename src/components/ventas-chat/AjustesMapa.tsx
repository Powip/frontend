"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Secciones de Ajustes en el orden del mockup 152. El `id` es el ancla de cada bloque. */
export const AJUSTES_SECCIONES = [
  { id: "aj-plan", label: "Tu plan", text: "Precio, vendedoras incluidas y Pau." },
  { id: "aj-canales", label: "Canales y cuentas", text: "WhatsApp, Instagram, Messenger y TikTok por tienda." },
  { id: "aj-atencion", label: "Atención", text: "SLA, horario, bienvenida y reparto de chats." },
  { id: "aj-equipo", label: "Equipo y tiendas", text: "Qué tiendas atiende cada persona, contra entrega y a quién se cuenta la venta." },
  { id: "aj-pagos", label: "Pagos y cobros", text: "Política de pago por tienda, métodos de cobro y agencias." },
  { id: "aj-privacidad", label: "Privacidad y comentarios", text: "Teléfono oculto y respuestas a comentarios." },
  { id: "aj-llamadas", label: "Llamadas", text: "Horario y reglas para llamar por WhatsApp." },
  { id: "aj-datos", label: "Datos y anuncios", text: "Descargar base, Conversions API, públicos y resultados." },
] as const;

/** Mapa de configuración arriba de Ajustes (J1): «Ir» a cada sección y «Ver todo». */
export function AjustesMapa() {
  const [all, setAll] = useState(false);
  const list = all ? AJUSTES_SECCIONES : AJUSTES_SECCIONES.slice(0, 3);
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <section aria-labelledby="aj-mapa-title" className="space-y-3 rounded-lg border bg-card p-4" data-testid="ajustes-mapa">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 id="aj-mapa-title" className="text-sm font-semibold">
            Mapa de configuración
          </h2>
          <p className="text-xs text-muted-foreground">Todo lo que se configura del CRM, en un solo lugar.</p>
        </div>
        <Button type="button" size="sm" variant="outline" aria-expanded={all} onClick={() => setAll((v) => !v)}>
          {all ? "Ver menos" : "Ver todo"}
        </Button>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((s) => (
          <li key={s.id} className="flex items-center gap-2 rounded-md border p-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.text}</p>
            </div>
            <Button
              type="button"
              size="sm"
              className="bg-[#4C2FB5] text-white hover:bg-[#4C2FB5]/90"
              aria-label={`Ir a ${s.label}`}
              onClick={() => go(s.id)}
            >
              Ir
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** «Por qué POWIP y no un bot» (J12). */
export function PorQuePowip() {
  return (
    <section aria-labelledby="aj-porque-title" className="space-y-2 rounded-lg border bg-[#4C2FB5]/5 p-4">
      <h2 id="aj-porque-title" className="text-sm font-semibold">
        Por qué POWIP y no un bot
      </h2>
      <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        <li>Las vendedoras siguen al mando: Pau sugiere y responde lo simple, la venta la cierra una persona.</li>
        <li>El chat está unido a tu tienda: stock, precios, pedidos, pagos y envíos salen de POWIP Core.</li>
        <li>Cada venta queda atribuida al chat, la vendedora, la difusión o el anuncio que la trajo.</li>
        <li>Seguimientos con límites y horario: nadie recibe mensajes de más ni fuera de hora.</li>
      </ul>
    </section>
  );
}
