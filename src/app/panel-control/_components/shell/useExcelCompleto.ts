"use client";

import { saveAs } from "file-saver";
import { useState } from "react";
import { toast } from "sonner";
import { notifyPendingIntegration } from "@/components/panel-control/pending-integration";
import { rolPuedeUsarContrato } from "@/features/panel-control/shared/data/panel-autorizacion";
import { usePanelContractFetcher } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";

export function useExcelCompleto() {
  const { view } = usePanel();
  const fetcher = usePanelContractFetcher("exportacion-libro");
  const [descargando, setDescargando] = useState(false);
  const permitido =
    view.access === "permitido" &&
    rolPuedeUsarContrato("exportacion-libro", view.role, view.capabilities);

  const descargar = async () => {
    if (view.access !== "permitido") return;
    if (!permitido) {
      toast.error("Tu rol no puede descargar el Excel completo");
      return;
    }
    if (!fetcher.fetch) {
      notifyPendingIntegration("Excel completo", "exportacion-libro");
      return;
    }
    setDescargando(true);
    try {
      const { archivo, nombreArchivo } = await fetcher.fetch({ ...view.query, formato: "xlsx" });
      saveAs(archivo, nombreArchivo);
      toast.success(`Excel descargado: ${nombreArchivo}`, {
        description:
          fetcher.origin.kind === "demo"
            ? "9 hojas con datos de demostración"
            : "9 hojas: Resumen, Canales, Pedidos, Productos, Vendedoras, Confirmadoras, Couriers, Departamentos y Cuadres",
      });
    } catch (error) {
      toast.error("No se pudo generar el Excel completo", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setDescargando(false);
    }
  };

  return { descargar, descargando, permitido, origen: fetcher.origin.kind };
}
