import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { DetalleQuery } from "@/features/panel-control/detalle/models/detalle.model";
import type { PanelSubtabId } from "@/features/panel-control/shared/models/panel-navigation.model";
import {
  DETALLE_VACIO,
  fuentes,
  renderOperaciones,
  tarjetaCargada,
} from "./operaciones-test-utils";

jest.mock("sonner", () => ({ toast: { info: jest.fn(), success: jest.fn(), error: jest.fn() } }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

/**
 * Cada disparador de Cola, Couriers e Inventario abre un grupo del drawer con parámetros que el
 * backend valida contra sus enums (`ESTADOS_COLA`, `BUCKETS_ANTIGUEDAD`, `ETAPAS_OPERATIVAS`,
 * `YYYY-MM-DD`, `SIN_MOTIVO`…): una errata daría 400. Los esperados están escritos a mano con los
 * valores de `ms-ventas/src/panel/panel.types.ts` y `panel-detalle.builder.ts`, NO con las
 * constantes del frontend, para que un cambio en cualquiera de los dos lados rompa la prueba.
 */
type Esperado = { grupo: string; params: Record<string, string> };

interface Caso {
  nombre: string;
  subtab: PanelSubtabId;
  abrir: (user: UserEvent) => Promise<void>;
  esperado: Esperado;
}

const botonDeTarjeta = async (tarjeta: string, boton: RegExp) =>
  within(await tarjetaCargada(tarjeta)).getByRole("button", { name: boton });

async function filasDe(tabla: string) {
  const elemento = await screen.findByRole("table", { name: tabla });
  return within(elemento).getAllByRole("row").slice(1);
}

// ── Cola y tiempos ───────────────────────────────────────────────────────────

const ESTADOS_COLA_BACKEND = ["LLAMADO", "PREPARADO", "CON_GUIA", "EN_ENVIO"] as const;
const BUCKETS_BACKEND = ["menos_24h", "1_2d", "3_5d", "mas_5d"] as const;
const ETAPAS_BACKEND = [
  "llamado_preparado",
  "preparado_con_guia",
  "con_guia_en_envio",
  "en_envio_entregado",
  "ciclo_total",
] as const;

const casosMatriz: Caso[] = ESTADOS_COLA_BACKEND.flatMap((estado, fila) => [
  ...BUCKETS_BACKEND.map(
    (antiguedad, columna): Caso => ({
      nombre: `celda ${estado} × ${antiguedad}`,
      subtab: "cola",
      abrir: async (user) => {
        const celdas = (await filasDe("Cola por estado y antigüedad"))[fila];
        await user.click(within(celdas).getAllByRole("button", { name: /Ver pedidos$/ })[columna]);
      },
      esperado: { grupo: "cola_operativa", params: { estado, antiguedad } },
    }),
  ),
  {
    nombre: `total de ${estado}`,
    subtab: "cola",
    abrir: async (user) => {
      const celdas = (await filasDe("Cola por estado y antigüedad"))[fila];
      await user.click(within(celdas).getByRole("button", { name: /en total\. Ver pedidos$/ }));
    },
    esperado: { grupo: "cola_operativa", params: { estado } },
  },
]);

const casosCola: Caso[] = [
  ...casosMatriz,
  {
    nombre: "KPI Cola activa",
    subtab: "cola",
    abrir: async (user) => user.click(await botonDeTarjeta("Cola activa", /Ver pedidos/)),
    esperado: { grupo: "cola_operativa", params: {} },
  },
  {
    // El universo de la tarjeta (venta con courier, > 24 h desde LLAMADO) no es el de
    // `ventas_sin_guia` del Resumen: la Task 15c implementa `sin_guia_24h` con el mismo predicado.
    nombre: "KPI Sin guía +24 h",
    subtab: "cola",
    abrir: async (user) => user.click(await botonDeTarjeta("Sin guía +24 h", /Asignar guía/)),
    esperado: { grupo: "accion", params: { accion: "sin_guia_24h" } },
  },
  {
    nombre: "KPI Envíos retrasados",
    subtab: "cola",
    abrir: async (user) =>
      user.click(await botonDeTarjeta("Envíos retrasados", /Reclamar al courier/)),
    esperado: { grupo: "accion", params: { accion: "envios_retrasados" } },
  },
  {
    nombre: "KPI Días de confirmado a entregado",
    subtab: "cola",
    abrir: async (user) =>
      user.click(await botonDeTarjeta("Días de confirmado a entregado", /Ver los lentos/)),
    esperado: { grupo: "etapa_lenta", params: { etapa: "ciclo_total" } },
  },
  ...ETAPAS_BACKEND.map(
    (etapa, fila): Caso => ({
      nombre: `sobre la meta de ${etapa}`,
      subtab: "cola",
      abrir: async (user) => {
        const celdas = (await filasDe("Tiempo por etapa"))[fila];
        await user.click(within(celdas).getByRole("button", { name: /sobre la meta/ }));
      },
      esperado: { grupo: "etapa_lenta", params: { etapa } },
    }),
  ),
  {
    // Las cifras de la tarjeta son «rechazos con courier»: `envios` con estado RECHAZADO.
    nombre: "KPI Incidencia (rechazo)",
    subtab: "cola",
    abrir: async (user) =>
      user.click(await botonDeTarjeta("Incidencia (rechazo)", /Ver rechazados/)),
    esperado: { grupo: "envios", params: { estado: "RECHAZADO" } },
  },
  {
    nombre: "barra de motivo de rechazo",
    subtab: "cola",
    abrir: async (user) => {
      const lista = await screen.findByRole("list", { name: "Rechazos por motivo" });
      await user.click(within(lista).getByRole("button", { name: /^Cliente no estaba/ }));
    },
    esperado: {
      grupo: "envios",
      params: { estado: "RECHAZADO", tipo: "rechazado", motivo: "Cliente no estaba" },
    },
  },
  {
    nombre: "barra «Sin motivo»",
    subtab: "cola",
    abrir: async (user) => {
      const lista = await screen.findByRole("list", { name: "Rechazos por motivo" });
      await user.click(within(lista).getByRole("button", { name: /^Sin motivo/ }));
    },
    esperado: {
      grupo: "envios",
      params: { estado: "RECHAZADO", tipo: "rechazado", motivo: "Sin motivo" },
    },
  },
  {
    nombre: "barra de despachos por día",
    subtab: "cola",
    abrir: async (user) =>
      user.click(await screen.findByRole("button", { name: /despachados\. Ver pedidos$/ })),
    esperado: { grupo: "despachados_dia", params: { dia_despacho: "2026-09-20" } },
  },
];

// ── Couriers ─────────────────────────────────────────────────────────────────

const filaCourier = async (nombre: RegExp) => {
  const tabla = await screen.findByRole("table", { name: "Rendimiento por courier" });
  return within(tabla).getByRole("button", { name: nombre }).closest("tr") as HTMLTableRowElement;
};

const casosCouriers: Caso[] = [
  {
    nombre: "KPI Envíos",
    subtab: "couriers",
    abrir: async (user) => user.click(await botonDeTarjeta("Envíos", /Ver pedidos/)),
    esperado: { grupo: "envios", params: {} },
  },
  {
    nombre: "KPI Efectividad de entrega",
    subtab: "couriers",
    abrir: async (user) =>
      user.click(await botonDeTarjeta("Efectividad de entrega", /Ver rechazados/)),
    esperado: { grupo: "envios", params: { estado: "RECHAZADO" } },
  },
  {
    nombre: "KPI Días de entrega",
    subtab: "couriers",
    abrir: async (user) => user.click(await botonDeTarjeta("Días de entrega", /Ver entregados/)),
    esperado: { grupo: "entregados", params: {} },
  },
  {
    nombre: "KPI Por liquidar",
    subtab: "couriers",
    abrir: async (user) => user.click(await botonDeTarjeta("Por liquidar", /Ver pedidos/)),
    esperado: { grupo: "por_liquidar_actual", params: {} },
  },
  {
    nombre: "KPI Liquidación vencida",
    subtab: "couriers",
    abrir: async (user) => user.click(await botonDeTarjeta("Liquidación vencida", /Ver pedidos/)),
    esperado: { grupo: "por_liquidar_actual", params: { vencido: "1" } },
  },
  {
    nombre: "nombre del courier",
    subtab: "couriers",
    abrir: async (user) => {
      await user.click(
        within(await filaCourier(/Ver envíos de Shalom/)).getByRole("button", {
          name: /Ver envíos de Shalom/,
        }),
      );
    },
    esperado: { grupo: "envios", params: { courier: "shalom" } },
  },
  {
    nombre: "rechazados del courier",
    subtab: "couriers",
    abrir: async (user) => {
      await user.click(
        within(await filaCourier(/Ver envíos de Shalom/)).getByRole("button", {
          name: /rechazados de Shalom/,
        }),
      );
    },
    esperado: { grupo: "rechazados", params: { courier: "shalom" } },
  },
  {
    nombre: "en tránsito del courier",
    subtab: "couriers",
    abrir: async (user) => {
      await user.click(
        within(await filaCourier(/Ver envíos de Olva/)).getByRole("button", {
          name: /en tránsito de Olva/,
        }),
      );
    },
    esperado: { grupo: "envios", params: { courier: "olva", estado: "EN_ENVIO" } },
  },
  {
    nombre: "por liquidar del courier",
    subtab: "couriers",
    abrir: async (user) => {
      await user.click(
        within(await filaCourier(/Ver envíos de Olva/)).getByRole("button", {
          name: /por liquidar de Olva/,
        }),
      );
    },
    esperado: { grupo: "por_liquidar_actual", params: { courier: "olva" } },
  },
  {
    nombre: "vencido del courier",
    subtab: "couriers",
    abrir: async (user) => {
      await user.click(
        within(await filaCourier(/Ver envíos de Olva/)).getByRole("button", {
          name: /vencido de Olva/,
        }),
      );
    },
    esperado: { grupo: "por_liquidar_actual", params: { courier: "olva", vencido: "1" } },
  },
  {
    nombre: "nombre del departamento",
    subtab: "couriers",
    abrir: async (user) => {
      const tabla = await screen.findByRole("table", { name: "Efectividad por departamento" });
      await user.click(within(tabla).getByRole("button", { name: /Ver envíos a Lima/ }));
    },
    esperado: { grupo: "envios", params: { departamento: "Lima" } },
  },
  {
    nombre: "rechazados del departamento",
    subtab: "couriers",
    abrir: async (user) => {
      const tabla = await screen.findByRole("table", { name: "Efectividad por departamento" });
      await user.click(within(tabla).getByRole("button", { name: /rechazados en Lima/ }));
    },
    esperado: { grupo: "envios", params: { departamento: "Lima", estado: "RECHAZADO" } },
  },
];

// ── Inventario ───────────────────────────────────────────────────────────────

const casosInventario: Caso[] = [
  {
    nombre: "reservado de un producto",
    subtab: "inventario",
    abrir: async (user) => {
      const tabla = await screen.findByRole("table", { name: "Stock y cobertura" });
      await user.click(within(tabla).getByRole("button", { name: /Ver pedidos que reservan/ }));
    },
    esperado: { grupo: "reservados", params: { producto: "var-1" } },
  },
  {
    nombre: "KPI Ventas esperando stock",
    subtab: "inventario",
    abrir: async (user) =>
      user.click(await botonDeTarjeta("Ventas esperando stock", /Avisar al cliente/)),
    esperado: { grupo: "accion", params: { accion: "productos_agotados" } },
  },
];

describe.each([
  ["Cola y tiempos", casosCola],
  ["Couriers", casosCouriers],
  ["Inventario", casosInventario],
])(
  "%s: cada disparador abre el grupo y los parámetros que valida el backend",
  (_pantalla, casos) => {
    it.each(casos.map((caso) => [caso.nombre, caso] as const))("%s", async (_nombre, caso) => {
      const detalle = jest.fn(async (_consulta: DetalleQuery) => DETALLE_VACIO);
      const user = renderOperaciones(caso.subtab, fuentes({ detalle }));
      await caso.abrir(user);
      await waitFor(() => expect(detalle).toHaveBeenCalled());
      const consulta = detalle.mock.calls[0][0];
      expect({ grupo: consulta.grupo, params: JSON.parse(consulta.grupo_params) }).toEqual(
        caso.esperado,
      );
    });
  },
);
