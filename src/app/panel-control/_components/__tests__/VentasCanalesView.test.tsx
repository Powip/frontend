import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import {
  renderWithPanel,
  TEST_SOURCES,
} from "@/components/panel-control/__tests__/render-with-panel";
import {
  canalesComparativoDemoSource,
  canalesDetalleDemoSource,
} from "@/features/panel-control/canales/sources/canales.demo";
import { clientesZonasDemoSource } from "@/features/panel-control/clientes-zonas/sources/clientes-zonas.demo";
import { detalleDemoSource } from "@/features/panel-control/detalle/sources/detalle.demo";
import { productosDemoSource } from "@/features/panel-control/productos/sources/productos.demo";
import { publicidadDemoSource } from "@/features/panel-control/publicidad/sources/publicidad.demo";
import type {
  PanelSource,
  PanelSourceRegistry,
} from "@/features/panel-control/shared/data/panel-source";
import type { PanelSubtabId } from "@/features/panel-control/shared/models/panel-navigation.model";
import type { PanelRole } from "@/features/panel-control/shared/models/panel-role.model";
import { DEFAULT_PANEL_STATE } from "@/features/panel-control/shared/state/panel-state.model";
import { PanelShell } from "../shell/PanelShell";

const toastInfo = jest.fn();
jest.mock("sonner", () => ({
  toast: { info: (...args: unknown[]) => toastInfo(...args), success: jest.fn(), error: jest.fn() },
}));

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

const ENTRADAS = [
  "lead",
  "lead",
  "directa",
  "directa",
  "directa",
  "directa",
  "directa",
  "presencial",
] as const;

const FICHAS: PanelSource<"canales-fichas"> = {
  contractId: "canales-fichas",
  kind: "real",
  descripcion: "Fichas de prueba",
  fetch: async () =>
    ENTRADAS.map((entrada, index) => ({
      id: `canal-${index + 1}`,
      nombre: `Canal real ${index + 1}`,
      clave: `canal${index + 1}`,
      familia: null,
      color: null,
      entrada,
      cobro: null,
      usaCourier: null,
      comisionPct: null,
      pasarelaPct: null,
      recibePautaGeneral: null,
      metaMensual: null,
      activo: true,
      tienePedidos: null,
      reglasPorConfirmar: false,
      camposPendientes: [],
    })),
};

const DEMO: PanelSourceRegistry = {
  ...TEST_SOURCES,
  "canales-fichas": FICHAS,
  detalle: detalleDemoSource,
  "canales-comparativo": canalesComparativoDemoSource,
  "canales-detalle": canalesDetalleDemoSource,
  productos: productosDemoSource,
  publicidad: publicidadDemoSource,
  "clientes-zonas": clientesZonasDemoSource,
};

function renderSubtab(
  subtab: PanelSubtabId,
  opciones: { role?: PanelRole; sources?: PanelSourceRegistry; soloReal?: boolean } = {},
) {
  const user = userEvent.setup();
  renderWithPanel(<PanelShell />, {
    role: opciones.role ?? "dueno",
    sources: opciones.sources ?? DEMO,
    state: {
      ...DEFAULT_PANEL_STATE,
      navigation: { tab: "canales", subtab },
      dataMode: opciones.soloReal ? "solo_real" : "mixto",
    },
  });
  return user;
}

const valor = (region: HTMLElement) => within(region).getByText(/^(S\/ |≤ S\/ )/).textContent;

async function facturacionDelDrawer() {
  const dialogo = await screen.findByRole("dialog");
  const etiqueta = await within(dialogo).findByText("Facturación");
  return { dialogo, facturacion: etiqueta.nextElementSibling?.textContent };
}

describe("Ventas y canales · Canales", () => {
  beforeEach(() => toastInfo.mockClear());

  it("agrupa por familia, abre la ficha del canal y sus KPI cuadran con el detalle", async () => {
    const user = renderSubtab("canales");
    const lista = await screen.findByRole("region", { name: "Familia Online COD" });
    expect(
      screen.getAllByText(/nombres de canal vienen de tu catálogo real/i).length,
    ).toBeGreaterThan(0);
    const canal = within(lista).getAllByRole("button")[0];
    await user.click(canal);
    expect(canal).toHaveAttribute("aria-pressed", "true");
    const kpi = await screen.findByRole("region", { name: "Facturación" });
    await waitFor(() => expect(valor(kpi)).toMatch(/^S\/ \d/));
    expect(screen.getByRole("heading", { name: /Embudo de leads y pérdidas/ })).toBeInTheDocument();
    for (const nombre of ["Ventas", "Leads", "Efectividad de entrega", "Retorno de publicidad"]) {
      expect(screen.getByRole("region", { name: nombre })).toBeInTheDocument();
    }
    expect(screen.getByRole("region", { name: /^Ganancia/ })).toBeInTheDocument();
    const facturacionKpi = valor(kpi);
    await user.click(within(kpi).getByRole("button", { name: /ver pedidos/i }));
    const { facturacion } = await facturacionDelDrawer();
    expect(facturacion).toBe(facturacionKpi);
  });

  it("«Editar ficha» avisa que el guardado está pendiente de integración", async () => {
    const user = renderSubtab("canales");
    await user.click(await screen.findByRole("button", { name: /Editar ficha/ }));
    expect(toastInfo).toHaveBeenCalledWith(
      "Editar ficha: pendiente de integración",
      expect.anything(),
    );
  });

  it("el comparativo cambia de vista, se ordena y una fila abre las ventas del canal", async () => {
    const user = renderSubtab("canales");
    const tabla = await screen.findByRole("table", { name: "Comparativo de canales · ventas" });
    const orden = within(tabla).getByRole("button", { name: /Facturación/ });
    await user.click(orden);
    expect(within(tabla).getByRole("columnheader", { name: /Facturación/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    await user.click(screen.getByRole("button", { name: "Ganancia" }));
    const ganancia = await screen.findByRole("table", {
      name: "Comparativo de canales · ganancia",
    });
    expect(
      within(ganancia).getByRole("columnheader", { name: /Pauta general \(est\.\)/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Entregas y cobro" }));
    const entregas = await screen.findByRole("table", {
      name: "Comparativo de canales · entregas y cobro",
    });
    expect(within(entregas).getByRole("columnheader", { name: /Flete/ })).toBeInTheDocument();
    await user.click(within(entregas).getAllByRole("button", { name: /^Ver ventas de / })[0]);
    expect(await screen.findByRole("dialog", { name: /· ventas/ })).toBeInTheDocument();
  });

  it("la Supervisora no ve ganancia, costos ni comisiones", async () => {
    renderSubtab("canales", { role: "supervisora" });
    await screen.findByRole("table", { name: "Comparativo de canales · ventas" });
    await screen.findByRole("region", { name: "Facturación" });
    expect(screen.queryByRole("button", { name: "Ganancia" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /^Ganancia/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Retorno de publicidad" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Comisión:/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar ficha/ })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Entregas y cobro" }));
    const entregas = await screen.findByRole("table", {
      name: "Comparativo de canales · entregas y cobro",
    });
    expect(within(entregas).queryByRole("columnheader", { name: /Flete/ })).not.toBeInTheDocument();
  });

  it("en modo solo reales el comparativo y el detalle quedan pendientes", async () => {
    renderSubtab("canales", { soloReal: true });
    expect((await screen.findAllByText(/pendiente de integración/i)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("table", { name: /Comparativo de canales/ })).not.toBeInTheDocument();
  });
});

describe("Ventas y canales · Productos", () => {
  it("muestra margen «—» sin costo y un producto abre sus ventas", async () => {
    const user = renderSubtab("productos");
    const tabla = await screen.findByRole("table", { name: "Productos vendidos" });
    expect(within(tabla).getByRole("columnheader", { name: /Margen/ })).toBeInTheDocument();
    expect(screen.getByText(/margen «—»: no se asume 0 % ni 100 %/)).toBeInTheDocument();
    const fila = within(tabla).getAllByRole("button", { name: /^Ver ventas de / })[0];
    await user.click(fila);
    expect(await screen.findByRole("dialog", { name: /· ventas/ })).toBeInTheDocument();
  });

  it("la Supervisora no recibe costo ni margen", async () => {
    renderSubtab("productos", { role: "supervisora" });
    const tabla = await screen.findByRole("table", { name: "Productos vendidos" });
    expect(within(tabla).queryByRole("columnheader", { name: /Margen/ })).not.toBeInTheDocument();
    expect(within(tabla).queryByRole("columnheader", { name: /Costo/ })).not.toBeInTheDocument();
  });

  it("la variante se muestra como producto propio y el upsell abre su grupo", async () => {
    const user = renderSubtab("productos");
    const tabla = await screen.findByRole("table", { name: "Productos vendidos" });
    const variante = within(tabla).getByRole("button", { name: /^Ver ventas de .*Talla L$/ });
    const fila = variante.closest("tr");
    expect(fila?.textContent).toMatch(/SKU-1D-L/);
    expect(fila?.textContent).toMatch(/Producto demo D · Talla L/);
    await user.click(
      within(screen.getByRole("region", { name: "Upsell" })).getByRole("button", {
        name: /ver pedidos/i,
      }),
    );
    expect(await screen.findByRole("dialog", { name: /Ventas con upsell/ })).toBeInTheDocument();
  });
});

describe("Ventas y canales · Publicidad", () => {
  it("separa la pauta general estimada y una sesión Live abre sus ventas", async () => {
    const user = renderSubtab("publicidad");
    const tabla = await screen.findByRole("table", { name: "Publicidad por canal" });
    expect(
      within(tabla).getByRole("columnheader", { name: /Pauta general \(est\.\)/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pauta general (reparto estimado)")).toBeInTheDocument();
    const sesiones = screen.getByRole("table", { name: "Sesiones de TikTok Live" });
    await user.click(
      within(sesiones).getAllByRole("button", { name: /^Ver pedidos de la sesión/ })[0],
    );
    expect(await screen.findByRole("dialog", { name: /^Live / })).toBeInTheDocument();
  });

  it("sin inversión, retorno y costo por venta muestran «—»", async () => {
    const sinPauta: PanelSource<"publicidad"> = {
      ...publicidadDemoSource,
      fetch: async (query, context) => {
        const respuesta = await publicidadDemoSource.fetch(query, context);
        return {
          ...respuesta,
          actual: {
            ...respuesta.actual,
            kpis: {
              ...respuesta.actual.kpis,
              invertido: 0,
              retornoPublicidad: null,
              costoPorVenta: null,
            },
          },
        };
      },
    };
    renderSubtab("publicidad", { sources: { ...DEMO, publicidad: sinPauta } });
    await screen.findByRole("region", { name: "Retorno de publicidad" });
    await waitFor(() =>
      expect(
        within(screen.getByRole("region", { name: "Retorno de publicidad" })).getByText("—", {
          selector: "p",
        }),
      ).toBeInTheDocument(),
    );
    expect(
      within(screen.getByRole("region", { name: "Costo por venta" })).getByText("—", {
        selector: "p",
      }),
    ).toBeInTheDocument();
  });
});

describe("Ventas y canales · Clientes y zonas", () => {
  it("un departamento y un cliente abren su grupo; el cliente abre su historial completo", async () => {
    const user = renderSubtab("clientes");
    const departamentos = await screen.findByRole("table", { name: "Ventas por departamento" });
    if (within(departamentos).getAllByRole("row").length > 14) {
      expect(
        screen.getByRole("searchbox", { name: "Buscar en Ventas por departamento" }),
      ).toBeInTheDocument();
    }
    await user.click(within(departamentos).getAllByRole("button", { name: /^Ver ventas en / })[0]);
    expect(await screen.findByRole("dialog", { name: /· ventas/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /close/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const tabla = screen.getByRole("table", { name: "Mejores clientes" });
    await user.click(
      within(tabla).getAllByRole("button", { name: /^Ver historial de compras de/ })[0],
    );
    const dialogo = await screen.findByRole("dialog", { name: /historial de compras/ });
    expect(within(dialogo).getByText(/Historial completo del cliente/)).toBeInTheDocument();
  });

  it("sin historial de clientes la recompra y la lista negra quedan pendientes", async () => {
    const sinHistorial: PanelSource<"clientes-zonas"> = {
      ...clientesZonasDemoSource,
      fetch: async (query, context) => {
        const respuesta = await clientesZonasDemoSource.fetch(query, context);
        return {
          ...respuesta,
          actual: {
            ...respuesta.actual,
            historial: { disponible: false, desde: null },
            kpis: {
              ...respuesta.actual.kpis,
              nuevos: null,
              recurrentes: null,
              recompra: null,
              valorHistoricoPorCliente: null,
              listaNegraPedidos: null,
              efectividadListaNegra: null,
            },
            mejoresClientes: null,
          },
        };
      },
    };
    renderSubtab("clientes", { sources: { ...DEMO, "clientes-zonas": sinHistorial } });
    await screen.findByRole("region", { name: "Recompra" });
    await waitFor(() =>
      expect(
        within(screen.getByRole("region", { name: "Recompra" })).getByText("Pendiente"),
      ).toBeInTheDocument(),
    );
    expect(
      within(screen.getByRole("region", { name: "Lista negra" })).getByText("Pendiente"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Mejores clientes" })).not.toBeInTheDocument();
    expect(screen.getByText(/mostraría un historial incompleto/)).toBeInTheDocument();
  });
});

describe("Ventas y canales · marcas de los gráficos", () => {
  it("un punto de la tendencia semanal abre las ventas de esa semana por fecha de ingreso", async () => {
    const user = renderSubtab("canales");
    const puntos = await screen.findAllByRole("button", { name: /Ver ventas de esa semana$/ });
    await user.click(puntos[puntos.length - 2]);
    const dialogo = await screen.findByRole("dialog", { name: /semana del/ });
    expect(within(dialogo).getByText(/Rango propio del gráfico/)).toBeInTheDocument();
  });

  it("un punto de inversión muestra el desglose de pauta sin abrir pedidos; uno de venta abre sus ventas", async () => {
    const user = renderSubtab("publicidad");
    await screen.findByRole("table", { name: "Publicidad por canal" });
    const invertido = screen.getAllByRole("button", {
      name: /^Invertido, .*Ver desglose de pauta$/,
    })[0];
    await user.click(invertido);
    expect(await screen.findByRole("heading", { name: /Pauta registrada el/ })).toHaveFocus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const vendido = screen.getAllByRole("button", { name: /^Vendido, .*Ver ventas$/ })[0];
    await user.click(vendido);
    expect(await screen.findByRole("dialog", { name: /en canales con pauta/ })).toBeInTheDocument();
  });
});
