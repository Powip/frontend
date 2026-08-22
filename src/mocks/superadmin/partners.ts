import {
  IPartner,
  IReferido,
  IComision,
  ILiquidacion,
  IConfigPrograma,
  TipoPartner,
  OpcionComision,
} from "@/interfaces/superadmin";
import { PERSONAS, daysAgoISO, money, nextId } from "./seed";
import { empresasMock } from "./empresas";

const NOMBRES_PARTNER = [
  "Agencia Digital Norte", "Juan Carlos Devs", "Creador @rentaonline", "Consultora Ecommerce PE",
  "Andes Marketing Studio", "María Growth Partner",
];
const TIPOS: TipoPartner[] = ["Agencia", "Developer", "Creador", "Consultor", "Agencia", "Consultor"];
const OPCIONES: OpcionComision[] = ["A", "C", "B", "A", "C", "B"];

export const partnersMock: IPartner[] = NOMBRES_PARTNER.map((nombre, i) => {
  const referidosCount = 3 + i * 4;
  const mrrActivo = money(i + 1, 400, 4200);
  const nivel = mrrActivo >= 1500 ? "Oro" : mrrActivo >= 500 ? "Plata" : "Base";
  return {
    id: `par-${i + 1}`,
    nombre,
    handle: `@${nombre.toLowerCase().replace(/[^a-z0-9]+/g, "")}`,
    tipo: TIPOS[i],
    opcionComision: OPCIONES[i],
    overridePct: i === 4 ? 2 : undefined,
    codigo: `REF-${(i + 1).toString().padStart(3, "0")}`,
    slugLink: `powip.pe/r/${nombre.toLowerCase().split(" ")[0]}`,
    estado: i === 5 ? "pendiente" : i === 4 ? "suspendido" : "activo",
    metodoCobro: i % 2 === 0 ? "Transferencia BCP" : "Yape",
    nivel,
    mrrActivo,
    descuentoPartnerPct: [0, 5, 10, 0, 8, 3][i],
    acuerdo: {
      vigenciaHasta: daysAgoISO(-180),
      exclusividadRubro: i === 0 ? "Cosmética (Lima)" : undefined,
      residualNivel: nivel === "Oro" ? 3 : nivel === "Plata" ? 1.5 : 0,
    },
    referidosCount,
    creadoEn: daysAgoISO(200 - i * 20),
  };
});

export const referidosMock: IReferido[] = partnersMock.flatMap((partner, pi) =>
  Array.from({ length: Math.min(partner.referidosCount, 5) }, (_, i) => {
    const empresa = empresasMock[(pi * 5 + i) % empresasMock.length];
    return {
      id: nextId("ref"),
      partnerId: partner.id,
      partnerNombre: partner.nombre,
      negocio: empresa.nombre,
      email: `contacto@${empresa.dominio}`,
      origen: "Link de partner",
      plan: empresa.plan,
      descuentoPct: partner.descuentoPartnerPct,
      estado: i === 0 ? "pendiente" : i === 1 ? "aprobado" : "activo",
      creadoEn: daysAgoISO(80 - pi * 5 - i * 3),
    };
  })
);

export const comisionesMock: IComision[] = referidosMock.slice(0, 18).map((ref, i) => ({
  id: nextId("com"),
  partnerId: ref.partnerId,
  referidoId: ref.id,
  referidoNombre: ref.negocio,
  tipo: i % 5 === 0 ? "reverso" : i % 3 === 0 ? "primer_mes" : "recurrente",
  periodo: "2026-07",
  base: money(i + 1, 180, 900),
  pct: 40,
  monto: money(i + 2, 60, 360),
  estado: i % 4 === 0 ? "pendiente" : "liquidada",
}));

export const liquidacionesMock: ILiquidacion[] = partnersMock.map((partner, i) => {
  const bruto = money(i + 1, 300, 2600);
  const reversos = money(i + 5, 0, 120);
  const retencion = Math.round((bruto - reversos) * 0.08 * 100) / 100;
  return {
    id: nextId("liq"),
    partnerId: partner.id,
    partnerNombre: partner.nombre,
    ciclo: "2026-07",
    montoBruto: bruto,
    montoReversos: reversos,
    retencion,
    neto: Math.round((bruto - reversos - retencion) * 100) / 100,
    estado: i % 3 === 0 ? "pendiente" : "pagada",
  };
});

export const configProgramaMock: IConfigPrograma = {
  opciones: [
    { id: "A", firstPct: 40, recPct: 6 },
    { id: "B", firstPct: 70, recPct: 3 },
    { id: "C", firstPct: 50, recPct: 8 },
  ],
  descuentoMaxPct: 10,
  ventanaAtribucionDias: 60,
  umbralMinimo: 50,
  retencionPct: 8,
  nivelPlataMrr: 500,
  nivelOroMrr: 1500,
  antiFraude: true,
  clawback: true,
};

export { PERSONAS as _unused };
