import { fireEvent, render, screen, within } from "@testing-library/react";
import { AdvertisingDataStatus } from "../DataStatus";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

it("groups simultaneous Meta, assignment and provisional notices without hiding the pending state", () => {
  const settingsHref =
    "/publicidad/configuracion?from=2026-10-01&to=2026-10-23&storeId=store&section=accounts";
  render(
    <AdvertisingDataStatus
      warnings={[
        "META_DATA_PARTIAL",
        "CHANNEL_FAMILY_FROM_META",
        "STORE_CHANNELS_NOT_CONFIGURED",
        "UNASSIGNED_SPEND",
        "CURRENT_DAY_PROVISIONAL",
        "PROVISIONAL_META_DATA",
        "UNASSIGNED_SPEND",
      ]}
      spendAvailable={false}
      settingsHref={settingsHref}
    />,
  );
  const status = screen.getByRole("status", { name: "Estado de datos" });
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(within(status).getByText("Hay importes de Meta pendientes de confirmar")).toBeVisible();
  expect(
    within(status).getByText("Hay gasto de anuncios sin negocio asignado."),
  ).toBeVisible();
  expect(
    within(status).getAllByText("Los resultados recientes todavía pueden cambiar."),
  ).toHaveLength(1);
  expect(within(status).getByRole("link", { name: "Ver cuentas de Meta" })).toHaveAttribute(
    "href",
    settingsHref,
  );
  expect(within(status).getByRole("link", { name: "Revisar asignaciones de negocios" })).toHaveAttribute(
    "href",
    settingsHref,
  );
  const summary = within(status).getByText("Ver detalles");
  const details = summary.closest("details")!;
  expect(details).not.toHaveAttribute("open");
  expect(within(details).getAllByRole("listitem", { hidden: true })).toHaveLength(5);
  fireEvent.click(summary);
  expect(details).toHaveAttribute("open");
  expect(
    within(details).getByText(
      "Faltan datos del período o quedan diferencias entre los importes de Meta. Revisa su estado en Configuración.",
    ),
  ).toBeVisible();
  expect(within(details).getByText(/Hay gasto de anuncios sin tienda asignada/)).toBeVisible();
  expect(
    within(details).getByText(/Hay negocios del período sin canales de venta configurados/),
  ).toBeVisible();
});

it("keeps unavailable spend visible even if the server omitted a Meta warning", () => {
  render(<AdvertisingDataStatus warnings={["UNASSIGNED_SPEND"]} spendAvailable={false} />);
  expect(screen.getByText("Hay importes de Meta pendientes de confirmar")).toBeVisible();
  expect(screen.getByText("Los valores sin confirmar se mantienen con —.")).toBeVisible();
});

it("preserves currency exclusions and a visible fallback for unknown warnings", () => {
  render(
    <AdvertisingDataStatus
      warnings={["NON_PEN_SPEND_EXCLUDED", "UNKNOWN_A", "UNKNOWN_B"]}
      spendAvailable
    />,
  );
  expect(
    screen.getByText(
      "Los totales en soles no suman otras monedas. Consulta sus importes por cuenta.",
    ),
  ).toBeVisible();
  expect(screen.getByText("Hay información pendiente de confirmar.")).toBeVisible();
  expect(
    screen.queryByText("Hay importes de Meta pendientes de confirmar"),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Ver detalles"));
  expect(screen.getAllByText(/Hay datos del período pendientes de confirmar/)).toHaveLength(1);
  expect(screen.queryByText(/UNKNOWN_A|UNKNOWN_B/)).not.toBeInTheDocument();
});

it("does not claim missing store configuration when Meta only identified the channel", () => {
  render(<AdvertisingDataStatus warnings={["CHANNEL_FAMILY_FROM_META"]} spendAvailable />);
  expect(screen.getByText("El canal de algunos anuncios se identifica desde Meta.")).toBeVisible();
  expect(screen.queryByText(/pendientes de vincular|Hay importes de Meta/)).not.toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

it.each([
  { warnings: ["STORE_CHANNELS_NOT_CONFIGURED"] },
  { warnings: ["STORE_CHANNELS_NOT_CONFIGURED", "CHANNEL_FAMILY_FROM_META"] },
])("keeps channel configuration separate from store assignments for $warnings", ({ warnings }) => {
  render(<AdvertisingDataStatus warnings={warnings} spendAvailable />);
  expect(screen.getByText("Hay negocios sin canales de venta configurados.")).toBeVisible();
  expect(screen.getByText("Falta configurar los destinos de venta; el desglose por canal puede estar incompleto.")).toBeVisible();
  expect(screen.getByRole("link", { name: "Configurar canales de venta" })).toHaveAttribute(
    "href", "/configuracion/tiendas?tab=canales",
  );
  expect(screen.queryByRole("link", { name: "Revisar asignaciones de negocios" })).not.toBeInTheDocument();
  expect(screen.queryByText(/sin negocio asignado|asignaciones históricas|Hay importes de Meta/)).not.toBeInTheDocument();
  if (warnings.includes("CHANNEL_FAMILY_FROM_META"))
    expect(screen.getByText("El canal de algunos anuncios se identifica desde Meta.")).toBeVisible();
});

it.each([
  { warning: "UNASSIGNED_SPEND", missing: true, uncertain: false },
  { warning: "STORE_ASSIGNMENT_UNCERTAIN", missing: false, uncertain: true },
])("preserves the distinct assignment warning $warning without inventing missing channels or Meta data", ({ warning, missing, uncertain }) => {
  const settingsHref = "/publicidad/configuracion?from=2026-10-17&to=2026-10-23&storeId=store&section=accounts";
  render(<AdvertisingDataStatus warnings={[warning]} spendAvailable settingsHref={settingsHref} />);
  expect(!!screen.queryByText("Hay gasto de anuncios sin negocio asignado.")).toBe(missing);
  expect(!!screen.queryByText("Hay asignaciones históricas de anuncios pendientes de confirmar.")).toBe(uncertain);
  expect(screen.getByRole("link", { name: "Revisar asignaciones de negocios" })).toHaveAttribute("href", settingsHref);
  expect(screen.queryByRole("link", { name: "Configurar canales de venta" })).not.toBeInTheDocument();
  expect(screen.queryByText("Hay importes de Meta pendientes de confirmar")).not.toBeInTheDocument();
});

it("shows missing stores, uncertain history and missing channel configuration together with their separate destinations", () => {
  render(<AdvertisingDataStatus warnings={[
    "UNASSIGNED_SPEND", "STORE_ASSIGNMENT_UNCERTAIN", "STORE_CHANNELS_NOT_CONFIGURED", "CHANNEL_FAMILY_FROM_META",
  ]} spendAvailable />);
  expect(screen.getByText("Hay gasto de anuncios sin negocio asignado.")).toBeVisible();
  expect(screen.getByText("Hay asignaciones históricas de anuncios pendientes de confirmar.")).toBeVisible();
  expect(screen.getByText("Hay negocios sin canales de venta configurados.")).toBeVisible();
  expect(screen.getByText("El canal de algunos anuncios se identifica desde Meta.")).toBeVisible();
  expect(screen.getByRole("link", { name: "Revisar asignaciones de negocios" })).toHaveAttribute("href", "/publicidad/configuracion?section=accounts");
  expect(screen.getByRole("link", { name: "Configurar canales de venta" })).toHaveAttribute("href", "/configuracion/tiendas?tab=canales");
  expect(screen.queryByText("Hay importes de Meta pendientes de confirmar")).not.toBeInTheDocument();
});

it("keeps provisional data as one informative note without a false unconfirmed amount warning", () => {
  render(
    <AdvertisingDataStatus
      warnings={["CURRENT_DAY_PROVISIONAL", "PROVISIONAL_META_DATA"]}
      spendAvailable
    />,
  );
  expect(screen.getAllByText("Los resultados recientes todavía pueden cambiar.")).toHaveLength(1);
  expect(
    screen.queryByText("Hay importes de Meta pendientes de confirmar"),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

it("renders no empty or falsely reassuring status when there are no warnings", () => {
  const { container } = render(<AdvertisingDataStatus warnings={[]} spendAvailable />);
  expect(container).toBeEmptyDOMElement();
});
