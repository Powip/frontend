import type { ResumenPanel } from "../models/resumen.model";

const TOLERANCIA_SOLES = 1;

export interface CuadresResumen {
  canales: boolean;
  dias: boolean;
  flujo: boolean;
  cobranza: boolean;
}

const cerca = (a: number, b: number) => Math.abs(a - b) < TOLERANCIA_SOLES;

export function cuadresResumen(resumen: ResumenPanel): CuadresResumen {
  const { vendi, flujo, meDeben } = resumen;
  const canalFacturacion = resumen.ventasPorCanal.reduce(
    (total, fila) => total + fila.facturacion,
    0,
  );
  const canalVentas = resumen.ventasPorCanal.reduce((total, fila) => total + fila.ventas, 0);
  const diaFacturacion = resumen.ventasDiarias.reduce((total, dia) => total + dia.facturacion, 0);
  const diaVentas = resumen.ventasDiarias.reduce((total, dia) => total + dia.ventas, 0);
  return {
    canales: cerca(canalFacturacion, vendi.facturacion) && canalVentas === vendi.ventas,
    dias: cerca(diaFacturacion, vendi.facturacion) && diaVentas === vendi.ventas,
    flujo:
      cerca(
        flujo.entregados.monto + flujo.enCurso.monto + flujo.rechazados.perdido,
        vendi.facturacion,
      ) &&
      flujo.entregados.pedidos + flujo.enCurso.pedidos + flujo.rechazados.pedidos === vendi.ventas,
    cobranza: cerca(
      flujo.cobro.cobradoTotal +
        flujo.cobro.porLiquidar +
        meDeben.enCursoPorCobrar +
        flujo.rechazados.perdido,
      vendi.facturacion,
    ),
  };
}
