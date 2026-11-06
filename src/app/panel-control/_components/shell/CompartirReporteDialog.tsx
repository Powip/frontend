"use client";

import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { ContractView } from "@/components/panel-control/ContractView";
import { DataOriginBadge } from "@/components/panel-control/DataOriginBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CompartirReporteResponse } from "@/features/panel-control/exportacion/models/exportacion.model";
import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanelExportMeta } from "@/features/panel-control/shared/hooks/use-panel-export-meta";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { formatPercent, formatSolesDecimales } from "@/features/panel-control/shared/utils/format";
import { useExcelCompleto } from "./useExcelCompleto";

interface CompartirReporteDialogProps {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
}

const SIN_DATO_TEXTO = "Sin dato";

function CifrasDelReporte({ data }: { data: CompartirReporteResponse }) {
  // null es «Sin dato» (R13): nunca 0 ni «S/ null».
  const soles = (valor: number | null) =>
    valor === null ? SIN_DATO_TEXTO : formatSolesDecimales(valor);
  const porcentaje = (valor: number | null) =>
    valor === null ? SIN_DATO_TEXTO : formatPercent(valor);
  const filas: [string, string][] = [
    ["Producto", soles(data.producto)],
    ["Publicidad", soles(data.publicidad)],
    ["Envíos", soles(data.envios)],
    ["Costo por venta (CPA)", soles(data.costoPorVenta)],
    ["Efectividad de entrega", porcentaje(data.efectividadEntrega)],
    ["Ganancia real sobre entregado", soles(data.gananciaSobreEntregado)],
    ["Vencido", soles(data.vencido)],
  ];
  return (
    <div className="space-y-2">
      <dl
        aria-label="Cifras del reporte"
        className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-pc-text-muted"
      >
        {filas.map(([nombre, valor]) => (
          <div key={nombre} className="flex justify-between gap-2">
            <dt>{nombre}</dt>
            <dd className="font-medium text-pc-text">{valor}</dd>
          </div>
        ))}
      </dl>
      {data.productoIncompleto && (
        <p className="text-xs text-pc-text-muted">
          Hay entregas sin costo de producto: el costo y la ganancia son parciales.
        </p>
      )}
    </div>
  );
}

export function CompartirReporteDialog({ abierto, onAbiertoChange }: CompartirReporteDialogProps) {
  const { view } = usePanel();
  const exportMeta = usePanelExportMeta();
  const reporte = usePanelContract(
    "compartir-reporte",
    abierto && view.access === "permitido" ? view.query : null,
  );
  const excel = useExcelCompleto();
  const puedeLibro = excel.permitido;

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Reporte copiado: pégalo en WhatsApp");
    } catch {
      toast.error("No se pudo copiar automáticamente", {
        description: "Selecciona el texto del reporte y cópialo a mano.",
      });
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Compartir reporte
            {reporte.status !== "cargando" && (
              <DataOriginBadge origin={reporte.origin} mostrarReal />
            )}
          </DialogTitle>
          <DialogDescription>
            Mismo formato y palabras que el equipo manda por WhatsApp. Periodo {exportMeta.periodo}.
            Filtros: {exportMeta.filtros}.
          </DialogDescription>
        </DialogHeader>
        <ContractView state={reporte} label="reporte para compartir" skeleton="linea">
          {(data) => (
            <div className="space-y-3">
              <pre className="whitespace-pre-wrap rounded-xl border border-pc-border bg-pc-surface-muted p-3 font-sans text-[13px] leading-relaxed text-pc-text">
                {data.texto}
              </pre>
              <CifrasDelReporte data={data} />
              <div className="flex flex-wrap justify-end gap-2">
                {puedeLibro && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={excel.descargando}
                    onClick={() => void excel.descargar()}
                  >
                    <Download aria-hidden />
                    {excel.descargando ? "Generando…" : "Excel completo"}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  className="bg-pc-primary text-white hover:bg-pc-primary-strong"
                  onClick={() => void copiar(data.texto)}
                >
                  <Copy aria-hidden />
                  Copiar para WhatsApp
                </Button>
              </div>
            </div>
          )}
        </ContractView>
      </DialogContent>
    </Dialog>
  );
}
