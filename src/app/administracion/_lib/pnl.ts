/**
 * Cascada de utilidad real — única fuente de verdad para el módulo.
 * Extraída de `resumen/page.tsx` para que Utilidad & Margen use exactamente
 * la misma fórmula (antes calculaba una versión simplificada con tasas de
 * comisión POWIP e IGV hardcodeadas en vez de la config real de la empresa,
 * y sin merma/fees marketplace/courier integrado).
 */

import { IGastoOperativo, IPnL } from "@/interfaces/IAdmin";

export function calcularPnL(
  orders: any[],
  gastos: IGastoOperativo[],
  merma: { totalUnidades: number; costoEstimado: number },
  ivaRate: number,
  courierIntegrado: number = 0,
  powipRate: number = 0.005,
): IPnL {
  const entregadas = orders.filter((o) => o.status === "ENTREGADO");
  const ventasBrutas = entregadas.reduce(
    (sum: number, o: any) => sum + (Number(o.grandTotal) || 0),
    0,
  );
  const cogs = entregadas.reduce(
    (sum: number, o: any) => sum + (Number(o.costAmount) || 0),
    0,
  );
  const utilidadBruta = ventasBrutas - cogs - merma.costoEstimado;
  const margenBruto =
    ventasBrutas > 0 ? (utilidadBruta / ventasBrutas) * 100 : 0;
  const feesMarketplace = entregadas.reduce(
    (sum: number, o: any) => sum + (Number(o.channelFee) || 0),
    0,
  );
  const gastosPlanilla = gastos
    .filter((g) => g.categoria === "PLANILLA")
    .reduce((s, g) => s + Number(g.monto), 0);
  const gastosHerramientas = gastos
    .filter((g) => g.categoria === "HERRAMIENTAS")
    .reduce((s, g) => s + Number(g.monto), 0);
  const gastosCourierPropio = gastos
    .filter((g) => g.categoria === "COURIER_PROPIO")
    .reduce((s, g) => s + Number(g.monto), 0);
  const gastosMarketing = gastos
    .filter((g) => g.categoria === "PUBLICIDAD")
    .reduce((s, g) => s + Number(g.monto), 0);
  const gastosOtros = gastos
    .filter((g) => g.categoria === "OTRO")
    .reduce((s, g) => s + Number(g.monto), 0);
  const totalGastosOperativos =
    feesMarketplace +
    gastosPlanilla +
    gastosHerramientas +
    gastosCourierPropio +
    gastosMarketing +
    gastosOtros +
    courierIntegrado;
  const utilidadOperativa = utilidadBruta - totalGastosOperativos;
  const margenOperativo =
    ventasBrutas > 0 ? (utilidadOperativa / ventasBrutas) * 100 : 0;
  const comisionPowip = ventasBrutas * powipRate;
  const igvEstimado =
    utilidadOperativa > 0 ? (utilidadOperativa - comisionPowip) * ivaRate : 0;
  const utilidadNeta = utilidadOperativa - comisionPowip - igvEstimado;
  const margenNeto = ventasBrutas > 0 ? (utilidadNeta / ventasBrutas) * 100 : 0;
  return {
    ventasBrutas,
    cogs,
    utilidadBruta,
    margenBruto,
    gastosMarketing,
    gastosPersonal: gastosPlanilla,
    gastosHerramientas,
    gastosCourierPropio,
    gastosOtros,
    feesMarketplace,
    courierIntegrado,
    mermaUnidades: merma.totalUnidades,
    mermaCosto: merma.costoEstimado,
    totalGastosOperativos,
    utilidadOperativa,
    margenOperativo,
    comisionPowip,
    igvEstimado,
    utilidadNeta,
    margenNeto,
  };
}
