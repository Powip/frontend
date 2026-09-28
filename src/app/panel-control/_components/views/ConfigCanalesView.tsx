"use client";

import { Pencil, Plus } from "lucide-react";
import { useMemo } from "react";
import { ContractView } from "@/components/panel-control/ContractView";
import { DataTable, type DataTableColumn } from "@/components/panel-control/DataTable";
import { PanelCard } from "@/components/panel-control/PanelCard";
import { notifyPendingIntegration } from "@/components/panel-control/pending-integration";
import { Button } from "@/components/ui/button";
import type {
  CampoFichaCanal,
  CanalFicha,
} from "@/features/panel-control/canales/models/canal-ficha.model";
import {
  COBRO_LABEL,
  ENTRADA_CHIP_LABEL,
} from "@/features/panel-control/shared/config/filter-labels.config";
import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { formatPercent, formatSoles } from "@/features/panel-control/shared/utils/format";

function Pendiente() {
  return (
    <span className="rounded bg-pc-border-soft px-1.5 py-0.5 text-[10.5px] text-pc-text-muted">
      Pendiente
    </span>
  );
}

function campo(ficha: CanalFicha, nombre: CampoFichaCanal, contenido: React.ReactNode) {
  return ficha.camposPendientes.includes(nombre) ? <Pendiente /> : contenido;
}

export function ConfigCanalesView() {
  const { session, view } = usePanel();
  const query = useMemo(
    () => (session.empresaId ? { empresaId: session.empresaId } : null),
    [session.empresaId],
  );
  const fichas = usePanelContract("canales-fichas", query);
  const puedeEditar = view.access === "permitido" && view.capabilities.has("editar_configuracion");

  const columns: DataTableColumn<CanalFicha>[] = [
    {
      id: "canal",
      header: "Canal",
      align: "left",
      cell: (ficha) => (
        <span className="font-semibold">
          {ficha.nombre}
          <span className="ml-1 font-normal text-pc-text-soft">({ficha.clave})</span>
        </span>
      ),
      sortValue: (ficha) => ficha.nombre,
      exportValue: (ficha) => ficha.nombre,
    },
    {
      id: "estado",
      header: "Activo",
      align: "left",
      cell: (ficha) => (ficha.activo ? "Sí" : "No"),
      sortValue: (ficha) => (ficha.activo ? 1 : 0),
      exportValue: (ficha) => (ficha.activo ? "Sí" : "No"),
    },
    {
      id: "entrada",
      header: "Entra como",
      align: "left",
      cell: (ficha) =>
        campo(ficha, "entrada", ficha.entrada ? ENTRADA_CHIP_LABEL[ficha.entrada] : null),
      exportValue: (ficha) => (ficha.entrada ? ENTRADA_CHIP_LABEL[ficha.entrada] : "Pendiente"),
    },
    {
      id: "cobro",
      header: "Cobro",
      align: "left",
      cell: (ficha) => campo(ficha, "cobro", ficha.cobro ? COBRO_LABEL[ficha.cobro] : null),
      exportValue: (ficha) => (ficha.cobro ? COBRO_LABEL[ficha.cobro] : "Pendiente"),
    },
    {
      id: "courier",
      header: "Courier",
      align: "left",
      cell: (ficha) => campo(ficha, "usaCourier", ficha.usaCourier ? "Sí" : "No"),
      exportValue: (ficha) =>
        ficha.usaCourier === null ? "Pendiente" : ficha.usaCourier ? "Sí" : "No",
    },
    {
      id: "comision",
      header: "Comisión",
      cell: (ficha) => campo(ficha, "comisionPct", formatPercent(ficha.comisionPct ?? null, 1)),
      exportValue: (ficha) => ficha.comisionPct ?? null,
      exportFormat: "porcentaje",
    },
    {
      id: "pasarela",
      header: "Pasarela",
      cell: (ficha) => campo(ficha, "pasarelaPct", formatPercent(ficha.pasarelaPct ?? null, 1)),
      exportValue: (ficha) => ficha.pasarelaPct ?? null,
      exportFormat: "porcentaje",
    },
    {
      id: "pauta",
      header: "Pauta general",
      align: "left",
      cell: (ficha) =>
        campo(ficha, "recibePautaGeneral", ficha.recibePautaGeneral ? "Sí · estimado" : "No"),
      exportValue: (ficha) =>
        ficha.recibePautaGeneral === null ? "Pendiente" : ficha.recibePautaGeneral ? "Sí" : "No",
    },
    {
      id: "meta",
      header: "Meta mes",
      cell: (ficha) => campo(ficha, "metaMensual", formatSoles(ficha.metaMensual)),
      exportValue: (ficha) => ficha.metaMensual,
      exportFormat: "soles",
    },
    {
      id: "editar",
      header: "",
      cell: (ficha) =>
        puedeEditar ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            aria-label={`Editar ficha de ${ficha.nombre}`}
            onClick={() =>
              notifyPendingIntegration(`Editar ficha de ${ficha.nombre}`, "canales-fichas-guardar")
            }
          >
            <Pencil aria-hidden />
            Editar
          </Button>
        ) : null,
    },
  ];

  return (
    <ContractView state={fichas} label="fichas de canal" skeleton="tabla">
      {(data, origin) => (
        <PanelCard
          titulo="Ficha de canales"
          subtitulo={`${origin.kind === "real" ? "Datos reales de /config/canales." : "Datos demo."} Los campos marcados «Pendiente» todavía no existen en el backend; entrada, cobro y courier se bloquearán cuando el canal tenga pedidos.`}
          origin={origin}
          acciones={
            puedeEditar && (
              <Button
                type="button"
                size="sm"
                className="bg-pc-primary text-white hover:bg-pc-primary-strong"
                onClick={() => notifyPendingIntegration("Agregar canal", "canales-fichas-guardar")}
              >
                <Plus aria-hidden />
                Agregar canal
              </Button>
            )
          }
        >
          <DataTable
            caption="Fichas de canal"
            columns={columns}
            rows={data}
            getRowKey={(ficha) => ficha.id}
            emptyMessage="La empresa no tiene canales configurados"
            exportar={{
              titulo: "Ficha de canales",
              nombreBase: "ficha_canales",
              origen: origin.kind,
            }}
          />
        </PanelCard>
      )}
    </ContractView>
  );
}
