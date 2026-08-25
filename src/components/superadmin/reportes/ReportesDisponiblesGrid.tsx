"use client";

import { toast } from "sonner";
import { FileSpreadsheet, FileText } from "lucide-react";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useReportesDisponibles, useDescargarReporte, getRutaRealReporte } from "@/hooks/superadmin/useReportes";
import { KpiCardSkeleton, SimuladoBadge } from "@/components/superadmin/shared";
import { IReporteDisponible } from "@/interfaces/superadmin";

const FORMATO_LABEL: Record<"xlsx" | "pdf", string> = { xlsx: "Excel", pdf: "PDF" };
const FORMATO_ICON: Record<"xlsx" | "pdf", typeof FileSpreadsheet> = { xlsx: FileSpreadsheet, pdf: FileText };

export function ReportesDisponiblesGrid() {
  const { data, isLoading } = useReportesDisponibles();
  const { mutate: descargar, isPending } = useDescargarReporte();

  function handleDescargar(reporte: IReporteDisponible, formato: "xlsx" | "pdf") {
    toast.success(`Generando reporte "${reporte.nombre}"…`);
    descargar(
      { reporte, formato },
      {
        onSuccess: () => toast.success(`${reporte.nombre}.${formato} descargado`),
        onError: () => toast.error(`No se pudo generar "${reporte.nombre}".`),
      }
    );
  }

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <KpiCardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {data.map((r) => (
        <Card key={r.id} className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-sm">{r.nombre}</CardTitle>
            <CardDescription className="text-xs">{r.descripcion}</CardDescription>
          </CardHeader>
          <CardFooter className="px-4 gap-2 flex-wrap">
            {r.formatos.map((f) => {
              const Icon = FORMATO_ICON[f];
              const esReal = !!getRutaRealReporte(r.id, f);
              return (
                <div key={f} className="inline-flex items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={isPending}
                    onClick={() => handleDescargar(r, f)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {FORMATO_LABEL[f]}
                  </Button>
                  {!esReal && <SimuladoBadge />}
                </div>
              );
            })}
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
