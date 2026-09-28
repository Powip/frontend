"use client";

import { HBarList } from "@/components/panel-control/charts/HBarList";
import { DataTable, type DataTableColumn } from "@/components/panel-control/DataTable";
import { KpiCard } from "@/components/panel-control/KpiCard";
import type {
  CanalBloqueEspecifico,
  CierreCajaDia,
  EtapaEmbudo,
  MotivoPerdida,
  VendedoraCanalFila,
} from "@/features/panel-control/canales/models/canal-detalle.model";
import type { GrupoDetalleTipo } from "@/features/panel-control/detalle/models/detalle.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import type { PanelContractState } from "@/features/panel-control/shared/hooks/use-panel-contract";
import type { DataOrigin } from "@/features/panel-control/shared/models/data-origin.model";
import { SIN_ASESOR } from "@/features/panel-control/shared/models/panel-filters.model";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import {
  formatDayKey,
  formatDays,
  formatNumber,
  formatPercent,
  formatSoles,
} from "@/features/panel-control/shared/utils/format";
import { CeldaDrill } from "../CeldaDrill";
import { ContractBlock } from "../ContractBlock";
import { SesionesLiveTabla } from "../SesionesLiveTabla";

const TITULO: Record<CanalBloqueEspecifico["tipo"], { titulo: string; subtitulo: string }> = {
  lead: {
    titulo: "Embudo de leads y pérdidas",
    subtitulo: "De lead recibido a pedido entregado, con los motivos de anulación y rechazo",
  },
  live: {
    titulo: "Sesiones de TikTok Live",
    subtitulo: "Inversión y ventas de cada transmisión (hora Lima)",
  },
  presencial: {
    titulo: "Cierre de caja diario",
    subtitulo: "Tickets y cobro por método de pago, día por día",
  },
  marketplace: {
    titulo: "Liquidación del marketplace",
    subtitulo: "Lo entregado que la plataforma aún no deposita",
  },
  prepago: {
    titulo: "Cobros, pasarela y reembolsos",
    subtitulo: "El cliente paga antes del envío",
  },
  conversacional: {
    titulo: "Ventas por vendedora",
    subtitulo: "Pedidos cerrados por cada vendedora en este canal",
  },
};

const ETAPA: Record<EtapaEmbudo, { label: string; grupo: GrupoDetalleTipo }> = {
  recibidos: { label: "Leads recibidos", grupo: "leads" },
  contactados: { label: "Contactados", grupo: "contactados" },
  llamados: { label: "Confirmados (venta)", grupo: "ventas" },
  entregados: { label: "Entregados", grupo: "entregados" },
};

interface BloqueProps<B> {
  bloque: B;
  canalId: string;
  nombre: string;
  origin: DataOrigin;
}

function BloqueLead({
  bloque,
  canalId,
  nombre,
  origin,
}: BloqueProps<Extract<CanalBloqueEspecifico, { tipo: "lead" }>>) {
  const { openDrilldown } = usePanel();
  const recibidos = bloque.embudo.find((etapa) => etapa.etapa === "recibidos")?.pedidos ?? 0;
  const columnas: DataTableColumn<MotivoPerdida>[] = [
    {
      id: "motivo",
      header: "Motivo",
      align: "left",
      cell: (fila) => (
        <CeldaDrill
          ariaLabel={`Ver pedidos ${fila.tipo === "anulado" ? "anulados" : "rechazados"} por ${fila.motivo}`}
          onSelect={() =>
            openDrilldown(
              grupos.de("perdidas", `${nombre} · ${fila.motivo}`, {
                canal: canalId,
                tipo: fila.tipo,
                motivo: fila.motivo,
              }),
            )
          }
        >
          {fila.motivo}
        </CeldaDrill>
      ),
      sortValue: (fila) => fila.motivo,
      exportValue: (fila) => fila.motivo,
    },
    {
      id: "tipo",
      header: "Tipo",
      align: "left",
      cell: (fila) => (fila.tipo === "anulado" ? "Anulado" : "Rechazado"),
      sortValue: (fila) => fila.tipo,
      exportValue: (fila) => fila.tipo,
    },
    {
      id: "pedidos",
      header: "Pedidos",
      cell: (fila) => formatNumber(fila.pedidos),
      sortValue: (fila) => fila.pedidos,
      exportValue: (fila) => fila.pedidos,
      exportFormat: "numero",
    },
    {
      id: "sobre_leads",
      header: "% de los leads",
      cell: (fila) => formatPercent(recibidos ? fila.pedidos / recibidos : null),
      sortValue: (fila) => fila.pedidos,
      exportValue: (fila) => (recibidos ? fila.pedidos / recibidos : null),
      exportFormat: "porcentaje",
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div>
        <h4 className="mb-2 text-xs font-semibold text-pc-text">Embudo</h4>
        <HBarList
          ariaLabel="Embudo de leads"
          formatValue={formatNumber}
          total={recibidos}
          rows={bloque.embudo.map((etapa) => ({
            key: etapa.etapa,
            label: ETAPA[etapa.etapa].label,
            value: etapa.pedidos,
            description: `${ETAPA[etapa.etapa].label}: ${formatNumber(etapa.pedidos)} (${formatPercent(recibidos ? etapa.pedidos / recibidos : null)} de los leads)`,
            onSelect: () =>
              openDrilldown(
                grupos.de(ETAPA[etapa.etapa].grupo, `${nombre} · ${ETAPA[etapa.etapa].label}`, {
                  canal: canalId,
                }),
              ),
          }))}
        />
      </div>
      <div>
        <h4 className="mb-2 text-xs font-semibold text-pc-text">Pérdidas por motivo</h4>
        <DataTable
          caption={`Pérdidas de ${nombre} por motivo`}
          columns={columnas}
          rows={bloque.perdidas}
          getRowKey={(fila) => `${fila.tipo}-${fila.motivo}`}
          exportar={{
            titulo: `Pérdidas · ${nombre}`,
            nombreBase: "perdidas_canal",
            origen: origin.kind,
          }}
          emptyMessage="Sin anulaciones ni rechazos en el periodo"
        />
      </div>
    </div>
  );
}

function BloquePresencial({
  bloque,
  canalId,
  nombre,
  origin,
}: BloqueProps<Extract<CanalBloqueEspecifico, { tipo: "presencial" }>>) {
  const { openDrilldown } = usePanel();
  const columnas: DataTableColumn<CierreCajaDia>[] = [
    {
      id: "dia",
      header: "Día",
      align: "left",
      cell: (fila) => (
        <CeldaDrill
          ariaLabel={`Ver ventas de ${nombre} del ${formatDayKey(fila.dia)}`}
          onSelect={() =>
            openDrilldown(
              grupos.de("ventas", `${nombre} · ${formatDayKey(fila.dia)}`, {
                canal: canalId,
                dia: fila.dia,
              }),
            )
          }
        >
          {formatDayKey(fila.dia)}
        </CeldaDrill>
      ),
      sortValue: (fila) => fila.dia,
      exportValue: (fila) => fila.dia,
    },
    {
      id: "tickets",
      header: "Tickets",
      cell: (fila) => formatNumber(fila.tickets),
      sortValue: (fila) => fila.tickets,
      exportValue: (fila) => fila.tickets,
      exportFormat: "numero",
    },
    ...bloque.metodos.map(
      (metodo): DataTableColumn<CierreCajaDia> => ({
        id: `metodo-${metodo}`,
        header: metodo,
        cell: (fila) => formatSoles(fila.porMetodo[metodo] ?? 0),
        sortValue: (fila) => fila.porMetodo[metodo] ?? 0,
        exportValue: (fila) => fila.porMetodo[metodo] ?? 0,
        exportFormat: "soles",
      }),
    ),
    {
      id: "total",
      header: "Total caja",
      cell: (fila) => <b>{formatSoles(fila.total)}</b>,
      sortValue: (fila) => fila.total,
      exportValue: (fila) => fila.total,
      exportFormat: "soles",
    },
    {
      id: "ticket",
      header: "Ticket promedio",
      cell: (fila) => formatSoles(fila.ticketPromedio),
      sortValue: (fila) => fila.ticketPromedio,
      exportValue: (fila) => fila.ticketPromedio,
      exportFormat: "soles",
    },
  ];
  const total = bloque.cierres.reduce((suma, dia) => suma + dia.total, 0);
  const tickets = bloque.cierres.reduce((suma, dia) => suma + dia.tickets, 0);
  return (
    <DataTable
      caption={`Cierre de caja diario de ${nombre}`}
      columns={columnas}
      rows={bloque.cierres}
      getRowKey={(fila) => fila.dia}
      exportar={{
        titulo: `Cierre de caja · ${nombre}`,
        nombreBase: "cierre_caja",
        origen: origin.kind,
      }}
      emptyMessage="Sin ventas presenciales en el periodo"
      maxHeight={420}
      footer={{
        dia: "Total",
        tickets: formatNumber(tickets),
        total: formatSoles(total),
        ticket: formatSoles(tickets ? total / tickets : null),
        ...Object.fromEntries(
          bloque.metodos.map((metodo) => [
            `metodo-${metodo}`,
            formatSoles(
              bloque.cierres.reduce((suma, dia) => suma + (dia.porMetodo[metodo] ?? 0), 0),
            ),
          ]),
        ),
      }}
    />
  );
}

function BloqueMarketplace({
  bloque,
  canalId,
  nombre,
  origin,
}: BloqueProps<Extract<CanalBloqueEspecifico, { tipo: "marketplace" }>>) {
  const { openDrilldown } = usePanel();
  const verLiquidar = () =>
    openDrilldown(
      grupos.de(
        "por_liquidar",
        `${nombre} · entregado sin liquidar`,
        { canal: canalId },
        "pedir_liquidacion",
      ),
    );
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        label="Por liquidar (bruto)"
        glosario="por_liquidar"
        value={formatSoles(bloque.porLiquidarBruto)}
        origin={origin}
        sub={`${formatNumber(bloque.pedidosPorLiquidar)} pedidos entregados sin depósito`}
        onDrill={verLiquidar}
      />
      {bloque.comisionADescontar !== undefined && (
        <KpiCard
          label="Comisión a descontar"
          value={formatSoles(bloque.comisionADescontar)}
          origin={origin}
          sub="Según el % de comisión de la ficha"
        />
      )}
      {bloque.netoARecibir !== undefined && (
        <KpiCard
          label="Neto a recibir"
          value={formatSoles(bloque.netoARecibir)}
          origin={origin}
          sub="Bruto por liquidar menos la comisión"
        />
      )}
      <KpiCard
        label="Plazo de liquidación"
        value={formatDays(bloque.plazoDias)}
        origin={origin}
        sub="Días entre la entrega y el depósito, según la ficha"
      />
    </div>
  );
}

function BloquePrepago({
  bloque,
  canalId,
  nombre,
  origin,
}: BloqueProps<Extract<CanalBloqueEspecifico, { tipo: "prepago" }>>) {
  const { openDrilldown } = usePanel();
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <KpiCard
        label="Cobrado"
        glosario="pagado"
        value={formatSoles(bloque.cobrado)}
        origin={origin}
        sub="Pagos confirmados antes del envío"
        onDrill={() =>
          openDrilldown(grupos.de("cobrado", `${nombre} · cobrado`, { canal: canalId }))
        }
        drillLabel="Ver cobros"
      />
      {bloque.pasarela !== undefined && (
        <KpiCard
          label="Comisión de pasarela"
          value={formatSoles(bloque.pasarela)}
          origin={origin}
          sub="Según el % de pasarela de la ficha"
        />
      )}
      <KpiCard
        label="Reembolsos"
        value={formatSoles(bloque.reembolsos)}
        origin={origin}
        sub={`${formatNumber(bloque.pedidosReembolsados)} pedidos cobrados y luego anulados o rechazados`}
        onDrill={() =>
          openDrilldown(grupos.de("reembolsados", `${nombre} · reembolsos`, { canal: canalId }))
        }
      />
    </div>
  );
}

function BloqueConversacional({
  bloque,
  canalId,
  nombre,
  origin,
}: BloqueProps<Extract<CanalBloqueEspecifico, { tipo: "conversacional" }>>) {
  const { openDrilldown } = usePanel();
  const columnas: DataTableColumn<VendedoraCanalFila>[] = [
    {
      id: "vendedora",
      header: "Vendedora",
      align: "left",
      cell: (fila) => (
        <CeldaDrill
          ariaLabel={`Ver ventas de ${fila.asesorNombre} en ${nombre}`}
          onSelect={() =>
            openDrilldown(
              grupos.de("ventas", `${nombre} · ${fila.asesorNombre}`, {
                canal: canalId,
                asesor: fila.asesorId ?? SIN_ASESOR,
              }),
            )
          }
        >
          {fila.asesorNombre}
        </CeldaDrill>
      ),
      sortValue: (fila) => fila.asesorNombre,
      exportValue: (fila) => fila.asesorNombre,
    },
    {
      id: "ventas",
      header: "Ventas",
      cell: (fila) => formatNumber(fila.ventas),
      sortValue: (fila) => fila.ventas,
      exportValue: (fila) => fila.ventas,
      exportFormat: "numero",
    },
    {
      id: "facturacion",
      header: "Facturación",
      cell: (fila) => formatSoles(fila.facturacion),
      sortValue: (fila) => fila.facturacion,
      exportValue: (fila) => fila.facturacion,
      exportFormat: "soles",
    },
    {
      id: "ticket",
      header: "Ticket",
      cell: (fila) => formatSoles(fila.ticket),
      sortValue: (fila) => fila.ticket,
      exportValue: (fila) => fila.ticket,
      exportFormat: "soles",
    },
    {
      id: "upsell",
      header: "Con upsell",
      cell: (fila) => formatPercent(fila.tasaUpsell),
      sortValue: (fila) => fila.tasaUpsell,
      exportValue: (fila) => fila.tasaUpsell,
      exportFormat: "porcentaje",
    },
    {
      id: "efectividad",
      header: "Efectividad",
      cell: (fila) => formatPercent(fila.efectividadEntrega),
      sortValue: (fila) => fila.efectividadEntrega,
      exportValue: (fila) => fila.efectividadEntrega,
      exportFormat: "porcentaje",
    },
    {
      id: "pagado",
      header: "Pagado",
      cell: (fila) => formatSoles(fila.pagado),
      sortValue: (fila) => fila.pagado,
      exportValue: (fila) => fila.pagado,
      exportFormat: "soles",
    },
  ];
  return (
    <DataTable
      caption={`Ventas por vendedora en ${nombre}`}
      columns={columnas}
      rows={bloque.vendedoras}
      getRowKey={(fila) => fila.asesorId ?? SIN_ASESOR}
      exportar={{
        titulo: `Vendedoras · ${nombre}`,
        nombreBase: "vendedoras_canal",
        origen: origin.kind,
      }}
      emptyMessage="Sin ventas de vendedoras en el periodo"
    />
  );
}

export function CanalBloqueTipo({ state }: { state: PanelContractState<"canales-detalle"> }) {
  const tipo = state.data?.actual.bloque.tipo;
  const textos = tipo
    ? TITULO[tipo]
    : { titulo: "Detalle del tipo de canal", subtitulo: undefined };
  return (
    <ContractBlock state={state} titulo={textos.titulo} subtitulo={textos.subtitulo}>
      {(data, origin) => {
        const { bloque, ficha } = data.actual;
        const props = { canalId: ficha.id, nombre: ficha.nombre, origin };
        switch (bloque.tipo) {
          case "lead":
            return <BloqueLead bloque={bloque} {...props} />;
          case "live":
            return (
              <SesionesLiveTabla
                sesiones={bloque.sesiones}
                origen={origin.kind}
                canalId={ficha.id}
              />
            );
          case "presencial":
            return <BloquePresencial bloque={bloque} {...props} />;
          case "marketplace":
            return <BloqueMarketplace bloque={bloque} {...props} />;
          case "prepago":
            return <BloquePrepago bloque={bloque} {...props} />;
          case "conversacional":
            return <BloqueConversacional bloque={bloque} {...props} />;
        }
      }}
    </ContractBlock>
  );
}
