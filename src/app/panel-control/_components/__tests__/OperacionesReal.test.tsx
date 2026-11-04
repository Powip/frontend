import { screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import type { DetalleQuery } from "@/features/panel-control/detalle/models/detalle.model";
import type { PanelSource } from "@/features/panel-control/shared/data/panel-source";
import {
  COURIERS,
  DETALLE_VACIO,
  errorHttp,
  fuentes,
  INVENTARIO,
  INVENTARIO_MULTITIENDA,
  INVENTARIO_SIN_COSTOS,
  renderOperaciones,
  sobre,
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

describe("Operaciones con datos reales: sin rastro de demo", () => {
  it.each([
    ["cola", "Cola activa"],
    ["couriers", "Envíos"],
    ["inventario", "Productos"],
  ] as const)("%s no muestra el badge «Demo» ni la nota de cifras demo", async (subtab, kpi) => {
    renderOperaciones(subtab, fuentes());
    await screen.findByRole("region", { name: kpi });
    await waitFor(() => expect(screen.queryByRole("status", { name: /Cargando/ })).toBeNull());
    expect(screen.queryByRole("button", { name: /^Demo:/ })).toBeNull();
    expect(screen.queryByText(/Cifras demo/)).toBeNull();
    expect(screen.queryByText(/Endpoint pendiente/)).toBeNull();
  });
});

describe("Couriers: fletes sin dato", () => {
  it("el flete promedio sin ningún envío con flete dice «Sin dato» y cuenta los envíos sin flete", async () => {
    renderOperaciones("couriers", fuentes());
    const tarjeta = await tarjetaCargada("Flete promedio");
    expect(tarjeta).toHaveTextContent("Sin dato");
    expect(tarjeta).toHaveTextContent("7 envíos sin flete informado");
    expect(tarjeta.textContent).not.toMatch(/NaN|S\/ 0/);
  });

  it("por courier: el flete null es «Sin dato» y un 0 conocido sigue siendo S/ 0", async () => {
    renderOperaciones("couriers", fuentes());
    const tabla = await screen.findByRole("table", { name: "Rendimiento por courier" });
    const filaShalom = within(tabla)
      .getByRole("button", { name: /Ver envíos de Shalom/ })
      .closest("tr");
    const filaOlva = within(tabla)
      .getByRole("button", { name: /Ver envíos de Olva/ })
      .closest("tr");
    if (!filaShalom || !filaOlva) throw new Error("sin filas");

    // Flete prom., flete total y costo de rechazos: los tres sin dato, ninguno en 0.
    expect(within(filaShalom).getAllByText("Sin dato")).toHaveLength(3);
    expect(filaShalom.textContent).not.toMatch(/NaN/);
    expect(within(filaOlva).queryByText("Sin dato")).toBeNull();
    expect(filaOlva).toHaveTextContent("S/ 15.00");
    expect(filaOlva).toHaveTextContent("S/ 450");
    // Olva no tiene rechazados: su costo de rechazos es un 0 conocido, no «sin dato».
    expect(within(filaOlva).getAllByText("S/ 0")).toHaveLength(1);
  });

  it("sin ningún envío no dice «Ningún envío tiene el flete informado»", async () => {
    renderOperaciones(
      "couriers",
      fuentes({
        couriers: async () =>
          sobre({
            ...COURIERS,
            kpis: { ...COURIERS.kpis, envios: 0, enviosSinFlete: 0 },
            couriers: [],
            departamentos: [],
          }),
      }),
    );
    const tarjeta = await tarjetaCargada("Flete promedio");
    expect(tarjeta).toHaveTextContent("Sin dato");
    expect(tarjeta.textContent).not.toMatch(/Ningún envío/);
  });

  it("el tooltip de «Sin dato» habla de rechazos en el costo de rechazos y de envíos en el flete", async () => {
    renderOperaciones("couriers", fuentes());
    const tabla = await screen.findByRole("table", { name: "Rendimiento por courier" });
    const fila = within(tabla)
      .getByRole("button", { name: /Ver envíos de Shalom/ })
      .closest("tr");
    if (!fila) throw new Error("sin fila");
    const [fletePromedio, fleteTotal, costoRechazos] = within(fila).getAllByText("Sin dato");
    expect(fletePromedio).toHaveAttribute("title", expect.stringMatching(/envío/));
    expect(fleteTotal).toHaveAttribute("title", expect.stringMatching(/envío/));
    expect(costoRechazos).toHaveAttribute("title", expect.stringMatching(/rechazo/));
    expect(fletePromedio.getAttribute("title")).not.toMatch(/rechazo/);
  });

  it("por departamento: el flete promedio null es «Sin dato»", async () => {
    renderOperaciones("couriers", fuentes());
    const tabla = await screen.findByRole("table", { name: "Efectividad por departamento" });
    const fila = within(tabla)
      .getByRole("button", { name: /Ver envíos a Lima/ })
      .closest("tr");
    if (!fila) throw new Error("sin fila");
    expect(within(fila).getByText("Sin dato")).toBeInTheDocument();
  });

  it("por liquidar aclara que mira las entregas de los últimos 365 días", async () => {
    renderOperaciones("couriers", fuentes());
    const tarjeta = await tarjetaCargada("Por liquidar");
    expect(tarjeta).toHaveTextContent(/365 días/);
    expect(tarjeta.textContent).not.toMatch(/\b60 días/);
  });

  it("los rechazos de un departamento abren envíos del departamento en estado RECHAZADO", async () => {
    const detalle = jest.fn(async (_query: DetalleQuery) => DETALLE_VACIO);
    const user = renderOperaciones("couriers", fuentes({ detalle }));
    const tabla = await screen.findByRole("table", { name: "Efectividad por departamento" });
    await user.click(within(tabla).getByRole("button", { name: /Ver 2 rechazados en Lima/ }));
    await screen.findByRole("dialog");
    await waitFor(() => expect(detalle).toHaveBeenCalled());
    const consulta = detalle.mock.calls[0][0];
    expect(consulta.grupo).toBe("envios");
    expect(JSON.parse(consulta.grupo_params)).toEqual({
      departamento: "Lima",
      estado: "RECHAZADO",
    });
  });

  it("las filas de un courier mandan su courierId, no el nombre", async () => {
    const detalle = jest.fn(async (_query: DetalleQuery) => DETALLE_VACIO);
    const user = renderOperaciones("couriers", fuentes({ detalle }));
    const tabla = await screen.findByRole("table", { name: "Rendimiento por courier" });
    await user.click(within(tabla).getByRole("button", { name: /Ver envíos de Shalom/ }));
    await screen.findByRole("dialog");
    await waitFor(() => expect(detalle).toHaveBeenCalled());
    expect(JSON.parse(detalle.mock.calls[0][0].grupo_params)).toEqual({ courier: "shalom" });
  });
});

describe("Inventario: costos y tienda", () => {
  it("el valor al costo se muestra junto a los productos sin costo, para que no se lea como total", async () => {
    renderOperaciones("inventario", fuentes());
    const tarjeta = await tarjetaCargada("Valor al costo");
    expect(tarjeta).toHaveTextContent(/1[.,\s]?500/);
    expect(tarjeta).toHaveTextContent("3 de 4 productos con costo");
    expect(tarjeta).toHaveTextContent("1 sin costo");
    expect(tarjeta).toHaveTextContent("180 días");
  });

  it("sin costos (claves ausentes) no rompe ni muestra S/ 0", async () => {
    renderOperaciones(
      "inventario",
      fuentes({ inventario: async () => sobre(INVENTARIO_SIN_COSTOS) }),
    );
    const tabla = await screen.findByRole("table", { name: "Stock y cobertura" });
    expect(screen.queryByRole("region", { name: "Valor al costo" })).toBeNull();
    expect(within(tabla).getByText("Polo básico")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN|S\/ 0\b/);
    // Sin permiso de costos el backend deja el mapa vacío: «4 sin costo» sería falso (los costos están ocultos).
    expect(await tarjetaCargada("Productos")).not.toHaveTextContent(/sin costo/);
  });

  it("aclara que «Tienda» es donde está el stock", async () => {
    renderOperaciones("inventario", fuentes());
    await screen.findByRole("table", { name: "Stock y cobertura" });
    expect(screen.getByText(/Tienda = donde está el stock/)).toBeInTheDocument();
  });
});

describe("Inventario multitienda", () => {
  it("el mismo producto en varias tiendas son filas distintas y ordenar no las duplica ni las pierde", async () => {
    const errores = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const user = renderOperaciones(
        "inventario",
        fuentes({ inventario: async () => sobre(INVENTARIO_MULTITIENDA) }),
      );
      const tabla = await screen.findByRole("table", { name: "Stock y cobertura" });
      const columnas = within(tabla).getAllByRole("columnheader");
      const encabezado = within(tabla).getByRole("columnheader", { name: /^Stock/ });
      const posicion = columnas.indexOf(encabezado);
      const stocks = () =>
        within(tabla)
          .getAllByRole("row")
          .slice(1)
          .map((fila) => within(fila).getAllByRole("cell")[posicion].textContent);

      expect(stocks()).toEqual(["20", "7", "3", "50"]);

      await user.click(within(encabezado).getByRole("button"));
      expect(stocks()).toEqual(["50", "20", "7", "3"]);
      await user.click(within(encabezado).getByRole("button"));
      expect(stocks()).toEqual(["3", "7", "20", "50"]);

      const avisosDeClave = errores.mock.calls.filter((llamada) =>
        String(llamada[0]).includes("same key"),
      );
      expect(avisosDeClave).toEqual([]);
    } finally {
      errores.mockRestore();
    }
  });
});

describe("Inventario no disponible (503)", () => {
  it("muestra un estado claro con «Reintentar» y al reintentar vuelve a cargar", async () => {
    const inventario = jest
      .fn<ReturnType<PanelSource<"operaciones-inventario">["fetch"]>, []>()
      .mockRejectedValueOnce(errorHttp(503, "Inventario no disponible"))
      .mockResolvedValue(sobre(INVENTARIO));
    const user = renderOperaciones("inventario", fuentes({ inventario }));

    expect(await screen.findByText("Inventario no disponible por ahora")).toBeInTheDocument();
    expect(screen.queryByText(/Request failed with status code/)).toBeNull();
    expect(screen.queryByRole("table", { name: "Stock y cobertura" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("table", { name: "Stock y cobertura" })).toBeInTheDocument();
    expect(screen.queryByText("Inventario no disponible por ahora")).toBeNull();
    expect(inventario).toHaveBeenCalledTimes(2);
  });

  it("no tumba la cola ni los couriers: cada pestaña es su propia petición", async () => {
    const inventario = jest.fn().mockRejectedValue(errorHttp(503, "Inventario no disponible"));
    const user = renderOperaciones("inventario", fuentes({ inventario }));
    await screen.findByText("Inventario no disponible por ahora");

    await user.click(screen.getByRole("tab", { name: "Cola y tiempos" }));
    expect(await tarjetaCargada("Cola activa")).toHaveTextContent("12");
    expect(screen.queryByText("Inventario no disponible por ahora")).toBeNull();

    await user.click(screen.getByRole("tab", { name: "Couriers" }));
    expect(await tarjetaCargada("Envíos")).toHaveTextContent("10");
    expect(screen.queryByText("Inventario no disponible por ahora")).toBeNull();
  });

  it("otro error del inventario (500) sigue siendo un error normal, no «no disponible»", async () => {
    const inventario = jest.fn().mockRejectedValue(errorHttp(500));
    renderOperaciones("inventario", fuentes({ inventario }));
    expect((await screen.findAllByText("No se pudieron cargar los datos")).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText("Inventario no disponible por ahora")).toBeNull();
  });
});

describe("Detalle de pedidos de Operaciones: errores del servidor", () => {
  it("403 en un grupo solo del Dueño: mensaje claro de permiso, no el texto técnico", async () => {
    const detalle = jest.fn().mockRejectedValue(errorHttp(403, "Forbidden resource"));
    const user = renderOperaciones("cola", fuentes({ detalle }));
    await user.click(
      within(await tarjetaCargada("Cola activa")).getByRole("button", { name: /Ver pedidos/ }),
    );
    const dialogo = await screen.findByRole("dialog", { name: /Cola activa/ });
    expect(
      await within(dialogo).findByText("Sin permiso para ver esta información"),
    ).toBeInTheDocument();
    expect(
      within(dialogo).getByText("Tu rol no tiene acceso a esta información."),
    ).toBeInTheDocument();
    expect(within(dialogo).queryByText(/status code/)).toBeNull();
  });

  it("reservados: 404 muestra el texto del servidor y «Reintentar»; el alcance avisa de las varias tiendas", async () => {
    const detalle = jest
      .fn()
      .mockRejectedValue(errorHttp(404, "Ese producto no está en el inventario de tu empresa."));
    const user = renderOperaciones("inventario", fuentes({ detalle }));
    const tabla = await screen.findByRole("table", { name: "Stock y cobertura" });
    await user.click(
      within(tabla).getByRole("button", { name: /Ver pedidos que reservan 5 unidades/ }),
    );
    const dialogo = await screen.findByRole("dialog");
    expect(
      await within(dialogo).findByText("Ese producto no está en el inventario de tu empresa."),
    ).toBeInTheDocument();
    expect(within(dialogo).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(dialogo).toHaveTextContent(/solo respeta la tienda/i);
    expect(JSON.parse(detalle.mock.calls[0][0].grupo_params)).toEqual({ producto: "var-1" });
  });

  it("reservados: 503 (logistics caído) dice que el servicio no está disponible", async () => {
    const detalle = jest.fn().mockRejectedValue(errorHttp(503, "Inventario no disponible"));
    const user = renderOperaciones("inventario", fuentes({ detalle }));
    const tabla = await screen.findByRole("table", { name: "Stock y cobertura" });
    await user.click(
      within(tabla).getByRole("button", { name: /Ver pedidos que reservan 5 unidades/ }),
    );
    const dialogo = await screen.findByRole("dialog");
    expect(
      await within(dialogo).findByText(
        "El servicio no está disponible por ahora. Reintenta en unos minutos.",
      ),
    ).toBeInTheDocument();
  });
});
