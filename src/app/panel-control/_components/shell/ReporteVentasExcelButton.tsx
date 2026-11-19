"use client";

import { FileSpreadsheet } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  buildReporteVentasFilas,
  canalDelPanel,
  descargarReporteVentas,
} from "@/features/panel-control/exportacion/services/reporte-ventas.service";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import type { CanalConfig } from "@/interfaces/IOrder";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { getBusinessSalesExport } from "@/services/businessSalesService";

/** Fichas de canal con su nombre interno. Con token: /config/canales está tras JwtAuthGuard (401 sin él). */
async function getFichasCanal(empresaId: string): Promise<CanalConfig[]> {
  const base = process.env.NEXT_PUBLIC_API_VENTAS || GATEWAY.ventas;
  const { data } = await axiosAuth.get<CanalConfig[]>(`${base}/config/canales`, { params: { empresaId } });
  return data;
}
import { isCommercialSaleOrder } from "@/utils/commercialOrders";

/**
 * Botón «Excel» de Ventas y canales: descarga el reporte de ventas detallado
 * (una fila por pedido) del periodo, la tienda y el canal elegidos en el panel, con datos reales.
 * Es distinto del «Excel completo» de la barra superior (libro de 9 hojas).
 */
export function ReporteVentasExcelButton() {
  const { view, session } = usePanel();
  const [descargando, setDescargando] = useState(false);
  const enCurso = useRef(false);

  if (view.access !== "permitido") return null;
  if (!view.capabilities.has("exportar_tabla")) return null;

  const { query } = view;

  const descargar = async () => {
    if (enCurso.current) return;
    const storeIds = query.tienda ? [query.tienda] : session.tiendas.map((tienda) => tienda.id);
    if (!storeIds.length) {
      toast.error("No hay tiendas para exportar");
      return;
    }
    enCurso.current = true;
    setDescargando(true);
    try {
      const [listado, fichas] = await Promise.all([
        getBusinessSalesExport(storeIds, {
          tab: "todas",
          page: 1,
          limit: 100,
          dateFrom: query.desde,
          dateTo: query.hasta,
        }),
        // Las fichas solo hacen falta para reconocer el canal elegido en el panel.
        query.canal && session.empresaId ? getFichasCanal(session.empresaId) : Promise.resolve([]),
      ]);
      const pedidos = listado.filter(
        (pedido) =>
          // Ventas vigentes, como cuenta el panel («Vendí … N ventas»): sin anuladas.
          pedido.status !== "INCOMPLETE" &&
          pedido.status !== "ANULADO" &&
          isCommercialSaleOrder(pedido) &&
          pedido.salesOperationalEligible !== false &&
          (!query.canal || canalDelPanel(pedido, fichas) === query.canal),
      );

      if (!pedidos.length) {
        toast.warning(
          query.canal ? "No hay ventas de este canal en el periodo elegido" : "No hay ventas en el periodo elegido",
        );
        return;
      }

      const filas = buildReporteVentasFilas(pedidos, {
        tiendas: new Map(session.tiendas.map((tienda) => [tienda.id, tienda.nombre])),
        verCostos: view.capabilities.has("ver_costos"),
      });
      const nombre = descargarReporteVentas(filas, query.desde, query.hasta);
      const otrosFiltros = query.entrada || query.cobro || query.zona || query.asesor;
      toast.success(`Excel descargado: ${nombre}`, {
        description: otrosFiltros
          ? `${filas.length} ventas. Filtra por periodo, tienda y canal; no por entrada, cobro, zona ni asesor.`
          : `${filas.length} ventas del periodo.`,
      });
    } catch {
      toast.error("No se pudo generar el reporte de ventas. Intenta nuevamente.");
    } finally {
      enCurso.current = false;
      setDescargando(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void descargar()}
      disabled={descargando}
      aria-label={descargando ? "Generando reporte de ventas" : "Descargar reporte de ventas en Excel"}
      className="inline-flex items-center gap-1.5 rounded-lg border border-pc-border bg-pc-card px-2.5 py-1.5 text-[11px] font-semibold text-pc-text outline-none hover:border-pc-primary hover:text-pc-primary focus-visible:ring-2 focus-visible:ring-pc-primary disabled:cursor-wait disabled:opacity-60"
    >
      <FileSpreadsheet aria-hidden className="size-3.5 text-emerald-600" />
      {descargando ? "Generando…" : "Descargar Excel"}
    </button>
  );
}
