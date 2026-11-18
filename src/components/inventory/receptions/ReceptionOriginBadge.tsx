import type { ReturnReception } from "@/services/warehousesService";

/** FEAT-24 H12: logística marca de dónde viene la recepción (`devolucion` del courier o `cambio` de producto). */
export type ReceptionOrigin = "devolucion" | "cambio";

export function receptionOrigin(reception: ReturnReception): ReceptionOrigin {
  return (reception as ReturnReception & { origin?: string | null }).origin === "cambio" ? "cambio" : "devolucion";
}

/** Etiqueta del origen bajo el N° de pedido: «Cambio» (cambio de producto, H12) o «Devolución». */
export function ReceptionOriginBadge({ reception }: { reception: ReturnReception }) {
  const origin = receptionOrigin(reception);
  return (
    <span
      className={
        origin === "cambio"
          ? "mt-1 block w-fit rounded bg-sky-100 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-sky-800 dark:bg-sky-500/15 dark:text-sky-300"
          : "mt-1 block w-fit rounded bg-muted px-1.5 py-0.5 font-sans text-[11px] font-normal text-muted-foreground"
      }
    >
      {origin === "cambio" ? "Cambio" : "Devolución"}
    </span>
  );
}
