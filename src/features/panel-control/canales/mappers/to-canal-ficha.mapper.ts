import type { CanalConfig } from "@/interfaces/IOrder";
import type { CampoFichaCanal, CanalFicha } from "../models/canal-ficha.model";

const CAMPOS_SIN_CONTRATO: CampoFichaCanal[] = [
  "familia",
  "cobro",
  "usaCourier",
  "comisionPct",
  "pasarelaPct",
  "recibePautaGeneral",
  "metaMensual",
  "color",
  "tienePedidos",
];

export function toCanalFicha(config: CanalConfig): CanalFicha {
  const esLead = config.requiereConfirmacionCc || config.flujoEntrada !== "directo_operaciones";
  return {
    id: config.id,
    nombre: config.canalLabel || config.canalNombre,
    clave: config.canalNombre,
    familia: null,
    color: null,
    entrada: esLead ? "lead" : null,
    cobro: null,
    usaCourier: null,
    comisionPct: null,
    pasarelaPct: null,
    recibePautaGeneral: null,
    metaMensual: null,
    activo: config.activo,
    tienePedidos: null,
    reglasPorConfirmar: true,
    camposPendientes: esLead ? CAMPOS_SIN_CONTRATO : ["entrada", ...CAMPOS_SIN_CONTRATO],
  };
}
