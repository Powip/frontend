import { calcularCuadresDemo } from "../../configuracion/sources/configuracion.demo";
import { METAS_ESPECIFICACION } from "../../shared/config/panel-goals.defaults";
import { pedidosEnRango } from "../../shared/data/demo/demo-consultas";
import { obtenerUniversoDemo } from "../../shared/data/demo/demo-universe";
import { consultaConIdentidad } from "../../shared/data/panel-identidad";
import type { PanelSource } from "../../shared/data/panel-source";
import type { EstadoPeriodo } from "../models/estado-periodo.model";

export const estadoPeriodoDemoSource: PanelSource<"estado-periodo"> = {
  contractId: "estado-periodo",
  kind: "demo",
  descripcion: "Datos demo deterministas: el contrato GET /panel/estado no existe todavía",
  fetch: async (consulta, context) => {
    const query = consultaConIdentidad(consulta, context);
    const universo = obtenerUniversoDemo(context.catalogo, context.now);
    const items = pedidosEnRango(universo, query, query.desde, query.hasta, context.now);
    const abiertos = items.filter(
      ({ estado }) =>
        estado.leadAbierto || estado.cobro === "en_curso" || estado.cobro === "por_liquidar",
    );
    const actual: EstadoPeriodo = {
      pedidosPeriodo: items.length,
      pedidosAbiertos: abiertos.length,
      porcentajeAbierto: items.length ? abiertos.length / items.length : null,
    };
    if (context.capabilities.has("ver_configuracion")) {
      const { cuadres, calidad } = calcularCuadresDemo(universo, query, context.now);
      actual.calidad = {
        datosCompletos: calidad.porcentajeCompleto,
        cuadresOk: cuadres.filter((cuadre) => cuadre.cuadra).length,
        cuadresTotal: cuadres.length,
      };
    }
    return {
      actual,
      anterior_misma_antiguedad: null,
      metas: METAS_ESPECIFICACION,
      generado_en: new Date(context.now).toISOString(),
    };
  },
};
