// Datos de prueba para las pestañas que hoy no tienen NINGUNA fuente real
// (Liquidaciones histórico, Rendición repartidor, Diferencias). No son los
// mismos números que el prototipo viejo de src/components/finanzas — se
// armaron de cero para esta pantalla. Se cargan como estado inicial en
// page.tsx y viven solo en memoria de la sesión.
//
// BACKEND GAP: todo este archivo debería ser reemplazado por llamadas a
// ms-courier una vez existan los endpoints — ver informe de brechas.

import { DiferenciaLiquidacion, PagoLiquidacion, RendicionRepartidor } from "./types";

export const MOCK_REPARTIDORES = ["Carlos Ramírez", "Jhon Quispe", "Miguel Torres"] as const;

export const MOCK_LIQUIDACIONES: PagoLiquidacion[] = [
  {
    id: "LQ-0001",
    fecha: "2026-07-20",
    courier: "Shalom",
    pedidosIds: ["OV-004821", "OV-004833", "OV-004840"],
    montoEsperado: 612.4,
    montoDepositado: 612.4,
    diferencia: 0,
    metodo: "transferencia",
    numeroOperacion: "Op. 44210087",
    observaciones: "Depósito semanal Shalom",
    estado: "CONCILIADA",
  },
  {
    id: "LQ-0002",
    fecha: "2026-07-21",
    courier: "Olva Courier",
    pedidosIds: ["OV-004790", "OV-004802"],
    montoEsperado: 284.0,
    montoDepositado: 260.0,
    diferencia: -24.0,
    metodo: "yape",
    numeroOperacion: "Op. 998211",
    observaciones: "Faltó cubrir un pedido rechazado",
    estado: "CON_DIFERENCIA",
  },
  {
    id: "LQ-0003",
    fecha: "2026-07-23",
    courier: "Marvisur",
    pedidosIds: ["OV-004855"],
    montoEsperado: 145.3,
    montoDepositado: 145.3,
    diferencia: 0,
    metodo: "efectivo",
    observaciones: "Entregado en oficina",
    estado: "CONCILIADA",
  },
  {
    id: "LQ-0004",
    fecha: "2026-07-25",
    courier: "Shalom",
    pedidosIds: ["OV-004860", "OV-004861", "OV-004862", "OV-004863"],
    montoEsperado: 890.75,
    montoDepositado: 890.75,
    diferencia: 0,
    metodo: "transferencia",
    numeroOperacion: "Op. 44219012",
    estado: "CONCILIADA",
  },
];

export const MOCK_DIFERENCIAS: DiferenciaLiquidacion[] = [
  {
    id: "DIF-0001",
    pagoLiquidacionId: "LQ-0002",
    courier: "Olva Courier",
    fecha: "2026-07-21",
    pedidosIds: ["OV-004790", "OV-004802"],
    montoEsperado: 284.0,
    montoDepositado: 260.0,
    diferencia: -24.0,
    estado: "ABIERTA",
  },
  {
    id: "DIF-0002",
    pagoLiquidacionId: "LQ-9990",
    courier: "Flores",
    fecha: "2026-07-15",
    pedidosIds: ["OV-004701"],
    montoEsperado: 98.5,
    montoDepositado: 80.0,
    diferencia: -18.5,
    estado: "RECLAMADA",
  },
  {
    id: "DIF-0003",
    pagoLiquidacionId: "LQ-9985",
    courier: "Shalom",
    fecha: "2026-07-10",
    pedidosIds: ["OV-004622"],
    montoEsperado: 55.0,
    montoDepositado: 40.0,
    diferencia: -15.0,
    estado: "ACEPTADA_PERDIDA",
    motivoAceptacion: "Courier confirmó paquete extraviado, se castiga como pérdida",
  },
];

export const MOCK_RENDICIONES: RendicionRepartidor[] = [
  {
    id: "RD-0001",
    repartidor: "Carlos Ramírez",
    fecha: "2026-07-27",
    pedidosEntregados: 9,
    debioCobrar: 412.5,
    entregoEfectivo: 0,
    diferencia: -412.5,
    estado: "POR_RENDIR",
  },
  {
    id: "RD-0002",
    repartidor: "Jhon Quispe",
    fecha: "2026-07-27",
    pedidosEntregados: 6,
    debioCobrar: 275.0,
    entregoEfectivo: 0,
    diferencia: -275.0,
    estado: "POR_RENDIR",
  },
  {
    id: "RD-0003",
    repartidor: "Carlos Ramírez",
    fecha: "2026-07-26",
    pedidosEntregados: 11,
    debioCobrar: 530.0,
    entregoEfectivo: 530.0,
    diferencia: 0,
    estado: "CUADRADO",
  },
  {
    id: "RD-0004",
    repartidor: "Miguel Torres",
    fecha: "2026-07-26",
    pedidosEntregados: 7,
    debioCobrar: 340.0,
    entregoEfectivo: 310.0,
    diferencia: -30.0,
    estado: "FALTANTE",
    observaciones: "Dice que un cliente pagó con billete falso, en revisión",
  },
  {
    id: "RD-0005",
    repartidor: "Jhon Quispe",
    fecha: "2026-07-25",
    pedidosEntregados: 8,
    debioCobrar: 398.0,
    entregoEfectivo: 398.0,
    diferencia: 0,
    estado: "CUADRADO",
  },
];
