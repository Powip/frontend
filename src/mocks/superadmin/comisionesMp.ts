import { ICuentaMp, IComisionFuenteMp, IComisionEmpresaMp, ILiquidacionMp, ModoCuentaMp } from "@/interfaces/superadmin";
import { daysAgoISO, money, nextId } from "./seed";
import { empresasMock } from "./empresas";

/** Solo negocios fuera de Trial tienen Mercado Pago conectado — mismo criterio que
 * getIntegracionesEmpresa() en empresas.ts (`Mercado Pago: conectada: plan !== "Trial"`). */
const EMPRESAS_CON_MP = empresasMock.filter((e) => e.plan !== "Trial");

const COMISION_PCT = 0.005;

export const cuentasMpMock: ICuentaMp[] = EMPRESAS_CON_MP.map((emp, i) => {
  const modo: ModoCuentaMp = i % 4 === 0 ? "powip_temporal" : "propia";
  return {
    empresaId: emp.id,
    empresaNombre: emp.nombre,
    mpEmail: modo === "propia" ? `${emp.dominio?.split(".")[0] ?? "negocio"}@gmail.com` : undefined,
    modo,
    activa: emp.estado !== "inactivo",
    yapeMpActivo: true,
    yapeDirectoActivo: i % 5 === 0,
    conectadaEn: modo === "propia" ? daysAgoISO(30 + i * 4) : undefined,
  };
});

export const comisionesPorFuenteMpMock: IComisionFuenteMp[] = [
  { fuente: "Cobros deuda link", pct: 68 },
  { fuente: "Upsell pre-despacho", pct: 22 },
  { fuente: "Catálogo / recompra", pct: 10 },
];

export const comisionesPorEmpresaMpMock: IComisionEmpresaMp[] = cuentasMpMock
  .filter((c) => c.activa)
  .map((cuenta, i) => {
    const gmvMp = money(i + 11, 1200, 28000);
    return {
      empresaId: cuenta.empresaId,
      empresaNombre: cuenta.empresaNombre,
      modo: cuenta.modo,
      gmvMp,
      comisionPct: COMISION_PCT,
      comisionMonto: Math.round(gmvMp * COMISION_PCT * 100) / 100,
    };
  });

/** Solo negocios en modo powip_temporal generan cola de liquidación (§5.7 — el 100% de
 * su cobro entra a la cuenta de Powip y se liquida el 99.5% manual cada lunes). */
export const liquidacionesMpMock: ILiquidacionMp[] = cuentasMpMock
  .filter((c) => c.modo === "powip_temporal")
  .map((cuenta, i) => {
    const comisionEmpresa = comisionesPorEmpresaMpMock.find((c) => c.empresaId === cuenta.empresaId);
    const montoBruto = comisionEmpresa?.gmvMp ?? money(i + 5, 800, 6000);
    const comisionPowip = Math.round(montoBruto * COMISION_PCT * 100) / 100;
    const pagada = i % 3 === 0;
    return {
      id: nextId("liq-mp"),
      empresaId: cuenta.empresaId,
      empresaNombre: cuenta.empresaNombre,
      periodo: "2026-08",
      montoBruto,
      comisionPowip,
      neto: Math.round((montoBruto - comisionPowip) * 100) / 100,
      estado: pagada ? "pagada" : "pendiente",
      nroOperacion: pagada ? `OP-${800000 + i}` : undefined,
      ejecutadaEn: pagada ? daysAgoISO(2 + i) : undefined,
    };
  });
