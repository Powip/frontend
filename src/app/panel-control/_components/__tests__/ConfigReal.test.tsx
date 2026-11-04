import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { renderWithPanel } from "@/components/panel-control/__tests__/render-with-panel";
import * as api from "@/features/panel-control/configuracion/api/config.api";
import type { PanelSourceRegistry } from "@/features/panel-control/shared/data/panel-source";
import type {
  PanelSubtabId,
  PanelTabId,
} from "@/features/panel-control/shared/models/panel-navigation.model";
import type { PanelRole } from "@/features/panel-control/shared/models/panel-role.model";
import { DEFAULT_PANEL_STATE } from "@/features/panel-control/shared/state/panel-state.model";
import { PanelShell } from "../shell/PanelShell";
import { COMISIONES, COURIERS, fuentesConfig, GASTOS, METAS_REALES } from "./config-test-utils";

jest.mock("sonner", () => ({ toast: { info: jest.fn(), success: jest.fn(), error: jest.fn() } }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("@/features/panel-control/configuracion/api/config.api", () => ({
  putConfigMetas: jest.fn(),
  putConfigComisiones: jest.fn(),
  putConfigGastosFijos: jest.fn(),
  putConfigCouriers: jest.fn(),
  putFichaCanal: jest.fn(),
  getConfigMetas: jest.fn(),
  getConfigComisiones: jest.fn(),
  getConfigGastosFijos: jest.fn(),
  getConfigCouriers: jest.fn(),
}));

const put = jest.mocked(api);

function errorHttp(status: number, message: unknown) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: { message } },
  });
}

function tarjeta(titulo: string): HTMLElement {
  return screen.getByRole("heading", { name: titulo }).closest("section") as HTMLElement;
}

function renderConfig(
  subtab: PanelSubtabId,
  options: { role?: PanelRole; sources?: PanelSourceRegistry; tab?: PanelTabId } = {},
) {
  const user = userEvent.setup();
  renderWithPanel(<PanelShell />, {
    role: options.role ?? "dueno",
    sources: options.sources ?? fuentesConfig(),
    state: {
      ...DEFAULT_PANEL_STATE,
      navigation: { tab: options.tab ?? "configuracion", subtab },
    },
  });
  return user;
}

beforeEach(() => {
  jest.clearAllMocks();
  put.putConfigMetas.mockResolvedValue(METAS_REALES);
  put.putConfigComisiones.mockResolvedValue(COMISIONES);
  put.putConfigGastosFijos.mockResolvedValue(GASTOS);
  put.putConfigCouriers.mockResolvedValue(COURIERS);
  put.putFichaCanal.mockResolvedValue({ id: "canal-1" });
});

describe("Configuración · Metas", () => {
  it("Guardar envía únicamente las metas modificadas (porcentaje como fracción)", async () => {
    const user = renderConfig("metas");
    const confirmados = await screen.findByRole("textbox", { name: "Meta de Confirmados" });
    expect(confirmados).toHaveValue("65");
    await user.clear(confirmados);
    await user.type(confirmados, "70");
    const canal = screen.getByRole("textbox", {
      name: "Meta mensual por canal (S/): Canal real 1",
    });
    await user.clear(canal);
    await user.type(canal, "3500");
    await user.click(screen.getByRole("button", { name: /Guardar \(2\)/ }));
    await waitFor(() => expect(put.putConfigMetas).toHaveBeenCalledTimes(1));
    expect(put.putConfigMetas.mock.calls[0][0]).toEqual({
      indicadores: { confirmacion: 0.7 },
      porCanal: { "canal-1": 3500 },
    });
  });

  it("una meta nueva para una vendedora sin meta se envía; vacía no se envía", async () => {
    const user = renderConfig("metas");
    const conf = await screen.findByRole("textbox", {
      name: "Meta mensual por confirmadora (confirmados): Asesora Uno",
    });
    expect(conf).toHaveValue("");
    expect(screen.getByRole("button", { name: /Guardar/ })).toBeDisabled();
    await user.type(conf, "40");
    await user.click(screen.getByRole("button", { name: /Guardar \(1\)/ }));
    await waitFor(() => expect(put.putConfigMetas).toHaveBeenCalledTimes(1));
    expect(put.putConfigMetas.mock.calls[0][0]).toEqual({ porConfirmadora: { "asesora-1": 40 } });
  });

  it("un porcentaje 101 no se envía y muestra el error", async () => {
    const user = renderConfig("metas");
    const campo = await screen.findByRole("textbox", { name: "Meta de Confirmados" });
    await user.clear(campo);
    await user.type(campo, "101");
    expect(screen.getByRole("alert")).toHaveTextContent("Máximo 100 %");
    const guardar = screen.getByRole("button", { name: /Guardar/ });
    expect(guardar).toBeDisabled();
    await user.click(guardar);
    expect(put.putConfigMetas).not.toHaveBeenCalled();
  });

  it("un número negativo tampoco se envía", async () => {
    const user = renderConfig("metas");
    const campo = await screen.findByRole("textbox", { name: "Meta de Tiempo a 1ª llamada" });
    await user.clear(campo);
    await user.type(campo, "-3");
    expect(screen.getByRole("alert")).toHaveTextContent("Debe ser un número ≥ 0");
    expect(screen.getByRole("button", { name: /Guardar/ })).toBeDisabled();
  });

  it("un 400 del backend se muestra arriba y no pierde lo tipeado", async () => {
    put.putConfigMetas.mockRejectedValueOnce(
      errorHttp(400, ["indicadores: ids conocidos y valores numéricos ≥ 0"]),
    );
    const user = renderConfig("metas");
    const campo = await screen.findByRole("textbox", { name: "Meta de Confirmados" });
    await user.clear(campo);
    await user.type(campo, "70");
    await user.click(screen.getByRole("button", { name: /Guardar \(1\)/ }));
    const lista = await screen.findByRole("list", { name: "No se pudo guardar" });
    expect(lista).toHaveTextContent("indicadores: ids conocidos y valores numéricos ≥ 0");
    expect(screen.getByRole("textbox", { name: "Meta de Confirmados" })).toHaveValue("70");
    expect(screen.getByRole("button", { name: /Guardar \(1\)/ })).toBeEnabled();
  });

  it("tras guardar se vuelve a pedir lo del panel (invalida los datos que dependen)", async () => {
    let lecturas = 0;
    const sources = fuentesConfig({
      "config-metas": {
        contractId: "config-metas",
        kind: "real",
        descripcion: "x",
        fetch: async () => {
          lecturas += 1;
          return METAS_REALES;
        },
      },
    });
    const user = renderConfig("metas", { sources });
    const campo = await screen.findByRole("textbox", { name: "Meta de Confirmados" });
    expect(lecturas).toBe(1);
    await user.clear(campo);
    await user.type(campo, "70");
    await user.click(screen.getByRole("button", { name: /Guardar \(1\)/ }));
    await waitFor(() => expect(lecturas).toBe(2));
  });

  it("la pantalla de Config no se monta para Confirmadora ni Vendedora", async () => {
    for (const role of ["confirmadora", "vendedora"] as const) {
      const fetchMetas = jest.fn();
      const sources = fuentesConfig({
        "config-metas": {
          contractId: "config-metas",
          kind: "real",
          descripcion: "x",
          fetch: fetchMetas,
        },
      });
      const { unmount } = (() => {
        const user = userEvent.setup();
        void user;
        return renderWithPanel(<PanelShell />, {
          role,
          sources,
          state: {
            ...DEFAULT_PANEL_STATE,
            navigation: { tab: "configuracion", subtab: "metas" },
          },
        });
      })();
      expect(screen.queryByRole("tab", { name: "Metas" })).toBeNull();
      expect(screen.queryByRole("textbox", { name: "Meta de Confirmados" })).toBeNull();
      expect(fetchMetas).not.toHaveBeenCalled();
      unmount();
    }
  });
});

describe("Configuración · Comisiones y costos", () => {
  it("las comisiones son exactamente los conceptos de la regla y se guardan en 0..100", async () => {
    const user = renderConfig("costos");
    const confirm = await screen.findByRole("region", { name: "Confirmadoras" });
    expect(within(confirm).getAllByRole("textbox")).toHaveLength(2);
    expect(
      within(confirm).getByRole("textbox", { name: "Pago por pedido entregado (Confirmadoras)" }),
    ).toHaveValue("1.5");
    expect(
      within(confirm).getByRole("textbox", { name: "Comisión por upsell (Confirmadoras)" }),
    ).toHaveValue("10");
    const vend = screen.getByRole("region", { name: "Vendedoras" });
    expect(within(vend).getAllByRole("textbox")).toHaveLength(2);
    const pagado = within(vend).getByRole("textbox", {
      name: "Comisión sobre lo pagado (Vendedoras)",
    });
    await user.clear(pagado);
    await user.type(pagado, "2.5");
    const upsell = within(vend).getByRole("textbox", { name: "Comisión por upsell (Vendedoras)" });
    await user.type(upsell, "5");
    const entrega = within(confirm).getByRole("textbox", {
      name: "Pago por pedido entregado (Confirmadoras)",
    });
    await user.clear(entrega);
    await user.type(entrega, "2");
    const guardar = screen.getAllByRole("button", { name: /Guardar \(3\)/ })[0];
    await user.click(guardar);
    await waitFor(() => expect(put.putConfigComisiones).toHaveBeenCalledTimes(1));
    expect(put.putConfigComisiones.mock.calls[0][0]).toEqual([
      { rol: "confirmadora", concepto: "por_entrega", valor: 2 },
      { rol: "vendedora", concepto: "pct_pagado", valor: 2.5 },
      { rol: "vendedora", concepto: "pct_upsell", valor: 5 },
    ]);
  });

  it("una comisión de 101 % no se envía", async () => {
    const user = renderConfig("costos");
    const vend = await screen.findByRole("region", { name: "Vendedoras" });
    const campo = within(vend).getByRole("textbox", {
      name: "Comisión sobre lo pagado (Vendedoras)",
    });
    await user.clear(campo);
    await user.type(campo, "101");
    expect(within(vend).getByRole("alert")).toHaveTextContent("Máximo 100 %");
    await user.click(screen.getAllByRole("button", { name: /Guardar/ })[0]);
    expect(put.putConfigComisiones).not.toHaveBeenCalled();
  });

  it("el gasto fijo de una tienda se guarda solo si cambió", async () => {
    const user = renderConfig("costos");
    const campo = await screen.findByRole("textbox", {
      name: "Gasto fijo mensual de Tienda Uno",
    });
    expect(campo).toHaveValue("1200");
    await user.clear(campo);
    await user.type(campo, "1500");
    const tarj = tarjeta("Gastos fijos por tienda");
    await user.click(within(tarj).getByRole("button", { name: /Guardar \(1\)/ }));
    await waitFor(() => expect(put.putConfigGastosFijos).toHaveBeenCalledTimes(1));
    expect(put.putConfigGastosFijos.mock.calls[0][0]).toEqual([
      { storeId: "tienda-1", montoMensual: 1500 },
    ]);
  });

  it("plazos de courier: solo lo cambiado, vaciar borra con null y un courier nuevo lleva nombre", async () => {
    const user = renderConfig("costos");
    const plazo = await screen.findByRole("textbox", { name: "Días de liquidación de Olva" });
    await user.clear(plazo);
    await user.type(plazo, "10");
    await user.clear(screen.getByRole("textbox", { name: "Días de entrega normal de Olva" }));
    await user.type(screen.getByRole("textbox", { name: "Clave del courier nuevo" }), "urbano");
    await user.click(screen.getByRole("button", { name: "Agregar courier" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre del courier urbano" }), "Urbano");
    await user.type(screen.getByRole("textbox", { name: "Días de liquidación de Urbano" }), "5");
    const tarj = tarjeta("Plazos de courier");
    await user.click(within(tarj).getByRole("button", { name: /Guardar/ }));
    await waitFor(() => expect(put.putConfigCouriers).toHaveBeenCalledTimes(1));
    expect(put.putConfigCouriers.mock.calls[0][0]).toEqual([
      { key: "olva", plazoLiquidacionDias: 10, tiempoNormalDias: null },
      { key: "urbano", nombre: "Urbano", plazoLiquidacionDias: 5 },
    ]);
  });

  it("un 400 del backend en gastos fijos se muestra y conserva el valor tipeado", async () => {
    put.putConfigGastosFijos.mockRejectedValueOnce(
      errorHttp(400, "La tienda no pertenece a tu empresa."),
    );
    const user = renderConfig("costos");
    const campo = await screen.findByRole("textbox", { name: "Gasto fijo mensual de Tienda Uno" });
    await user.clear(campo);
    await user.type(campo, "900");
    const tarj = tarjeta("Gastos fijos por tienda");
    await user.click(within(tarj).getByRole("button", { name: /Guardar \(1\)/ }));
    expect(await screen.findByText("La tienda no pertenece a tu empresa.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Gasto fijo mensual de Tienda Uno" })).toHaveValue(
      "900",
    );
  });
});

describe("Configuración · Ficha de canal", () => {
  it("muestra la comisión como 0..100 y el PUT recibe solo lo cambiado en 0..100", async () => {
    const user = renderConfig("canales");
    await user.click(await screen.findByRole("button", { name: "Editar ficha de Canal real 1" }));
    const dialogo = await screen.findByRole("dialog", { name: /Ficha de Canal real 1/ });
    expect(within(dialogo).getByRole("textbox", { name: "Comisión de la plataforma" })).toHaveValue(
      "12.5",
    );
    expect(within(dialogo).getByRole("textbox", { name: "Comisión de la pasarela" })).toHaveValue(
      "3.5",
    );
    const pasarela = within(dialogo).getByRole("textbox", { name: "Comisión de la pasarela" });
    await user.clear(pasarela);
    await user.type(pasarela, "4");
    await user.selectOptions(
      within(dialogo).getByRole("combobox", { name: "Tipo de bloque" }),
      "live",
    );
    await user.click(within(dialogo).getByRole("button", { name: /Guardar ficha \(2\)/ }));
    await waitFor(() => expect(put.putFichaCanal).toHaveBeenCalledTimes(1));
    expect(put.putFichaCanal).toHaveBeenCalledWith("canal-1", { tipo: "live", pctPasarela: 4 });
  });

  it("un porcentaje de ficha de 101 no se envía; un 400 se muestra sin cerrar el diálogo", async () => {
    put.putFichaCanal.mockRejectedValueOnce(
      errorHttp(400, ["pctComision must not be greater than 100"]),
    );
    const user = renderConfig("canales");
    await user.click(await screen.findByRole("button", { name: "Editar ficha de Canal real 1" }));
    const dialogo = await screen.findByRole("dialog");
    const comision = within(dialogo).getByRole("textbox", { name: "Comisión de la plataforma" });
    await user.clear(comision);
    await user.type(comision, "101");
    expect(within(dialogo).getByRole("button", { name: /Guardar ficha/ })).toBeDisabled();
    await user.clear(comision);
    await user.type(comision, "20");
    await user.click(within(dialogo).getByRole("button", { name: /Guardar ficha \(1\)/ }));
    expect(
      await within(dialogo).findByText("pctComision must not be greater than 100"),
    ).toBeInTheDocument();
    expect(within(dialogo).getByRole("textbox", { name: "Comisión de la plataforma" })).toHaveValue(
      "20",
    );
  });

  it("la tabla muestra tipo y plazo de depósito reales y la comisión como porcentaje", async () => {
    renderConfig("canales");
    const fila = (await screen.findByRole("cell", { name: /Canal real 1/ })).closest("tr");
    expect(within(fila as HTMLElement).getByText("12.5%")).toBeInTheDocument();
    expect(within(fila as HTMLElement).getByText("7 días")).toBeInTheDocument();
  });
});

describe("Configuración · Estados y Cuadres reales", () => {
  it("Estados cuenta los pedidos del sobre del backend", async () => {
    renderConfig("estados");
    expect(
      await screen.findByRole("button", { name: /^Entregado: 6 pedidos\. Ver pedidos$/ }),
    ).toBeInTheDocument();
  });

  it("Cuadres: stock negativo null se muestra como sin dato y se listan los avisos", async () => {
    renderConfig("cuadres");
    const stock = await screen.findByRole("region", { name: "Productos con stock negativo" });
    expect(stock).toHaveTextContent("Sin dato");
    expect(stock).not.toHaveTextContent("Ninguno");
    expect(screen.getByRole("list", { name: "Avisos de calidad" })).toHaveTextContent(
      "ms-logistics no respondió",
    );
  });
});
