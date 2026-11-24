"use client";
/* eslint-disable @next/next/no-img-element -- logo firmado de Supabase, sin optimizador de Next */
import { useLayoutEffect, type CSSProperties } from "react";
import { liveAppearanceStyle, liveInitials, type LiveLook } from "./liveAppearance";

/**
 * Los cuadros del comprador (Mi pedido, entrega, pago Yape) se abren en un portal fuera de la página:
 * toman los colores de la apariencia desde <body> mientras la página está abierta.
 */
export function useLiveBodyLook(style: CSSProperties) {
  const key = JSON.stringify(style);
  useLayoutEffect(() => {
    const vars = JSON.parse(key) as Record<string, string>;
    for (const [name, value] of Object.entries(vars)) document.body.style.setProperty(name, value);
    return () => {
      for (const name of Object.keys(vars)) document.body.style.removeProperty(name);
    };
  }, [key]);
}

/** FEAT-33 B5: logo del negocio o, sin logo, sus iniciales sobre el color de la marca. */
export function LiveLogo({
  look,
  className = "h-10 w-10 rounded-xl text-sm",
}: {
  look: Pick<LiveLook, "displayName" | "logoUrl">;
  className?: string;
}) {
  return look.logoUrl ? (
    <span className={`grid shrink-0 place-items-center overflow-hidden bg-[var(--b-card)] ${className}`}>
      <img src={look.logoUrl} alt={`Logo de ${look.displayName}`} className="h-full w-full object-contain" />
    </span>
  ) : (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center bg-[var(--acc)] font-bold text-[var(--acc-ink)] ${className}`}
    >
      {liveInitials(look.displayName)}
    </span>
  );
}

/** Vista previa del catálogo en Configuración: cambia al instante con lo que se elige. */
export function LiveLookPreview({ look }: { look: LiveLook }) {
  return (
    <div
      data-testid="look-preview"
      data-theme={look.theme}
      style={liveAppearanceStyle(look)}
      className="w-full max-w-[300px] overflow-hidden rounded-[22px] border border-[var(--b-line)] bg-[var(--b-bg)] text-[var(--b-ink)] shadow-sm"
    >
      <div className="flex items-center gap-2.5 border-b border-[var(--b-line)] px-3.5 py-3">
        <LiveLogo look={look} />
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[15px]">{look.displayName}</b>
          <small className="flex items-center gap-1.5 text-xs text-[var(--b-mut)]">
            <i aria-hidden="true" className="inline-block h-[7px] w-[7px] rounded-full bg-[#ff4d6d]" />
            En vivo en TikTok
          </small>
        </div>
      </div>
      <div className="m-3 overflow-hidden rounded-[22px] border border-[var(--b-line)] bg-[var(--b-card)]">
        <div className="relative grid h-[110px] place-items-center bg-[var(--acc-soft)]">
          <span className="absolute left-3 top-3 rounded-lg bg-[#e2465f] px-2 py-0.5 text-[13px] font-bold text-white">
            −34% en el live
          </span>
        </div>
        <div className="space-y-2 p-3.5">
          <b className="block text-base">Polo básico</b>
          <p className="flex items-baseline gap-2">
            <b className="text-xl text-[var(--acc-tx)]">S/ 59.00</b>
            <s className="text-sm text-[var(--b-mut)]">S/ 89.00</s>
          </p>
          <div className="flex gap-2 text-sm">
            <span className="rounded-xl border-[1.5px] border-[var(--acc)] bg-[var(--acc-soft)] px-3 py-1.5 font-bold text-[var(--acc-tx)]">
              M
            </span>
            <span className="rounded-xl border-[1.5px] border-[var(--b-line)] bg-[var(--b-in)] px-3 py-1.5">L</span>
          </div>
          <span className="block rounded-[14px] bg-[var(--acc)] py-3 text-center text-[15px] font-bold text-[var(--acc-ink)]">
            Separar · S/ 59.00
          </span>
        </div>
      </div>
    </div>
  );
}
