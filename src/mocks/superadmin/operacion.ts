import {
  ICajaCodEmpresa,
  ISunatEmpresa,
  IAlertaFraude,
  IRadarUpsell,
  ISegmentoRed,
  ICourierRed,
} from "@/interfaces/superadmin";
import { daysFromNowISO, money, nextId, daysAgoISO } from "./seed";
import { empresasMock, getUpsellOportunidades } from "./empresas";

export const cajaCodMock: ICajaCodEmpresa[] = empresasMock
  .filter((e) => e.estado === "activo")
  .map((e, i) => ({
    empresaId: e.id,
    empresaNombre: e.nombre,
    gmv: money(i + 1, 5000, 60000),
    codEnTransito: money(i + 4, 800, 12000),
    liquidacionPendiente: money(i + 9, 200, 4000),
    morosidadPct: Math.round(money(i + 2, 0, 8) * 10) / 10,
  }));

export const sunatGlobalMock: ISunatEmpresa[] = empresasMock
  .filter((e) => e.plan !== "Basic" && e.plan !== "Trial")
  .map((e, i) => ({
    empresaId: e.id,
    empresaNombre: e.nombre,
    emite: i % 6 !== 0,
    comprobantesMes: Math.round(money(i, 40, 900)),
    rechazosMes: i % 6 === 0 ? 0 : Math.round(money(i + 3, 0, 12)),
    certificadoVence: i % 5 === 0 ? daysFromNowISO(10 + i) : undefined,
  }));

export const alertasFraudeMock: IAlertaFraude[] = [
  { id: nextId("fraud"), empresaId: empresasMock[3].id, empresaNombre: empresasMock[3].nombre, senal: "% devolución 3.2x sobre la media de su rubro", severidad: "alta", detectadoEn: daysAgoISO(0) },
  { id: nextId("fraud"), empresaId: empresasMock[9].id, empresaNombre: empresasMock[9].nombre, senal: "Pico de 4x pedidos en 24h vs. promedio", severidad: "media", detectadoEn: daysAgoISO(1) },
  { id: nextId("fraud"), empresaId: empresasMock[15].id, empresaNombre: empresasMock[15].nombre, senal: "Descuadre entre adelantos cobrados y entregas confirmadas", severidad: "alta", detectadoEn: daysAgoISO(2) },
];

export const radarUpsellMock: IRadarUpsell[] = empresasMock
  .flatMap((e) => getUpsellOportunidades(e).map((o) => ({
    empresaId: e.id,
    empresaNombre: e.nombre,
    plan: e.plan,
    mrrPotencial: o.mrrPotencial,
    motivo: o.motivo,
    caliente: o.caliente,
  })))
  .filter((o) => o.mrrPotencial > 0)
  .sort((a, b) => b.mrrPotencial - a.mrrPotencial);

export const segmentacionRedMock: ISegmentoRed[] = (() => {
  const map = new Map<string, { count: number; mrr: number }>();
  empresasMock.forEach((e) => {
    const cur = map.get(e.rubro || "Otros") || { count: 0, mrr: 0 };
    cur.count += 1;
    cur.mrr += e.mrr;
    map.set(e.rubro || "Otros", cur);
  });
  return Array.from(map.entries()).map(([rubro, v]) => ({ rubro, ...v }));
})();

export const couriersRedMock: ICourierRed[] = [
  { courier: "Shalom", empresasCount: 14, entregaPct: 91.2, devolucionPct: 6.4 },
  { courier: "Olva Courier", empresasCount: 9, entregaPct: 88.7, devolucionPct: 8.1 },
  { courier: "Marvisur", empresasCount: 6, entregaPct: 93.5, devolucionPct: 4.9 },
  { courier: "Cruz del Sur Cargo", empresasCount: 4, entregaPct: 85.3, devolucionPct: 9.8 },
  { courier: "Chazki", empresasCount: 5, entregaPct: 90.1, devolucionPct: 7.2 },
];
