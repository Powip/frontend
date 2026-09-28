"use client";

import { HBarList } from "@/components/panel-control/charts/HBarList";
import {
  BUCKET_ESPERA_LABEL,
  type BucketEspera,
} from "@/features/panel-control/call-center/models/call-center.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import type { PanelContractState } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { formatNumber, formatPercent } from "@/features/panel-control/shared/utils/format";
import { ContractBlock } from "../ventas/ContractBlock";

type CallCenterState = PanelContractState<"callcenter">;

const COLOR_BUCKET: Record<BucketEspera, string> = {
  menos_1h: "var(--pc-series-1)",
  "1_6h": "var(--pc-series-1)",
  "6_24h": "var(--pc-warn)",
  mas_24h: "var(--pc-bad)",
};

export function ColaLeadsCard({ state }: { state: CallCenterState }) {
  const { openDrilldown } = usePanel();
  return (
    <ContractBlock
      state={state}
      titulo="Leads esperando llamada"
      subtitulo="Cuánto llevan esperando ahora mismo. No depende del periodo; sí de tienda, canal y demás filtros."
    >
      {(data) => {
        const { colaEspera, kpis } = data.actual;
        return (
          <div className="space-y-2">
            <HBarList
              ariaLabel="Leads por antigüedad de espera"
              formatValue={formatNumber}
              rows={colaEspera.map((fila) => ({
                key: fila.bucket,
                label: BUCKET_ESPERA_LABEL[fila.bucket],
                value: fila.leads,
                barColor: COLOR_BUCKET[fila.bucket],
                dotColor: COLOR_BUCKET[fila.bucket],
                description: `${BUCKET_ESPERA_LABEL[fila.bucket]}: ${formatNumber(fila.leads)} leads, ${formatNumber(fila.sinIntento)} sin ningún intento`,
                onSelect: () =>
                  openDrilldown(
                    grupos.actual(
                      "cola_leads",
                      `Leads esperando · ${BUCKET_ESPERA_LABEL[fila.bucket]}`,
                      { antiguedad: fila.bucket },
                      "llamar",
                    ),
                  ),
              }))}
            />
            <p className="text-xs text-pc-text-muted">
              {formatNumber(kpis.porLlamarAhora)} en cola · {formatNumber(kpis.sinIntentoAhora)} sin
              ningún intento
            </p>
          </div>
        );
      }}
    </ContractBlock>
  );
}

export function MotivosAnulacionCard({ state }: { state: CallCenterState }) {
  const { openDrilldown } = usePanel();
  return (
    <ContractBlock
      state={state}
      titulo="Motivos de anulación"
      subtitulo="Catálogo fijo. «Sin motivo» no es un motivo: es un registro incompleto."
    >
      {(data) => {
        const { motivosAnulacion, calidad } = data.actual;
        return (
          <div className="space-y-2">
            <HBarList
              ariaLabel="Leads anulados por motivo"
              formatValue={formatNumber}
              rows={motivosAnulacion.map((fila) => ({
                key: fila.motivo,
                label: fila.sinMotivo ? "Sin motivo (error de datos)" : fila.motivo,
                value: fila.leads,
                barColor: fila.sinMotivo ? "var(--pc-text-soft)" : "var(--pc-series-2)",
                dotColor: fila.sinMotivo ? "var(--pc-text-soft)" : "var(--pc-series-2)",
                onSelect: () =>
                  openDrilldown(
                    grupos.de(
                      "leads_anulados",
                      fila.sinMotivo ? "Anulados sin motivo" : `Anulados · ${fila.motivo}`,
                      { tipo: "anulado", motivo: fila.motivo },
                      fila.sinMotivo ? "completar_motivo" : null,
                    ),
                  ),
              }))}
            />
            {calidad.anuladosSinMotivo > 0 && (
              <p
                role="note"
                className="rounded-lg bg-pc-warn-soft px-2.5 py-1.5 text-xs text-pc-warn"
              >
                {formatNumber(calidad.anuladosSinMotivo)} anulaciones sin motivo. Completarlas es
                obligatorio; no se suman a ningún motivo.
              </p>
            )}
          </div>
        );
      }}
    </ContractBlock>
  );
}

export function CalidadLeadsCard({ state }: { state: CallCenterState }) {
  const { openDrilldown } = usePanel();
  const tile =
    "flex flex-col items-start rounded-xl border border-pc-border p-3 text-left outline-none hover:border-pc-primary focus-visible:ring-2 focus-visible:ring-pc-primary";
  return (
    <ContractBlock
      state={state}
      titulo="Duplicados y lista negra"
      subtitulo="Se detectan antes de que inflen las ventas"
    >
      {(data) => {
        const { calidad } = data.actual;
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={tile}
                aria-label={`Duplicados: ${formatNumber(calidad.duplicados)} leads. Ver pedidos`}
                onClick={() => openDrilldown(grupos.de("duplicados", "Leads duplicados"))}
              >
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-pc-text-muted">
                  Duplicados
                </span>
                <span className="text-2xl font-bold tabular-nums text-pc-text">
                  {formatNumber(calidad.duplicados)}
                </span>
                <span className="text-xs text-pc-text-muted">
                  Mismo teléfono y producto en &lt; 24 h
                </span>
              </button>
              <button
                type="button"
                className={tile}
                aria-label={`Lista negra: ${formatNumber(calidad.listaNegra)} leads de clientes con rechazos previos. Ver pedidos`}
                onClick={() =>
                  openDrilldown(
                    grupos.de("leads_lista_negra", "Leads de clientes con rechazos previos"),
                  )
                }
              >
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-pc-text-muted">
                  Lista negra
                </span>
                <span className="text-2xl font-bold tabular-nums text-pc-bad">
                  {formatNumber(calidad.listaNegra)}
                </span>
                <span className="text-xs text-pc-text-muted">Clientes con un rechazo anterior</span>
              </button>
            </div>
            <p className="text-xs text-pc-text-muted">
              Con rechazos previos confirman <b>{formatPercent(calidad.confirmacionListaNegra)}</b>{" "}
              y se entregan <b>{formatPercent(calidad.entregaListaNegra)}</b>, contra{" "}
              <b>{formatPercent(calidad.confirmacionTotal)}</b> /{" "}
              <b>{formatPercent(calidad.entregaTotal)}</b> del total. Sugerencia: pedir adelanto por
              Yape.
            </p>
          </div>
        );
      }}
    </ContractBlock>
  );
}
