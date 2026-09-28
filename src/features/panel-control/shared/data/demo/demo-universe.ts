import type { EstadoCobro, EstadoPanel } from "../../models/estado-pedido.model";
import {
  catalogoClave,
  type PanelCatalogo,
  type RolAsesor,
} from "../../models/panel-catalog.model";
import type {
  CobroCanal,
  EntradaCanal,
  TurnoPanel,
  ZonaPanel,
} from "../../models/panel-filters.model";
import { addDays, dayKeyToUtcMidnight, toLimaDayKey } from "../../utils/lima-time";
import { createRandom, hashSeed, type RandomFn, randomInt } from "./seeded-random";

const HORA = 3_600_000;
const DIA = 24 * HORA;
const OFFSET_LIMA = 5 * HORA;
export const DIAS_UNIVERSO_DEMO = 400;
export const SIN_MOTIVO = "Sin motivo";
export const COURIER_SIN_PLAZO = "Courier demo C";

export type EstadoOperativo =
  | "pendiente"
  | "preparado"
  | "con_guia"
  | "en_envio"
  | "entregado"
  | "rechazado";

export type FamiliaDemo =
  | "Online COD"
  | "Live"
  | "Conversacional"
  | "Plataforma aliada"
  | "Online prepago"
  | "Presencial"
  | "Marketplace";

export interface ProductoDemo {
  id: string;
  sku: string;
  baseId: string;
  baseNombre: string;
  variante: string | null;
  nombre: string;
  categoria: string;
  tiendaId: string;
  precio: number;
  costo: number | null;
  stock: number;
}

export interface CanalDemo {
  id: string;
  nombre: string;
  familia: FamiliaDemo;
  entrada: EntradaCanal;
  cobro: CobroCanal;
  usaCourier: boolean;
  comisionPct: number;
  pasarelaPct: number;
  pautaDirecta: boolean;
  recibePautaGeneral: boolean;
  esLive: boolean;
  metaMensual: number;
  reglasPorConfirmar: boolean;
  peso: number;
}

export interface ItemDemo {
  productoId: string;
  cantidad: number;
  precioLista: number;
  descuento: number;
  neto: number;
  esUpsell: boolean;
}

export interface SesionLiveDemo {
  id: string;
  tiendaId: string;
  canalId: string;
  dia: string;
  inicio: number;
  fin: number;
  inversion: number;
}

export interface PautaDemo {
  dia: string;
  tiendaId: string;
  canalId: string | null;
  sesionId: string | null;
  monto: number;
}

export interface PedidoDemo {
  id: string;
  numero: string;
  ts: number;
  dia: string;
  tiendaId: string;
  canalId: string | null;
  canalNombre: string | null;
  canalCierreNombre: string | null;
  sesionId: string | null;
  entrada: EntradaCanal;
  cobro: CobroCanal;
  usaCourier: boolean;
  zona: ZonaPanel;
  turno: TurnoPanel | null;
  departamento: string;
  asesorId: string | null;
  asesorNombre: string | null;
  clienteId: string;
  clienteNombre: string;
  listaNegra: boolean;
  items: ItemDemo[];
  cupon: string | null;
  metodoPago: string;
  unidades: number;
  neto: number;
  comisionPct: number;
  pasarelaPct: number;
  courier: string | null;
  plazoLiquidacionDias: number | null;
  tiempoNormalDias: number | null;
  fleteBase: number;
  fleteIdaYVuelta: boolean;
  leadConfirmado: boolean;
  contactado: boolean;
  tPrimerIntento: number | null;
  tLead: number | null;
  motivoAnulacion: string | null;
  tConf: number | null;
  tPrep: number | null;
  tGuia: number | null;
  tDesp: number | null;
  tEnt: number | null;
  tCobro: number | null;
  rechazo: boolean;
  motivoRechazo: string | null;
  primerIntento: boolean | null;
  duplicadoDe: string | null;
}

export interface EstadoDemo {
  estado: EstadoPanel;
  operativo: EstadoOperativo | null;
  cobro: EstadoCobro;
  venta: boolean;
  leadAbierto: boolean;
  sinIntento: boolean;
  vencido: boolean;
  flete: number;
}

export interface UniversoDemo {
  inicio: string;
  pedidos: PedidoDemo[];
  productos: ProductoDemo[];
  canales: CanalDemo[];
  sesiones: SesionLiveDemo[];
  pauta: PautaDemo[];
  primeraCompra: Map<string, number>;
}

const DEPARTAMENTOS: [string, number][] = [
  ["Lima", 46],
  ["Callao", 6],
  ["Arequipa", 8],
  ["La Libertad", 7],
  ["Piura", 6],
  ["Cusco", 5],
  ["Lambayeque", 5],
  ["Junín", 4],
  ["Ica", 4],
];

const MOTIVOS_ANULACION = [
  "No contesta (3 intentos)",
  "Cliente desistió",
  "Precio / envío caro",
  "Datos falsos o broma",
  "Fuera de cobertura",
  "Sin stock",
];

export const MOTIVO_DUPLICADO = "Duplicado";

const MOTIVOS_RECHAZO = [
  "No contesta al courier",
  "Rechazó al recibir",
  "No tenía dinero",
  "Dirección errada",
  "Ausente / reprogramó sin éxito",
];

interface PlantillaFamilia {
  entrada: EntradaCanal;
  cobro: CobroCanal;
  usaCourier: boolean;
  comisionPct: number;
  pasarelaPct: number;
  pautaDirecta: boolean;
  recibePautaGeneral: boolean;
  esLive: boolean;
  reglasPorConfirmar: boolean;
  peso: number;
  pautaDiaria: number;
  cupon: { codigo: string; pct: number; prob: number } | null;
}

const PLANTILLAS: Record<FamiliaDemo, PlantillaFamilia> = {
  "Online COD": {
    entrada: "lead",
    cobro: "cod",
    usaCourier: true,
    comisionPct: 0,
    pasarelaPct: 0,
    pautaDirecta: true,
    recibePautaGeneral: true,
    esLive: false,
    reglasPorConfirmar: false,
    peso: 30,
    pautaDiaria: 160,
    cupon: { codigo: "QUANTITY DISCOUNT", pct: 0.1, prob: 0.38 },
  },
  Live: {
    entrada: "lead",
    cobro: "cod",
    usaCourier: true,
    comisionPct: 0,
    pasarelaPct: 0,
    pautaDirecta: false,
    recibePautaGeneral: true,
    esLive: true,
    reglasPorConfirmar: false,
    peso: 17,
    pautaDiaria: 0,
    cupon: { codigo: "LIVE15", pct: 0.15, prob: 0.45 },
  },
  Conversacional: {
    entrada: "directa",
    cobro: "cod",
    usaCourier: true,
    comisionPct: 0,
    pasarelaPct: 0,
    pautaDirecta: true,
    recibePautaGeneral: true,
    esLive: false,
    reglasPorConfirmar: false,
    peso: 16,
    pautaDiaria: 60,
    cupon: null,
  },
  "Plataforma aliada": {
    entrada: "directa",
    cobro: "cod",
    usaCourier: true,
    comisionPct: 0.08,
    pasarelaPct: 0,
    pautaDirecta: false,
    recibePautaGeneral: false,
    esLive: false,
    reglasPorConfirmar: true,
    peso: 7,
    pautaDiaria: 0,
    cupon: null,
  },
  "Online prepago": {
    entrada: "directa",
    cobro: "pre",
    usaCourier: true,
    comisionPct: 0,
    pasarelaPct: 0.0399,
    pautaDirecta: true,
    recibePautaGeneral: true,
    esLive: false,
    reglasPorConfirmar: false,
    peso: 6,
    pautaDiaria: 30,
    cupon: { codigo: "BIENVENIDA10", pct: 0.1, prob: 0.3 },
  },
  Presencial: {
    entrada: "presencial",
    cobro: "inm",
    usaCourier: false,
    comisionPct: 0,
    pasarelaPct: 0,
    pautaDirecta: false,
    recibePautaGeneral: false,
    esLive: false,
    reglasPorConfirmar: false,
    peso: 7,
    pautaDiaria: 0,
    cupon: null,
  },
  Marketplace: {
    entrada: "directa",
    cobro: "mkp",
    usaCourier: true,
    comisionPct: 0.12,
    pasarelaPct: 0,
    pautaDirecta: false,
    recibePautaGeneral: false,
    esLive: false,
    reglasPorConfirmar: false,
    peso: 3,
    pautaDiaria: 0,
    cupon: null,
  },
};

const CANALES_RESPALDO: { id: string; nombre: string; familia: FamiliaDemo }[] = [
  { id: "demo-shopify", nombre: "Shopify COD (demo)", familia: "Online COD" },
  { id: "demo-tiktok", nombre: "TikTok Live (demo)", familia: "Live" },
  { id: "demo-whatsapp", nombre: "WhatsApp (demo)", familia: "Conversacional" },
  { id: "demo-instagram", nombre: "Instagram (demo)", familia: "Conversacional" },
  { id: "demo-aliada", nombre: "Plataforma aliada (demo)", familia: "Plataforma aliada" },
  { id: "demo-web", nombre: "Web prepago (demo)", familia: "Online prepago" },
  { id: "demo-pos", nombre: "POS Tienda (demo)", familia: "Presencial" },
  { id: "demo-mkp", nombre: "Marketplace (demo)", familia: "Marketplace" },
];

const ROTACION_DIRECTOS: FamiliaDemo[] = [
  "Online prepago",
  "Conversacional",
  "Plataforma aliada",
  "Conversacional",
  "Marketplace",
];

const FAMILIA_POR_NOMBRE: [RegExp, FamiliaDemo, "lead" | "directa"][] = [
  [/live|tiktok/i, "Live", "lead"],
  [/shopify|cod|contraentrega|landing/i, "Online COD", "lead"],
  [/whats|insta|messenger|facebook|chat/i, "Conversacional", "directa"],
  [/marketplace|mercado|falabella|ripley|amazon|linio/i, "Marketplace", "directa"],
  [/aliad|partner|rappi|pedidosya/i, "Plataforma aliada", "directa"],
  [/prepago|web|woo|tienda online/i, "Online prepago", "directa"],
];

function familiaPorNombre(nombre: string, entrada: string | null): FamiliaDemo | null {
  const tipo = entrada === "lead" ? "lead" : "directa";
  return (
    FAMILIA_POR_NOMBRE.find(
      ([patron, , requerida]) => requerida === tipo && patron.test(nombre),
    )?.[1] ?? null
  );
}

function weightedPick<T>(random: RandomFn, items: [T, number][]): T {
  const total = items.reduce((sum, [, peso]) => sum + peso, 0);
  let umbral = random() * total;
  for (const [item, peso] of items) {
    umbral -= peso;
    if (umbral <= 0) return item;
  }
  return items[items.length - 1][0];
}

function construirCanal(id: string, nombre: string, familia: FamiliaDemo): CanalDemo {
  const plantilla = PLANTILLAS[familia];
  const hash = hashSeed(id);
  return {
    id,
    nombre,
    familia,
    entrada: plantilla.entrada,
    cobro: plantilla.cobro,
    usaCourier: plantilla.usaCourier,
    comisionPct: plantilla.comisionPct,
    pasarelaPct: plantilla.pasarelaPct,
    pautaDirecta: plantilla.pautaDirecta,
    recibePautaGeneral: plantilla.recibePautaGeneral,
    esLive: plantilla.esLive,
    reglasPorConfirmar: plantilla.reglasPorConfirmar,
    metaMensual: Math.round((plantilla.peso * 1600 + (hash % 12) * 1000) / 1000) * 1000,
    peso: plantilla.peso + (hash % 4),
  };
}

function canalesDemo(catalogo: PanelCatalogo): CanalDemo[] {
  if (!catalogo.canales.length) {
    return CANALES_RESPALDO.map((canal) => construirCanal(canal.id, canal.nombre, canal.familia));
  }
  const ordenados = [...catalogo.canales].sort((a, b) => hashSeed(a.id) - hashSeed(b.id));
  const porNombre = new Map(
    ordenados.map((canal) => [canal.id, familiaPorNombre(canal.nombre, canal.entrada)]),
  );
  let hayLive = [...porNombre.values()].includes("Live");
  let leads = 0;
  let directos = 0;
  return ordenados.map((canal) => {
    let familia: FamiliaDemo;
    const sugerida = porNombre.get(canal.id) ?? null;
    if (canal.entrada === "presencial") {
      familia = "Presencial";
    } else if (sugerida) {
      familia = sugerida;
    } else if (canal.entrada === "lead") {
      familia = leads === 1 && !hayLive ? "Live" : "Online COD";
      if (familia === "Live") hayLive = true;
      leads += 1;
    } else {
      familia = ROTACION_DIRECTOS[directos % ROTACION_DIRECTOS.length];
      directos += 1;
    }
    return construirCanal(canal.id, canal.nombre, familia);
  });
}

function productosDemo(tiendas: { id: string; nombre: string }[]): ProductoDemo[] {
  const categorias = ["Categoría demo 1", "Categoría demo 2", "Categoría demo 3"];
  return tiendas.flatMap((tienda, tiendaIndex) => {
    const sufijoTienda = tiendas.length > 1 ? ` · ${tienda.nombre}` : "";
    return ["A", "B", "C", "D", "E", "F"].flatMap((letra, index) => {
      const hash = hashSeed(`${tienda.id}|${letra}`);
      const precio = 39 + (hash % 19) * 10;
      const costo = index === 5 ? null : Math.round(precio * (0.3 + (hash % 15) / 100));
      const baseId = `demo-${tiendaIndex + 1}-${letra}`;
      const baseNombre = `Producto demo ${letra}${sufijoTienda}`;
      const stocks = [
        0,
        3,
        tiendaIndex === 0 ? -2 : 6,
        40 + (hash % 60),
        90 + (hash % 120),
        150 + (hash % 200),
      ];
      const base: ProductoDemo = {
        id: baseId,
        sku: `SKU-${tiendaIndex + 1}${letra}`,
        baseId,
        baseNombre,
        variante: null,
        nombre: baseNombre,
        categoria: categorias[index % categorias.length],
        tiendaId: tienda.id,
        precio,
        costo,
        stock: stocks[index],
      };
      if (index !== 3) return [base];
      return [
        base,
        {
          ...base,
          id: `${baseId}-L`,
          sku: `SKU-${tiendaIndex + 1}${letra}-L`,
          variante: "Talla L",
          nombre: `${baseNombre} · Talla L`,
          stock: 2,
        },
      ];
    });
  });
}

interface ClienteDemo {
  id: string;
  nombre: string;
  departamento: string;
  rechazos: number[];
}

function diaDeSesion(indiceDia: number, tiendaIndex: number): boolean {
  return [1, 3, 5, 6].includes((indiceDia + tiendaIndex) % 7);
}

function metodoPago(random: RandomFn, cobro: CobroCanal): string {
  if (cobro === "pre")
    return weightedPick(random, [
      ["Tarjeta", 68],
      ["Yape", 32],
    ]);
  if (cobro === "inm")
    return weightedPick(random, [
      ["Efectivo", 38],
      ["Yape", 36],
      ["Tarjeta", 26],
    ]);
  if (cobro === "mkp") return "Marketplace";
  return weightedPick(random, [
    ["Yape", 58],
    ["Efectivo", 24],
    ["Plin", 12],
    ["Transferencia", 6],
  ]);
}

function generarUniverso(catalogo: PanelCatalogo, hoy: string, now: number): UniversoDemo {
  const random = createRandom(`universo|${catalogoClave(catalogo)}|${hoy}`);
  const tiendas = catalogo.tiendas.length
    ? catalogo.tiendas
    : [{ id: "demo-tienda", nombre: "Tienda demo" }];
  const asesores = catalogo.asesores.length
    ? catalogo.asesores
    : Array.from({ length: 6 }, (_, index) => ({
        id: index < 3 ? `demo-confirmadora-${index + 1}` : `demo-vendedora-${index - 2}`,
        nombre: index < 3 ? `Confirmadora demo ${index + 1}` : `Vendedora demo ${index - 2}`,
        rol: (index < 3 ? "confirmadora" : "vendedora") as RolAsesor,
      }));
  const conRol = (rol: RolAsesor) => {
    const conEseRol = asesores.filter((asesor) => asesor.rol === rol);
    return conEseRol.length ? conEseRol : asesores;
  };
  const identidadPropia =
    catalogo.asesores.length === 1 ? (catalogo.asesores[0].rol ?? null) : null;
  const equipoDemo = (rol: RolAsesor) => {
    const propio = identidadPropia === rol ? asesores : [];
    return [
      ...propio,
      ...[1, 2].map((numero) => ({
        id: `demo-${rol}-equipo-${numero}`,
        nombre: `Compañera demo ${numero}`,
        rol,
      })),
    ];
  };
  const confirmadoras = identidadPropia ? equipoDemo("confirmadora") : conRol("confirmadora");
  const vendedoras = identidadPropia ? equipoDemo("vendedora") : conRol("vendedora");
  const canales = canalesDemo(catalogo);
  const canalLive = canales.find((canal) => canal.esLive) ?? null;
  const canalRespaldoLive =
    canales.find((canal) => canal.familia === "Conversacional") ??
    canales.find((canal) => !canal.esLive && canal.entrada !== "presencial") ??
    null;
  const productos = productosDemo(tiendas);
  const clientes: ClienteDemo[] = [];
  const pedidos: PedidoDemo[] = [];
  const sesiones: SesionLiveDemo[] = [];
  const pauta: PautaDemo[] = [];
  const primeraCompra = new Map<string, number>();
  const inicio = addDays(hoy, -DIAS_UNIVERSO_DEMO);
  let secuencia = 10000;

  for (let offset = 0; offset <= DIAS_UNIVERSO_DEMO; offset += 1) {
    const dia = addDays(inicio, offset);
    const inicioDia = dayKeyToUtcMidnight(dia) + OFFSET_LIMA;
    const fraccionDia = dia === hoy ? Math.max(0, Math.min(1, (now - inicioDia) / DIA)) : 1;
    const diaSemana = new Date(dayKeyToUtcMidnight(dia)).getUTCDay();
    const crecimiento = 1 + (offset / DIAS_UNIVERSO_DEMO) * 0.25;

    const sesionesDia = new Map<string, SesionLiveDemo>();
    tiendas.forEach((tienda, tiendaIndex) => {
      pauta.push({
        dia,
        tiendaId: tienda.id,
        canalId: null,
        sesionId: null,
        monto: Math.round(55 * (0.8 + random() * 0.4) * crecimiento * fraccionDia),
      });
      for (const canal of canales) {
        if (!canal.pautaDirecta) continue;
        pauta.push({
          dia,
          tiendaId: tienda.id,
          canalId: canal.id,
          sesionId: null,
          monto: Math.round(
            PLANTILLAS[canal.familia].pautaDiaria *
              (0.8 + random() * 0.4) *
              crecimiento *
              fraccionDia,
          ),
        });
      }
      if (canalLive && diaDeSesion(offset, tiendaIndex)) {
        const inicioSesion =
          inicioDia + randomInt(random, 19, 20) * HORA + randomInt(random, 0, 1) * 30 * 60_000;
        if (inicioSesion <= now) {
          const sesion: SesionLiveDemo = {
            id: `demo-live-${tiendaIndex + 1}-${dia}`,
            tiendaId: tienda.id,
            canalId: canalLive.id,
            dia,
            inicio: inicioSesion,
            fin: inicioSesion + randomInt(random, 90, 150) * 60_000,
            inversion: randomInt(random, 8, 20) * 10,
          };
          sesiones.push(sesion);
          sesionesDia.set(tienda.id, sesion);
          pauta.push({
            dia,
            tiendaId: tienda.id,
            canalId: canalLive.id,
            sesionId: sesion.id,
            monto: sesion.inversion,
          });
        }
      }
    });

    const cantidad = Math.round(
      (diaSemana === 0 ? 30 : diaSemana === 6 ? 36 : 44) * crecimiento * (0.85 + random() * 0.3),
    );

    for (let index = 0; index < cantidad; index += 1) {
      const tienda = tiendas[randomInt(random, 0, tiendas.length - 1)];
      const sinCanal = random() < 0.02;
      let canal = weightedPick(
        random,
        canales.map((item) => [item, item.peso] as [CanalDemo, number]),
      );
      let sesion: SesionLiveDemo | null = null;
      let ts = inicioDia + randomInt(random, 8, 22) * HORA + randomInt(random, 0, 59) * 60_000;
      if (canal.esLive) {
        sesion = sesionesDia.get(tienda.id) ?? null;
        if (sesion) ts = sesion.inicio + random() * (sesion.fin - sesion.inicio + 40 * 60_000);
        else if (canalRespaldoLive) canal = canalRespaldoLive;
      }
      const entrada: EntradaCanal = sinCanal ? "directa" : canal.entrada;
      const cobro: CobroCanal = sinCanal ? "cod" : canal.cobro;
      const usaCourier = sinCanal ? true : canal.usaCourier;

      let cliente: ClienteDemo;
      if (clientes.length > 50 && random() < 0.12) {
        cliente = clientes[randomInt(random, 0, clientes.length - 1)];
      } else {
        cliente = {
          id: `demo-cliente-${clientes.length + 1}`,
          nombre: `Cliente demo ${clientes.length + 1}`,
          departamento: usaCourier ? weightedPick(random, DEPARTAMENTOS) : "Lima",
          rechazos: [],
        };
        clientes.push(cliente);
      }
      const departamento = usaCourier ? cliente.departamento : "Lima";
      const zona: ZonaPanel =
        departamento === "Lima" || departamento === "Callao" ? "lima" : "provincia";
      const listaNegra = cliente.rechazos.some((instante) => instante < ts);

      const productosTienda = productos.filter((producto) => producto.tiendaId === tienda.id);
      const plantilla = sinCanal ? null : PLANTILLAS[canal.familia];
      const cupon = plantilla?.cupon && random() < plantilla.cupon.prob ? plantilla.cupon : null;
      const items: ItemDemo[] = [];
      const lineas = random() < 0.22 ? 2 : 1;
      for (let linea = 0; linea < lineas; linea += 1) {
        const producto = productosTienda[randomInt(random, 0, productosTienda.length - 1)];
        const cantidadItem = random() < 0.15 ? 2 : 1;
        const lista = producto.precio * cantidadItem;
        const descuento = cupon ? Math.round(lista * cupon.pct) : 0;
        items.push({
          productoId: producto.id,
          cantidad: cantidadItem,
          precioLista: producto.precio,
          descuento,
          neto: lista - descuento,
          esUpsell: false,
        });
      }

      const esLead = entrada === "lead";
      let tPrimerIntento: number | null = null;
      let tLead: number | null = null;
      let leadConfirmado = false;
      let motivoAnulacion: string | null = null;
      let contactado = true;
      let tConf: number | null = ts;
      if (esLead) {
        const minutos = 5 + random() * random() * 180;
        tPrimerIntento = ts + minutos * 60_000;
        leadConfirmado = random() < 0.64 - (listaNegra ? 0.25 : 0);
        tLead = tPrimerIntento + (leadConfirmado ? random() * 20 : 2 + random() * 46) * HORA;
        if (!leadConfirmado) {
          motivoAnulacion =
            random() < 0.08
              ? null
              : MOTIVOS_ANULACION[randomInt(random, 0, MOTIVOS_ANULACION.length - 1)];
          contactado = !motivoAnulacion?.startsWith("No contesta") && random() < 0.6;
        }
        tConf = leadConfirmado ? tLead : null;
      }

      const automatico = cobro === "pre" && random() < 0.7;
      const asesor =
        entrada === "presencial"
          ? vendedoras[0]
          : automatico || cobro === "mkp"
            ? null
            : esLead
              ? confirmadoras[randomInt(random, 0, confirmadoras.length - 1)]
              : vendedoras[randomInt(random, 0, vendedoras.length - 1)];

      const conUpsell =
        (esLead && leadConfirmado && random() < 0.28) ||
        (!esLead && entrada === "directa" && asesor !== null && random() < 0.14);
      if (conUpsell) {
        const opciones = [...productosTienda].sort((a, b) => a.precio - b.precio).slice(0, 2);
        const producto = opciones[randomInt(random, 0, opciones.length - 1)];
        const descuento = Math.round(producto.precio * 0.2);
        items.push({
          productoId: producto.id,
          cantidad: 1,
          precioLista: producto.precio,
          descuento,
          neto: producto.precio - descuento,
          esUpsell: true,
        });
      }
      const neto = items.reduce((total, item) => total + item.neto, 0);
      const unidades = items.reduce((total, item) => total + item.cantidad, 0);

      let courier: string | null = null;
      let plazo: number | null = null;
      let tiempoNormal: number | null = null;
      let tPrep: number | null = null;
      let tGuia: number | null = null;
      let tDesp: number | null = null;
      let tEnt: number | null = null;
      let tCobro: number | null = null;
      let rechazo = false;
      let motivoRechazo: string | null = null;
      let fleteBase = 0;
      let turno: TurnoPanel | null = null;
      let primerIntento: boolean | null = false;

      if (tConf !== null) {
        if (!usaCourier) {
          tEnt = tConf;
          tCobro = tConf;
          primerIntento = true;
        } else {
          const lima = zona === "lima";
          const marketplace = cobro === "mkp";
          const sorteo = random();
          courier = marketplace
            ? "Fulfillment marketplace"
            : lima
              ? "Motorizado demo"
              : sorteo < 0.55
                ? "Courier demo A"
                : sorteo < 0.85
                  ? "Courier demo B"
                  : COURIER_SIN_PLAZO;
          plazo = marketplace
            ? 14
            : lima
              ? 1
              : courier === "Courier demo A"
                ? 5
                : courier === "Courier demo B"
                  ? 7
                  : null;
          tiempoNormal = marketplace
            ? 4
            : lima
              ? 1.2
              : courier === "Courier demo A"
                ? 6
                : courier === "Courier demo B"
                  ? 5
                  : null;
          turno = lima && !marketplace && random() < 0.35 ? "express" : "general";
          tPrep = tConf + (2 + random() * 16 + (random() < 0.05 ? 30 + random() * 60 : 0)) * HORA;
          tGuia = tPrep + (1 + random() * 8) * HORA;
          tDesp = tGuia + (turno === "express" ? 1 : 3 + random() * 20) * HORA;
          const dias = marketplace
            ? 1 + random() * 3
            : lima
              ? 0.3 + random() * 0.9
              : 2 + random() * 4 + (random() < 0.07 ? 3 + random() * 4 : 0);
          tEnt = tDesp + dias * DIA;
          const probRechazo =
            (marketplace ? 0.04 : lima ? 0.12 : 0.25) +
            (listaNegra ? 0.2 : 0) -
            (cobro === "pre" ? 0.1 : 0) +
            (canal.esLive ? 0.05 : 0);
          rechazo = random() < Math.max(0.02, probRechazo);
          if (rechazo) {
            motivoRechazo = MOTIVOS_RECHAZO[randomInt(random, 0, MOTIVOS_RECHAZO.length - 1)];
            cliente.rechazos.push(tEnt);
            primerIntento = marketplace ? null : false;
          } else {
            const alPrimero = random() < 0.82;
            primerIntento = marketplace ? null : alPrimero;
          }
          fleteBase = marketplace ? 0 : lima ? randomInt(random, 9, 14) : randomInt(random, 12, 20);
          tCobro =
            cobro === "pre"
              ? tConf
              : marketplace
                ? tEnt + 14 * DIA
                : tEnt + (lima ? random() : 3 + random() * 9) * DIA;
        }
      }

      const metodo = metodoPago(random, cobro);
      const otroCanal = canales.find(
        (item) => item.id !== canal.id && item.familia === "Conversacional",
      );
      const cerradoPorOtro = esLead && leadConfirmado && !!otroCanal && random() < 0.15;

      if (ts > now) continue;

      const pedido: PedidoDemo = {
        id: `demo-${secuencia}`,
        numero: `DEMO-${secuencia}`,
        ts,
        dia,
        tiendaId: tienda.id,
        canalId: sinCanal ? null : canal.id,
        canalNombre: sinCanal ? null : canal.nombre,
        canalCierreNombre: cerradoPorOtro ? (otroCanal?.nombre ?? null) : null,
        sesionId: sinCanal ? null : (sesion?.id ?? null),
        entrada,
        cobro,
        usaCourier,
        zona,
        turno,
        departamento,
        asesorId: asesor?.id ?? null,
        asesorNombre: asesor?.nombre ?? null,
        clienteId: cliente.id,
        clienteNombre: cliente.nombre,
        listaNegra,
        items,
        cupon: cupon?.codigo ?? null,
        metodoPago: metodo,
        unidades,
        neto,
        comisionPct: sinCanal ? 0 : canal.comisionPct,
        pasarelaPct: sinCanal ? 0 : canal.pasarelaPct,
        courier,
        plazoLiquidacionDias: plazo,
        tiempoNormalDias: tiempoNormal,
        fleteBase,
        fleteIdaYVuelta: zona === "provincia",
        leadConfirmado,
        contactado,
        tPrimerIntento,
        tLead,
        motivoAnulacion,
        tConf,
        tPrep,
        tGuia,
        tDesp,
        tEnt,
        tCobro,
        rechazo,
        motivoRechazo,
        primerIntento,
        duplicadoDe: null,
      };
      secuencia += 1;
      pedidos.push(pedido);
      if (tConf !== null && !primeraCompra.has(cliente.id)) primeraCompra.set(cliente.id, ts);

      if (esLead) {
        const aux = createRandom(`duplicado|${pedido.id}`);
        if (aux() < 0.035) {
          const tsDuplicado = ts + (10 + aux() * 600) * 60_000;
          if (tsDuplicado <= now) {
            const tIntento = tsDuplicado + (3 + aux() * 50) * 60_000;
            const confirmadora = confirmadoras[randomInt(aux, 0, confirmadoras.length - 1)];
            pedidos.push({
              ...pedido,
              id: `demo-${secuencia}`,
              numero: `DEMO-${secuencia}`,
              ts: tsDuplicado,
              dia: toLimaDayKey(tsDuplicado),
              canalCierreNombre: null,
              turno: null,
              asesorId: confirmadora.id,
              asesorNombre: confirmadora.nombre,
              listaNegra: cliente.rechazos.some((instante) => instante < tsDuplicado),
              items: pedido.items.filter((item) => !item.esUpsell),
              neto: pedido.items
                .filter((item) => !item.esUpsell)
                .reduce((total, item) => total + item.neto, 0),
              unidades: pedido.items
                .filter((item) => !item.esUpsell)
                .reduce((total, item) => total + item.cantidad, 0),
              courier: null,
              plazoLiquidacionDias: null,
              tiempoNormalDias: null,
              fleteBase: 0,
              leadConfirmado: false,
              contactado: false,
              tPrimerIntento: tIntento,
              tLead: tIntento + (0.2 + aux()) * HORA,
              motivoAnulacion: MOTIVO_DUPLICADO,
              tConf: null,
              tPrep: null,
              tGuia: null,
              tDesp: null,
              tEnt: null,
              tCobro: null,
              rechazo: false,
              motivoRechazo: null,
              primerIntento: null,
              duplicadoDe: pedido.id,
            });
            secuencia += 1;
          }
        }
      }
    }
  }

  return { inicio, pedidos, productos, canales, sesiones, pauta, primeraCompra };
}

const cache = new Map<string, UniversoDemo>();

export function obtenerUniversoDemo(catalogo: PanelCatalogo, now: number): UniversoDemo {
  const hoy = toLimaDayKey(now);
  const clave = `${hoy}|${Math.floor(now / HORA)}|${catalogoClave(catalogo)}`;
  const existente = cache.get(clave);
  if (existente) return existente;
  const universo = generarUniverso(catalogo, hoy, now);
  if (cache.size > 6) cache.clear();
  cache.set(clave, universo);
  return universo;
}

export function estadoDemoEn(pedido: PedidoDemo, t: number): EstadoDemo {
  const base: EstadoDemo = {
    estado: "PENDIENTE",
    operativo: null,
    cobro: "no_aplica",
    venta: false,
    leadAbierto: false,
    sinIntento: false,
    vencido: false,
    flete: 0,
  };

  if (pedido.entrada === "lead") {
    if (pedido.tLead === null || t < pedido.tLead) {
      return {
        ...base,
        leadAbierto: true,
        sinIntento: pedido.tPrimerIntento === null || t < pedido.tPrimerIntento,
      };
    }
    if (!pedido.leadConfirmado) return { ...base, estado: "ANULADO" };
  }

  if (!pedido.usaCourier) {
    return { ...base, estado: "PAGADO", operativo: "entregado", cobro: "pagado", venta: true };
  }

  const { tPrep, tGuia, tDesp, tEnt, tCobro } = pedido;
  let operativo: EstadoOperativo;
  if (tPrep === null || t < tPrep) operativo = "pendiente";
  else if (tGuia === null || t < tGuia) operativo = "preparado";
  else if (tDesp === null || t < tDesp) operativo = "con_guia";
  else if (tEnt === null || t < tEnt) operativo = "en_envio";
  else operativo = pedido.rechazo ? "rechazado" : "entregado";

  let cobro: EstadoCobro;
  let vencido = false;
  if (pedido.cobro === "pre") cobro = operativo === "rechazado" ? "reembolsado" : "pagado";
  else if (operativo === "entregado") {
    if (tCobro !== null && t >= tCobro) cobro = "pagado";
    else {
      cobro = "por_liquidar";
      vencido =
        tEnt !== null &&
        pedido.plazoLiquidacionDias !== null &&
        t > tEnt + pedido.plazoLiquidacionDias * DIA;
    }
  } else if (operativo === "rechazado") cobro = "perdido";
  else cobro = "en_curso";

  const flete =
    tDesp !== null && t >= tDesp
      ? pedido.fleteBase * (operativo === "rechazado" && pedido.fleteIdaYVuelta ? 2 : 1)
      : 0;

  const estadoOperativo: Record<EstadoOperativo, EstadoPanel> = {
    pendiente: "LLAMADO",
    preparado: "PREPARADO",
    con_guia: "CON_GUIA",
    en_envio: "EN_ENVIO",
    rechazado: "RECHAZADO",
    entregado: cobro === "pagado" ? "PAGADO" : "ENTREGADO",
  };

  return {
    ...base,
    estado: estadoOperativo[operativo],
    operativo,
    cobro,
    venta: true,
    vencido,
    flete,
  };
}

export const OPERATIVOS_EN_CURSO: EstadoOperativo[] = [
  "pendiente",
  "preparado",
  "con_guia",
  "en_envio",
];

export function costoPedido(
  pedido: PedidoDemo,
  productos: Map<string, ProductoDemo>,
): { costo: number; completo: boolean } {
  let costo = 0;
  let completo = true;
  for (const item of pedido.items) {
    const unitario = productos.get(item.productoId)?.costo ?? null;
    if (unitario === null) completo = false;
    else costo += unitario * item.cantidad;
  }
  return { costo, completo };
}

export function comisionPedido(pedido: PedidoDemo): number {
  return Math.round(pedido.neto * (pedido.comisionPct + pedido.pasarelaPct) * 100) / 100;
}
