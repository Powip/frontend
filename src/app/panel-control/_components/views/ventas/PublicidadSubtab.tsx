"use client";

import { Megaphone } from "lucide-react";
import { PanelCard } from "@/components/panel-control/PanelCard";

/**
 * Publicidad no tiene cifras todavía: la pauta se conectará con Meta y TikTok Ads. Hasta
 * entonces la pantalla lo dice sin mostrar ningún número (ni demo ni estimado) y la ganancia de
 * Resultado y Canales se rotula «antes de publicidad».
 */
export function PublicidadSubtab() {
  return (
    <PanelCard titulo="Publicidad" subtitulo="Inversión, retorno y costo por venta de la pauta">
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <Megaphone aria-hidden className="size-8 text-pc-text-soft" />
        <p className="text-sm font-semibold text-pc-text">
          Próximamente: se conectará con Meta/TikTok Ads
        </p>
        <p className="max-w-md text-xs text-pc-text-muted">
          Mientras tanto la ganancia que ves en el panel es «antes de publicidad»: no resta ninguna
          pauta.
        </p>
      </div>
    </PanelCard>
  );
}
