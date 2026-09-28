"use client";

import { EstadoBadge } from "@/components/panel-control/EstadoBadge";
import { PanelCard } from "@/components/panel-control/PanelCard";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import { ESTADOS_PANEL_DEFINICION } from "@/features/panel-control/shared/config/estados.config";
import { GLOSARIO, GLOSARIO_IDS } from "@/features/panel-control/shared/config/glosario.config";
import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import type { EstadoPanel } from "@/features/panel-control/shared/models/estado-pedido.model";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { formatNumber } from "@/features/panel-control/shared/utils/format";
import { ContractBlock } from "../ventas/ContractBlock";

const FLUJO: { titulo: string; estados: EstadoPanel[] }[] = [
  { titulo: "Lead (todavía no es venta)", estados: ["PENDIENTE", "ANULADO"] },
  { titulo: "Venta en curso", estados: ["LLAMADO", "PREPARADO", "CON_GUIA", "EN_ENVIO"] },
  { titulo: "Cierre", estados: ["ENTREGADO", "PAGADO", "RECHAZADO"] },
];

const REGLAS = [
  "Atribución: la venta es del canal de origen. Si un lead de TikTok se cierra por WhatsApp, cuenta para TikTok; el canal de cierre es solo informativo y nunca suma dos veces.",
  "Dos relojes: Resultado cuenta cada pedido en su fecha de ingreso; Caja cuenta el dinero en la fecha en que entró o salió.",
  "Comparación a la misma antigüedad: el periodo anterior se evalúa como estaba hace el mismo número de días, no terminado.",
  "Hora de corte: 00:00 hora Lima (UTC−5). Un live que pasa de medianoche cuenta en la sesión en que empezó.",
  "Duplicados: mismo teléfono y producto en menos de 24 h se anulan con motivo «Duplicado».",
  "Venta neta: precio − descuentos − cupones. Nunca margen sobre precio de lista.",
  "Devoluciones restan en el canal de la venta. En prepago, un rechazo es reembolso.",
  "Adelantos: son caja, no ingreso, hasta que el pedido se entrega.",
  "Stock único para todos los canales: se reserva en LLAMADO y se descuenta al pasar a EN_ENVIO (POS descuenta al cobrar).",
  "Pauta general: se reparte entre canales que la reciben según su facturación del periodo y se marca como estimada.",
  "Semáforos: ✓ solo si se cumple la meta configurada. Nunca verde por defecto.",
  "Productos sin costo: margen «—», nunca 0 % ni 100 %.",
];

export function ConfigEstadosView() {
  const { view, openDrilldown } = usePanel();
  const state = usePanelContract("config-estados", view.access === "permitido" ? view.query : null);

  return (
    <div className="space-y-3.5">
      <ContractBlock
        state={state}
        titulo="Máquina de estados"
        subtitulo="Pedidos ingresados en el periodo según su estado actual. Cada número abre esos pedidos."
      >
        {(data) => {
          const conteo = new Map(data.conteoActual.map((fila) => [fila.estado, fila.pedidos]));
          const total = data.conteoActual.reduce((suma, fila) => suma + fila.pedidos, 0);
          return (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {FLUJO.map((etapa) => (
                  <section
                    key={etapa.titulo}
                    aria-label={etapa.titulo}
                    className="rounded-xl border border-pc-border-soft p-3"
                  >
                    <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-pc-text-muted">
                      {etapa.titulo}
                    </h4>
                    <ul className="space-y-2">
                      {etapa.estados.map((estado) => {
                        const definicion = ESTADOS_PANEL_DEFINICION[estado];
                        const pedidos = conteo.get(estado) ?? 0;
                        return (
                          <li
                            key={estado}
                            className="flex items-start justify-between gap-2 text-xs"
                          >
                            <span className="min-w-0">
                              <EstadoBadge estado={estado} />
                              <span className="mt-0.5 block text-pc-text-muted">
                                {definicion.descripcion}
                              </span>
                            </span>
                            <button
                              type="button"
                              disabled={!pedidos}
                              onClick={() =>
                                openDrilldown(
                                  grupos.de("pedidos", `Pedidos en ${definicion.etiqueta}`, {
                                    estado,
                                  }),
                                )
                              }
                              aria-label={`${definicion.etiqueta}: ${formatNumber(pedidos)} pedidos. Ver pedidos`}
                              className="rounded font-semibold tabular-nums text-pc-primary underline decoration-dotted outline-none focus-visible:ring-2 focus-visible:ring-pc-primary disabled:text-pc-text-soft disabled:no-underline"
                            >
                              {formatNumber(pedidos)}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
              <p className="text-xs text-pc-text-muted">
                Σ pedidos por estado = {formatNumber(total)} pedidos ingresados (cuadre 7). Es venta
                desde LLAMADO; PENDIENTE y ANULADO no suman a la facturación. RECHAZADO sí fue
                venta.
              </p>
            </div>
          );
        }}
      </ContractBlock>
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <PanelCard titulo="Reglas de conteo" subtitulo="§2.5 de la especificación">
          <ul className="list-disc space-y-1.5 pl-4 text-xs text-pc-text">
            {REGLAS.map((regla) => (
              <li key={regla}>{regla}</li>
            ))}
          </ul>
        </PanelCard>
        <PanelCard
          titulo="Glosario"
          subtitulo="Una sola definición por métrica (§4): es el texto de los «?» del panel"
        >
          <dl className="space-y-2 text-xs">
            {GLOSARIO_IDS.map((id) => (
              <div key={id}>
                <dt className="font-semibold text-pc-text">{GLOSARIO[id].termino}</dt>
                <dd className="text-pc-text-muted">{GLOSARIO[id].definicion}</dd>
              </div>
            ))}
          </dl>
        </PanelCard>
      </div>
    </div>
  );
}
