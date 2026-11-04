import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { DetalleQuery } from "@/features/panel-control/detalle/models/detalle.model";
import type { PanelSubtabId } from "@/features/panel-control/shared/models/panel-navigation.model";
import { DETALLE_VACIO, fuentes, renderFinanzas, tarjetaCargada } from "./finanzas-test-utils";

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
 * Cada disparador de Finanzas abre un grupo del drawer con parámetros que el backend valida
 * (`PARAMETROS_SOPORTADOS`, `PARAMETROS_DE_GRUPO` de `panel-detalle.builder.ts`): una errata daría 400.
 * Los esperados están escritos a mano con los valores del backend, NO con las constantes del frontend.
 * Cada fila de la tabla es un drill cuyo grupo suma lo mismo que la cifra clicada (ver task-21-report).
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

async function filaDe(tabla: string, texto: RegExp) {
  const elemento = await screen.findByRole("table", { name: tabla });
  const fila = within(elemento).getByText(texto).closest("tr");
  if (!fila) throw new Error(`sin fila ${texto}`);
  return fila;
}

const casosResultado: Caso[] = [
  {
    nombre: "KPI Facturado",
    subtab: "resultado",
    abrir: async (user) => user.click(await botonDeTarjeta("Facturado", /ver pedidos/i)),
    esperado: { grupo: "ventas", params: {} },
  },
  {
    nombre: "KPI Entregado",
    subtab: "resultado",
    abrir: async (user) => user.click(await botonDeTarjeta("Entregado", /ver pedidos/i)),
    esperado: { grupo: "entregados", params: {} },
  },
  {
    nombre: "KPI Pagado",
    subtab: "resultado",
    abrir: async (user) => user.click(await botonDeTarjeta("Pagado", /ver pedidos/i)),
    esperado: { grupo: "cobrado", params: {} },
  },
  {
    // Resultado.porLiquidar cuenta TODO entregado sin pago completo (también retiro en tienda y POS).
    nombre: "KPI Por liquidar",
    subtab: "resultado",
    abrir: async (user) => user.click(await botonDeTarjeta("Por liquidar", /ver pedidos/i)),
    esperado: { grupo: "por_liquidar", params: {} },
  },
  {
    nombre: "KPI En curso",
    subtab: "resultado",
    abrir: async (user) => user.click(await botonDeTarjeta("En curso", /ver pedidos/i)),
    esperado: { grupo: "ventas", params: { estado_cobro: "en_curso" } },
  },
  {
    // perdido + reembolsado = los rechazados (cobro perdido si no pagó, reembolsado si pagó).
    nombre: "KPI Perdido (rechazos + reembolsos)",
    subtab: "resultado",
    abrir: async (user) => user.click(await botonDeTarjeta("Perdido", /Ver rechazados/)),
    esperado: { grupo: "rechazados", params: {} },
  },
  {
    // La fila suma lo ENTREGADO del canal, no todas sus ventas.
    nombre: "rentabilidad: canal Uno",
    subtab: "resultado",
    abrir: async (user) => {
      const fila = await filaDe("Rentabilidad por canal", /^Canal Uno$/);
      await user.click(within(fila).getByRole("button", { name: /Ver entregas de Canal Uno/ }));
    },
    esperado: { grupo: "ventas_canal", params: { canal: "canal-1", operativo: "entregado" } },
  },
  {
    nombre: "rentabilidad: Sin canal",
    subtab: "resultado",
    abrir: async (user) => {
      const fila = await filaDe("Rentabilidad por canal", /^Sin canal$/);
      await user.click(within(fila).getByRole("button", { name: /Ver entregas de Sin canal/ }));
    },
    esperado: { grupo: "ventas_canal", params: { canal: "sin_canal", operativo: "entregado" } },
  },
  ...(
    [
      ["Facturado", "2026-08", {}],
      ["Entregado", "2026-08", { operativo: "entregado" }],
      ["Pagado", "2026-08", { estado_cobro: "pagado" }],
    ] as const
  ).map(
    ([serie, mes, extra]): Caso => ({
      nombre: `evolución ${serie} de ${mes}`,
      subtab: "resultado",
      abrir: async (user) => {
        await user.click(
          await screen.findByRole("button", {
            name: new RegExp(`^${serie}, ago 26: .*Ver pedidos`),
          }),
        );
      },
      esperado: {
        grupo: "ventas_rango",
        params: { desde: `${mes}-01`, hasta: `${mes}-31`, ...extra },
      },
    }),
  ),
];

const casosCaja: Caso[] = [
  {
    nombre: "entrada: cobro de contraentrega",
    subtab: "caja",
    abrir: async (user) => {
      const tabla = await screen.findByRole("table", { name: "Entradas de caja por fuente" });
      await user.click(within(tabla).getByRole("button", { name: /Ver pedidos de Cobro por/ }));
    },
    esperado: { grupo: "movimientos_caja", params: { concepto: "liquidacion_courier" } },
  },
  {
    nombre: "entrada: caja POS",
    subtab: "caja",
    abrir: async (user) => {
      const tabla = await screen.findByRole("table", { name: "Entradas de caja por fuente" });
      await user.click(within(tabla).getByRole("button", { name: /Ver pedidos de Caja POS/ }));
    },
    esperado: { grupo: "movimientos_caja", params: { concepto: "caja_pos" } },
  },
  {
    nombre: "entrada: prepago",
    subtab: "caja",
    abrir: async (user) => {
      const tabla = await screen.findByRole("table", { name: "Entradas de caja por fuente" });
      await user.click(within(tabla).getByRole("button", { name: /Ver pedidos de Prepago/ }));
    },
    esperado: { grupo: "movimientos_caja", params: { concepto: "prepago" } },
  },
  {
    nombre: "salida: fletes",
    subtab: "caja",
    abrir: async (user) => {
      const tabla = await screen.findByRole("table", { name: "Salidas de caja" });
      await user.click(within(tabla).getByRole("button", { name: /Ver pedidos de Fletes/ }));
    },
    esperado: { grupo: "movimientos_caja", params: { concepto: "fletes" } },
  },
  {
    nombre: "salida: reembolsos",
    subtab: "caja",
    abrir: async (user) => {
      const tabla = await screen.findByRole("table", { name: "Salidas de caja" });
      await user.click(within(tabla).getByRole("button", { name: /Ver pedidos de Reembolsos/ }));
    },
    esperado: { grupo: "movimientos_caja", params: { concepto: "reembolsos" } },
  },
];

const casosCobranza: Caso[] = [
  {
    nombre: "KPI Por liquidar",
    subtab: "cobranza",
    abrir: async (user) => user.click(await botonDeTarjeta("Por liquidar", /Ver pedidos/)),
    esperado: { grupo: "por_liquidar_actual", params: {} },
  },
  {
    nombre: "KPI Vencido",
    subtab: "cobranza",
    abrir: async (user) => user.click(await botonDeTarjeta("Vencido", /Ver pedidos/)),
    esperado: { grupo: "por_liquidar_actual", params: { vencido: "1" } },
  },
  {
    nombre: "KPI En curso por cobrar",
    subtab: "cobranza",
    abrir: async (user) => user.click(await botonDeTarjeta("En curso por cobrar", /Ver pedidos/)),
    esperado: { grupo: "por_cobrar_actual", params: {} },
  },
  {
    nombre: "nombre del courier",
    subtab: "cobranza",
    abrir: async (user) => {
      const fila = await filaDe("Liquidaciones pendientes por courier", /^Olva$/);
      await user.click(within(fila).getByRole("button", { name: /Ver lo que Olva no liquida/ }));
    },
    esperado: { grupo: "por_liquidar_actual", params: { courier: "olva" } },
  },
  {
    nombre: "vencido del courier",
    subtab: "cobranza",
    abrir: async (user) => {
      const fila = await filaDe("Liquidaciones pendientes por courier", /^Olva$/);
      await user.click(within(fila).getByRole("button", { name: /vencido de Olva/ }));
    },
    esperado: { grupo: "por_liquidar_actual", params: { courier: "olva", vencido: "1" } },
  },
  ...(
    [
      ["0 – 3 días", "0_3d"],
      ["4 – 7 días", "4_7d"],
      ["8 – 14 días", "8_14d"],
      ["Más de 14 días", "mas_14d"],
    ] as const
  ).map(
    ([etiqueta, bucket]): Caso => ({
      nombre: `antigüedad ${etiqueta}`,
      subtab: "cobranza",
      abrir: async (user) => {
        const lista = await screen.findByRole("list", {
          name: "Por liquidar según días desde la entrega",
        });
        await user.click(within(lista).getByRole("button", { name: new RegExp(`^${etiqueta}`) }));
      },
      esperado: { grupo: "por_liquidar_actual", params: { antiguedad_deuda: bucket } },
    }),
  ),
];

describe.each([
  ["Resultado", casosResultado],
  ["Caja", casosCaja],
  ["Cobranza", casosCobranza],
])(
  "%s: cada disparador abre el grupo y los parámetros que valida el backend",
  (_pantalla, casos) => {
    it.each(casos.map((caso) => [caso.nombre, caso] as const))("%s", async (_nombre, caso) => {
      const detalle = jest.fn(async (_consulta: DetalleQuery) => DETALLE_VACIO);
      const user = renderFinanzas(caso.subtab, fuentes({ detalle }));
      await caso.abrir(user);
      await waitFor(() => expect(detalle).toHaveBeenCalled());
      const consulta = detalle.mock.calls[0][0];
      expect({ grupo: consulta.grupo, params: JSON.parse(consulta.grupo_params) }).toEqual(
        caso.esperado,
      );
    });
  },
);

describe("cifras sin grupo que sume lo mismo: no abren nada", () => {
  it("el KPI «Entró» no abre un drawer (mezclaría entradas y salidas)", async () => {
    renderFinanzas("caja", fuentes());
    const tarjeta = await tarjetaCargada("Entró");
    expect(within(tarjeta).queryByRole("button")).toBeNull();
  });

  it("las barras de dinero por día no abren un drawer", async () => {
    renderFinanzas("caja", fuentes());
    await screen.findByRole("table", { name: "Entradas de caja por fuente" });
    await waitFor(() => expect(screen.queryByRole("status", { name: /Cargando/ })).toBeNull());
    expect(screen.queryByRole("button", { name: /Cobrado el/ })).toBeNull();
    expect(screen.queryByText(/Clic o Enter abre los pedidos/)).toBeNull();
  });

  it("los conceptos sin pedidos (publicidad, adelantos, gastos fijos, pasarela) no son botones", async () => {
    renderFinanzas("caja", fuentes());
    const entradas = await screen.findByRole("table", { name: "Entradas de caja por fuente" });
    expect(within(entradas).queryByRole("button", { name: /Adelantos/ })).toBeNull();
    const salidas = await screen.findByRole("table", { name: "Salidas de caja" });
    for (const nombre of [/Publicidad/, /Comisión de pasarela/, /Gastos fijos/]) {
      expect(within(salidas).queryByRole("button", { name: nombre })).toBeNull();
    }
  });

  it("Adelantos de Resultado y de Cobranza no abren un drawer", async () => {
    renderFinanzas("resultado", fuentes());
    const tarjeta = await tarjetaCargada("Adelantos");
    expect(within(tarjeta).queryByRole("button")).toBeNull();
  });
});
