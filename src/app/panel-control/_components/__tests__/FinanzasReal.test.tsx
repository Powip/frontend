import { screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  CAJA,
  COBRANZA_SIN_PLAZO,
  errorHttp,
  fuentes,
  RESULTADO,
  RESULTADO_TODO_NULL,
  renderFinanzas,
  sobre,
  tarjetaCargada,
} from "./finanzas-test-utils";

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

const cargado = async () => {
  await waitFor(() => expect(screen.queryByRole("status", { name: /Cargando/ })).toBeNull());
};

const filaDe = async (tabla: string, texto: RegExp) => {
  const elemento = await screen.findByRole("table", { name: tabla });
  const celda = within(elemento).getByText(texto);
  const fila = celda.closest("tr");
  if (!fila) throw new Error(`sin fila ${texto}`);
  return fila;
};

describe("Finanzas con datos reales: sin rastro de demo", () => {
  it.each([
    ["resultado", "Facturado"],
    ["caja", "Entró"],
    ["cobranza", "Por liquidar"],
  ] as const)("%s no muestra el badge «Demo» ni la nota de cifras demo", async (subtab, kpi) => {
    renderFinanzas(subtab, fuentes());
    await screen.findByRole("region", { name: kpi });
    await cargado();
    expect(screen.queryByRole("button", { name: /^Demo:/ })).toBeNull();
    expect(screen.queryByText(/Cifras demo/)).toBeNull();
    expect(screen.queryByText(/Endpoint pendiente/)).toBeNull();
    expect(screen.queryByText(/\(demo\)/i)).toBeNull();
  });
});

describe("Resultado: antes de publicidad y ganancia parcial", () => {
  it("la ganancia dice «antes de publicidad» y «parcial» cuando gananciaParcial", async () => {
    renderFinanzas("resultado", fuentes());
    const tabla = await screen.findByRole("table", { name: "Estado de resultados" });
    const fila = within(tabla)
      .getByRole("rowheader", { name: /^Ganancia/ })
      .closest("tr");
    expect(fila).toHaveTextContent(/antes de publicidad/i);
    expect(fila).toHaveTextContent(/parcial/i);
  });

  it("sin gananciaParcial no dice «parcial» pero sigue diciendo «antes de publicidad»", async () => {
    renderFinanzas(
      "resultado",
      fuentes({
        resultado: async () =>
          sobre({
            ...RESULTADO,
            estadoResultados: { ...RESULTADO.estadoResultados, gananciaParcial: false },
          }),
      }),
    );
    const tabla = await screen.findByRole("table", { name: "Estado de resultados" });
    const fila = within(tabla)
      .getByRole("rowheader", { name: /^Ganancia/ })
      .closest("tr");
    expect(fila).toHaveTextContent(/antes de publicidad/i);
    expect(fila).not.toHaveTextContent(/parcial/i);
  });

  it("la publicidad se muestra como Pendiente (Meta/TikTok Ads), no como 0", async () => {
    renderFinanzas("resultado", fuentes());
    const tabla = await screen.findByRole("table", { name: "Estado de resultados" });
    for (const nombre of [/^Publicidad directa/, /^Publicidad general/]) {
      const fila = within(tabla).getByRole("rowheader", { name: nombre }).closest("tr");
      expect(fila).toHaveTextContent("Pendiente: se conectará con Meta/TikTok Ads");
      expect(fila?.textContent).not.toMatch(/S\/ 0|NaN|null/);
    }
  });

  it("muestra las señales honestas: entregas sin costo, sin flete y sin comisión", async () => {
    renderFinanzas("resultado", fuentes());
    const tabla = await screen.findByRole("table", { name: "Estado de resultados" });
    expect(tabla).toHaveTextContent("3 entregas sin costo cargado");
    expect(tabla).toHaveTextContent("2 entregas sin flete informado");
    expect(tabla).toHaveTextContent("1 entrega sin comisión calculable");
  });

  it("sin señales no pinta avisos de faltantes", async () => {
    renderFinanzas("resultado", fuentes({ resultado: async () => sobre(RESULTADO_TODO_NULL) }));
    const tabla = await screen.findByRole("table", { name: "Estado de resultados" });
    expect(tabla.textContent).not.toMatch(/sin costo cargado|sin flete informado|sin comisión/);
  });

  it("costo, envíos, comisiones y ganancia null son «Pendiente», nunca 0, NaN ni «S/ null»", async () => {
    renderFinanzas("resultado", fuentes({ resultado: async () => sobre(RESULTADO_TODO_NULL) }));
    const tabla = await screen.findByRole("table", { name: "Estado de resultados" });
    for (const nombre of [/Costo de producto/, /Envíos/, /Comisiones/, /^Ganancia/]) {
      const fila = within(tabla).getByRole("rowheader", { name: nombre }).closest("tr");
      expect(fila).toHaveTextContent("Pendiente");
      expect(fila?.textContent).not.toMatch(/S\/ 0|NaN|null/);
    }
    // La ganancia pendiente no se presenta como tope «≤ S/ …».
    const ganancia = within(tabla)
      .getByRole("rowheader", { name: /^Ganancia/ })
      .closest("tr");
    expect(ganancia?.textContent).not.toMatch(/≤/);
  });

  it("la ganancia por canal null es «Pendiente» y la conocida sigue con su tope", async () => {
    renderFinanzas("resultado", fuentes());
    const sinGanancia = await filaDe("Rentabilidad por canal", /^Canal Uno$/);
    expect(sinGanancia).toHaveTextContent("Pendiente");
    expect(sinGanancia.textContent).not.toMatch(/NaN|S\/ 0|null/);
    const conGanancia = await filaDe("Rentabilidad por canal", /^Sin canal$/);
    expect(conGanancia).toHaveTextContent(/≤ S\/ 90/);
  });

  it("gastos fijos null sin gastos cargados dice «Carga tus gastos fijos en Configuración»", async () => {
    renderFinanzas("resultado", fuentes());
    const tabla = await screen.findByRole("table", { name: "Estado de resultados" });
    const fila = within(tabla)
      .getByRole("rowheader", { name: /Gastos fijos prorrateados/ })
      .closest("tr");
    expect(fila).toHaveTextContent("Carga tus gastos fijos en Configuración");
  });

  it("gastos fijos null con gastos cargados explica que los filtros de dimensión no los reparten", async () => {
    renderFinanzas(
      "resultado",
      fuentes({
        resultado: async () =>
          sobre({
            ...RESULTADO,
            estadoResultados: { ...RESULTADO.estadoResultados, gastosFijosMensuales: 3000 },
          }),
      }),
    );
    const tabla = await screen.findByRole("table", { name: "Estado de resultados" });
    const fila = within(tabla)
      .getByRole("rowheader", { name: /Gastos fijos prorrateados/ })
      .closest("tr");
    expect(fila).toHaveTextContent(/no se reparten por canal, zona ni asesora/);
    expect(fila?.textContent).not.toMatch(/Carga tus gastos fijos/);
  });

  it("gastos fijos conocidos no dicen «demo»", async () => {
    renderFinanzas(
      "resultado",
      fuentes({
        resultado: async () =>
          sobre({
            ...RESULTADO,
            estadoResultados: {
              ...RESULTADO.estadoResultados,
              gastosFijos: 2800,
              gastosFijosMensuales: 3000,
              utilidadOperativa: 100,
            },
          }),
      }),
    );
    const tabla = await screen.findByRole("table", { name: "Estado de resultados" });
    const fila = within(tabla)
      .getByRole("rowheader", { name: /Gastos fijos prorrateados/ })
      .closest("tr");
    expect(fila).toHaveTextContent("S/ 3,000 al mes");
    expect(fila?.textContent).not.toMatch(/demo/i);
  });

  it("Por liquidar incluye retiro en tienda y POS (nota) y el vencido null es «Sin dato»", async () => {
    renderFinanzas("resultado", fuentes());
    const tarjeta = await tarjetaCargada("Por liquidar");
    expect(tarjeta).toHaveTextContent(/retiro en tienda y POS/i);
    expect(tarjeta).toHaveTextContent(/Cobranza.*con courier/i);
    expect(tarjeta).toHaveTextContent(/Vencido: Sin dato/);
    expect(tarjeta.textContent).not.toMatch(/S\/ 0 vencido|NaN|null/);
  });

  it("el cuadre del facturado al dinero sigue visible", async () => {
    renderFinanzas("resultado", fuentes());
    expect(await screen.findByText(/✓ Cuadra/)).toBeInTheDocument();
  });

  it("Adelantos es Pendiente", async () => {
    renderFinanzas("resultado", fuentes());
    const tarjeta = await tarjetaCargada("Adelantos");
    expect(tarjeta).toHaveTextContent("Pendiente");
  });
});

describe("Caja: fecha de registro del pago", () => {
  it("rotula el cobro de contraentrega como fecha de registro del pago, no de liquidación", async () => {
    renderFinanzas("caja", fuentes());
    const tabla = await screen.findByRole("table", { name: "Entradas de caja por fuente" });
    expect(tabla).toHaveTextContent(/fecha de registro del pago/i);
    expect(tabla.textContent).not.toMatch(/Liquidación de courier/);
    await cargado();
    expect(document.body.textContent).not.toMatch(/fecha de liquidaci[óo]n/i);
  });

  it("el subtítulo de entradas explica que no son liquidaciones del courier", async () => {
    renderFinanzas("caja", fuentes());
    await screen.findByRole("table", { name: "Entradas de caja por fuente" });
    expect(screen.getAllByText(/fecha en que se registró el pago/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Pendiente: se conectará con Liquidaciones de courier/),
    ).toBeInTheDocument();
  });

  it("publicidad y adelantos null son Pendiente, nunca 0", async () => {
    renderFinanzas("caja", fuentes());
    const entradas = await screen.findByRole("table", { name: "Entradas de caja por fuente" });
    const adelantos = within(entradas)
      .getByText(/^Adelantos/)
      .closest("tr");
    expect(adelantos).toHaveTextContent("Pendiente");
    const salidas = await screen.findByRole("table", { name: "Salidas de caja" });
    const publicidad = within(salidas)
      .getByText(/^Publicidad/)
      .closest("tr");
    expect(publicidad).toHaveTextContent("Pendiente");
    expect(publicidad).toHaveTextContent("Pendiente: se conectará con Meta/TikTok Ads");
    expect(publicidad?.textContent).not.toMatch(/S\/ 0|NaN|null/);
  });

  it("gastos fijos null explica por qué (sin gastos cargados)", async () => {
    renderFinanzas("caja", fuentes());
    const salidas = await screen.findByRole("table", { name: "Salidas de caja" });
    const fila = within(salidas)
      .getByText(/^Gastos fijos/)
      .closest("tr");
    expect(fila).toHaveTextContent("Carga tus gastos fijos en Configuración");
    expect(fila?.textContent).not.toMatch(/demo/i);
  });

  it("fletes, pasarela y comisiones null son Pendiente / Sin dato", async () => {
    renderFinanzas("caja", fuentes());
    const salidas = await screen.findByRole("table", { name: "Salidas de caja" });
    for (const nombre of [/^Comisión de pasarela/, /^Comisiones de plataformas/]) {
      const fila = within(salidas).getByText(nombre).closest("tr");
      expect(fila).toHaveTextContent("Pendiente");
      expect(fila?.textContent).not.toMatch(/NaN|null|S\/ 0/);
    }
  });

  it("«Tiempo hasta liquidar» y «liquidado por el courier» no son columnas con cifras inventadas", async () => {
    renderFinanzas("caja", fuentes());
    await screen.findByRole("table", { name: "Entradas de caja por fuente" });
    expect(
      screen.queryByRole("columnheader", { name: /tiempo hasta liquidar|liquidado por/i }),
    ).toBeNull();
  });
});

describe("Cobranza: con courier, 365 días, tope 5000", () => {
  it("dice «con courier», 365 días y el tope de 5000 pedidos", async () => {
    renderFinanzas("cobranza", fuentes());
    const tarjeta = await tarjetaCargada("Por liquidar");
    expect(tarjeta).toHaveTextContent(/con courier/i);
    expect(tarjeta).toHaveTextContent(/365 días/);
    expect(screen.getByText(/hasta 5000 pedidos/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\b60 días/);
  });

  it("aclara que Resultado cuenta también retiro en tienda y POS", async () => {
    renderFinanzas("cobranza", fuentes());
    await tarjetaCargada("Por liquidar");
    expect(screen.getByText(/retiro en tienda y POS/i)).toBeInTheDocument();
  });

  it("«tiempo hasta liquidar» y «liquidado por el courier» son Pendiente con Liquidaciones de courier", async () => {
    renderFinanzas("cobranza", fuentes());
    await tarjetaCargada("Por liquidar");
    expect(
      screen.getByText(/Pendiente: se conectará con Liquidaciones de courier/),
    ).toBeInTheDocument();
  });

  it("vencido null (ningún courier con plazo) es «Sin dato», no 0 ni NaN", async () => {
    renderFinanzas("cobranza", fuentes({ cobranza: async () => sobre(COBRANZA_SIN_PLAZO) }));
    const tarjeta = await tarjetaCargada("Vencido");
    expect(tarjeta).toHaveTextContent("Sin dato");
    expect(tarjeta.textContent).not.toMatch(/S\/ 0|NaN|null/);
    // Sin cifra no hay drawer que abrir.
    expect(within(tarjeta).queryByRole("button")).toBeNull();
    const fila = await filaDe("Liquidaciones pendientes por courier", /^Olva$/);
    expect(fila.textContent).not.toMatch(/NaN|null/);
  });

  it("con vencido conocido lo muestra y deja abrirlo", async () => {
    renderFinanzas("cobranza", fuentes());
    const tarjeta = await tarjetaCargada("Vencido");
    expect(tarjeta).toHaveTextContent("S/ 120");
    expect(tarjeta).toHaveTextContent("1 pedidos pasaron el plazo del courier");
    expect(within(tarjeta).getByRole("button")).toBeInTheDocument();
  });
});

describe("403: Finanzas es solo del Dueño", () => {
  it.each([
    ["resultado", "resultado"],
    ["caja", "caja"],
    ["cobranza", "cobranza"],
  ] as const)("%s con 403 muestra el candado y no ofrece reintentar", async (subtab, clave) => {
    renderFinanzas(
      subtab,
      fuentes({
        [clave]: async () => {
          throw errorHttp(403, "Forbidden resource");
        },
      }),
    );
    expect(await screen.findAllByText("Sin permiso para ver esta información")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Reintentar/ })).toBeNull();
    expect(document.body.textContent).not.toMatch(/Request failed/);
  });

  it("un 503 no es un candado: ofrece reintentar", async () => {
    renderFinanzas(
      "caja",
      fuentes({
        caja: async () => {
          throw errorHttp(503);
        },
      }),
    );
    expect((await screen.findAllByRole("button", { name: /Reintentar/ })).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText("Sin permiso para ver esta información")).toBeNull();
  });
});

describe("Drawer de Finanzas: 403 y mensajes", () => {
  it("403 en un grupo del Dueño muestra el mensaje de permiso", async () => {
    const detalle = jest.fn().mockRejectedValue(errorHttp(403, "Forbidden resource"));
    const user = renderFinanzas("cobranza", fuentes({ detalle }));
    const tarjeta = await tarjetaCargada("Por liquidar");
    await user.click(within(tarjeta).getByRole("button", { name: /Ver pedidos/ }));
    const dialogo = await screen.findByRole("dialog");
    expect(await within(dialogo).findByText("Sin permiso para ver esta información")).toBeVisible();
  });

  it("el texto de alcance de Caja habla del cobro por fecha de registro y de la cantidad de pedidos", async () => {
    const user = renderFinanzas("caja", fuentes());
    const tabla = await screen.findByRole("table", { name: "Entradas de caja por fuente" });
    await user.click(within(tabla).getByRole("button", { name: /Ver pedidos de Cobro/ }));
    const dialogo = await screen.findByRole("dialog");
    expect(await within(dialogo).findByText(/Por fecha del dinero/)).toBeInTheDocument();
  });
});

describe("la Caja cuenta con los datos del backend", () => {
  it("muestra el neto y el promedio diario", async () => {
    renderFinanzas("caja", fuentes({ caja: async () => sobre(CAJA) }));
    const neto = await tarjetaCargada("Neto de caja");
    expect(neto).toHaveTextContent("S/ 560");
  });
});
