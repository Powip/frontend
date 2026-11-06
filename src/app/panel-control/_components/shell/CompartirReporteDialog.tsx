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
import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanelExportMeta } from "@/features/panel-control/shared/hooks/use-panel-export-meta";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { useExcelCompleto } from "./useExcelCompleto";

interface CompartirReporteDialogProps {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
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
              {data.gananciaSobreVentaTotal === undefined && (
                <p className="text-xs text-pc-text-muted">
                  Tu rol no recibe costo de producto, envíos ni ganancia: el reporte los omite.
                </p>
              )}
              <p className="text-xs text-pc-text-muted">
                Hay dos ganancias distintas porque la especificación pide ambas (decisión abierta):
                «sobre venta total» resta producto, publicidad y envíos a todo lo vendido, entregado
                o no; «real sobre entregado» es la del panel y solo cuenta lo entregado.
              </p>
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
