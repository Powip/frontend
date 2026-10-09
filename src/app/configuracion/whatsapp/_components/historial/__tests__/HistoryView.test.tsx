import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { DEFAULT_HISTORY_PERIOD } from "@/features/whatsapp/constants/whatsapp-settings-catalog";
import type { WhatsAppHistoryFilters } from "@/features/whatsapp/models/history.model";
import { resolveEffectivePermissions } from "@/features/whatsapp/utils/whatsapp-permissions.util";
import {
  HISTORY_FIXTURE_NOW,
  historyEmptyPageFixture,
  historyMetricsFixture,
  historyMetricsPartialFixture,
  historyMetricsZeroFixture,
  historyPageFixture,
} from "@/mocks/whatsapp/whatsapp-history.fixtures";
import { settingsStoresFixture } from "@/mocks/whatsapp/whatsapp-settings.fixtures";
import { HistoryView, type HistoryViewProps } from "../HistoryView";

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  jest.useRealTimers();
});

const PENDING = { kind: "pending-integration" } as const;
const INITIAL: WhatsAppHistoryFilters = {
  period: DEFAULT_HISTORY_PERIOD,
  status: "all",
  search: "",
  storeId: null,
};

function baseProps(overrides: Partial<HistoryViewProps> = {}): HistoryViewProps {
  return {
    stores: settingsStoresFixture,
    filters: INITIAL,
    onFiltersChange: jest.fn(),
    now: HISTORY_FIXTURE_NOW,
    metrics: { kind: "ready", data: historyMetricsFixture },
    page: { kind: "ready", data: historyPageFixture },
    effectivePermissions: resolveEffectivePermissions(null),
    exportPermission: null,
    onOpenOrder: jest.fn(),
    ...overrides,
  };
}

function Harness(props: HistoryViewProps) {
  const [filters, setFilters] = useState(props.filters);
  return (
    <HistoryView
      {...props}
      filters={filters}
      onFiltersChange={(next) => {
        setFilters(next);
        props.onFiltersChange(next);
      }}
    />
  );
}

function renderView(overrides: Partial<HistoryViewProps> = {}) {
  const props = baseProps(overrides);
  return { props, ...render(<Harness {...props} />) };
}

const kpis = () => screen.getByRole("region", { name: "Indicadores" });
const messages = () => screen.getByRole("region", { name: "Mensajes" });
const rowFor = (text: string) =>
  within(messages())
    .getAllByRole("row")
    .find((row) => row.textContent?.includes(text)) as HTMLElement;

describe("Historial sin backend", () => {
  it("no muestra ceros, porcentajes ni filas y bloquea la exportación", () => {
    renderView({ metrics: PENDING, page: PENDING });
    expect(screen.getByText("Indicadores pendientes de integración")).toBeInTheDocument();
    expect(screen.getByText("Mensajes pendientes de integración")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    const exportButton = screen.getByRole("button", { name: "Exportar Excel" });
    expect(exportButton).toHaveAttribute("aria-disabled", "true");
    expect(exportButton).toHaveAccessibleDescription(
      /Pendiente de integración.*permiso para exportar/,
    );
  });

  it("calcula el periodo en hora de Lima", () => {
    const { unmount } = renderView();
    expect(screen.getByText(/Del 02\/10\/2026 al 08\/10\/2026/)).toBeInTheDocument();
    unmount();
    renderView({
      now: new Date("2026-10-08T03:00:00.000Z"),
      filters: { ...INITIAL, period: "today" },
    });
    expect(screen.getByText(/Hoy, 07\/10\/2026/)).toBeInTheDocument();
  });
});

describe("Indicadores", () => {
  it("usa los conteos de backend con sus bases", () => {
    renderView();
    const region = kpis();
    expect(within(region).getByText("1,284")).toBeInTheDocument();
    expect(within(region).getByText("97.4% de los enviados")).toBeInTheDocument();
    expect(within(region).getByText("81.4% de los entregados")).toBeInTheDocument();
    expect(within(region).getByText("21 sin WhatsApp · 12 otros")).toBeInTheDocument();
    expect(
      within(region).getByText("No cuentan como enviados, entregados ni leídos."),
    ).toBeInTheDocument();
    expect(within(region).getByText(/Abrir el link no prueba que leyó/)).toBeInTheDocument();
  });

  it("con ceros reales no divide por cero", () => {
    renderView({
      metrics: { kind: "ready", data: historyMetricsZeroFixture },
      page: { kind: "ready", data: historyEmptyPageFixture },
    });
    const region = kpis();
    expect(within(region).getAllByText("0").length).toBeGreaterThan(0);
    expect(within(region).getAllByText("Sin envíos en el periodo")).toHaveLength(2);
    expect(within(region).getByText("Sin entregas en el periodo")).toBeInTheDocument();
    expect(region.textContent).not.toMatch(/NaN|Infinity/);
    expect(within(region).getByText("Ninguno en el periodo")).toBeInTheDocument();
  });

  it("diferencia dato desconocido de cero", () => {
    renderView({ metrics: { kind: "ready", data: historyMetricsPartialFixture } });
    const region = kpis();
    expect(within(region).getAllByText("Sin dato").length).toBeGreaterThan(0);
    expect(within(region).getAllByText("Porcentaje sin dato").length).toBeGreaterThan(0);
  });
});

describe("Tabla", () => {
  it("los asistidos no se muestran como entregados ni leídos", async () => {
    const user = userEvent.setup({ delay: null });
    renderView();
    const row = rowFor("Rosa Chávez");
    expect(
      within(row).getByText("Número de contingencia · marcado por Katherine F."),
    ).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: /ver línea de tiempo/ }));
    const timeline = screen.getByRole("list", { name: "Línea de tiempo" });
    expect(timeline).toHaveTextContent("Sin confirmación de entrega ni de lectura");
    expect(timeline).not.toHaveTextContent("Entregado");
  });

  it("un clic en el rastreo no convierte el mensaje en leído", async () => {
    const user = userEvent.setup({ delay: null });
    renderView();
    const row = rowFor("Paola Buendía");
    expect(within(row).getByText("Abrió 09:30")).toBeInTheDocument();
    expect(within(row).getByText("Entregado")).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: /ver línea de tiempo/ }));
    expect(screen.getByRole("list", { name: "Línea de tiempo" })).toHaveTextContent(
      "Leído · sin confirmar",
    );
    expect(
      screen.getByText("Abrir el rastreo no prueba que leyó el mensaje en WhatsApp."),
    ).toBeInTheDocument();
  });

  it("la línea de tiempo lleva al pedido real o explica que no hay", async () => {
    const user = userEvent.setup({ delay: null });
    const { props } = renderView();
    await user.click(
      within(rowFor("Carlos Hoyos")).getByRole("button", { name: /ver línea de tiempo/ }),
    );
    await user.click(screen.getByRole("button", { name: "Ver pedido ORD-149912" }));
    expect(props.onOpenOrder).toHaveBeenCalledWith("order-h-read");
    await user.click(within(rowFor("Quispe")).getByRole("button", { name: /ver línea de tiempo/ }));
    expect(screen.getByText("Este mensaje no tiene un pedido asociado.")).toBeInTheDocument();
  });

  it("muestra motivos y bloquea reenviar con explicación", async () => {
    const user = userEvent.setup({ delay: null });
    renderView();
    const failed = rowFor("Alexandra");
    expect(within(failed).getByText("El número no tiene WhatsApp")).toBeInTheDocument();
    const resend = within(failed).getByRole("button", { name: /Reenviar/ });
    expect(resend).toHaveAttribute("aria-disabled", "true");
    expect(resend).toHaveAccessibleDescription(/Pendiente de integración/);
    await user.click(resend);
    expect(within(failed).queryByText("Reenviando…")).not.toBeInTheDocument();
    const skipped = rowFor("Ana Soto");
    expect(within(skipped).getByRole("button", { name: /Reenviar/ })).toHaveAccessibleDescription(
      /Corrige el dato en el pedido/,
    );
  });

  it("si reenviar falla lo dice sin cambiar el estado", async () => {
    const user = userEvent.setup({ delay: null });
    const onResend = jest.fn().mockRejectedValue(new Error("El número sigue sin WhatsApp."));
    renderView({
      onResend,
      effectivePermissions: resolveEffectivePermissions(["WA_REPLY"]),
    });
    const failed = rowFor("Alexandra");
    await user.click(within(failed).getByRole("button", { name: /Reenviar/ }));
    expect(onResend).toHaveBeenCalledWith("h-failed");
    expect(await within(failed).findByRole("alert")).toHaveTextContent(
      "El número sigue sin WhatsApp.",
    );
    expect(within(failed).getByText("No enviado")).toBeInTheDocument();
  });

  it("los totales salen de backend y la paginación queda bloqueada", () => {
    renderView();
    expect(screen.getByText(/Página 1 de 27 · 1,321 mensajes/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

describe("Filtros", () => {
  it("periodo, estado y tienda actualizan el alcance compartido", async () => {
    const user = userEvent.setup({ delay: null });
    const { props } = renderView();
    await user.click(screen.getByRole("radio", { name: "Este mes" }));
    expect(props.onFiltersChange).toHaveBeenLastCalledWith({ ...INITIAL, period: "month" });
    await user.click(screen.getByRole("radio", { name: "No enviado" }));
    expect(props.onFiltersChange).toHaveBeenLastCalledWith({
      ...INITIAL,
      period: "month",
      status: "not_sent",
    });
  });

  it("la búsqueda espera a que termines de escribir", () => {
    jest.useFakeTimers();
    const { props } = renderView();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar pedido, cliente o teléfono" }), {
      target: { value: "ORD-1499" },
    });
    expect(props.onFiltersChange).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(props.onFiltersChange).toHaveBeenLastCalledWith({ ...INITIAL, search: "ORD-1499" });
  });

  it("distingue vacío de sin coincidencias y limpia filtros sin cambiar el periodo", async () => {
    const user = userEvent.setup({ delay: null });
    const { unmount } = renderView({ page: { kind: "ready", data: historyEmptyPageFixture } });
    expect(screen.getByText("Todavía no se enviaron avisos en este periodo.")).toBeInTheDocument();
    unmount();
    const { props } = renderView({
      page: { kind: "ready", data: historyEmptyPageFixture },
      filters: { period: "today", status: "not_sent", search: "", storeId: "store-kunca" },
    });
    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(props.onFiltersChange).toHaveBeenLastCalledWith({
      period: "today",
      status: "all",
      search: "",
      storeId: null,
    });
  });
});
