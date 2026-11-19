import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { renderWithPanel } from "@/components/panel-control/__tests__/render-with-panel";
import { DEFAULT_PANEL_STATE } from "@/features/panel-control/shared/state/panel-state.model";
import { getBusinessSalesExport } from "@/services/businessSalesService";
import { ViewHeader } from "../shell/ViewHeader";

const toastSuccess = jest.fn();
const toastWarning = jest.fn();
const toastError = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    warning: (...args: unknown[]) => toastWarning(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));
const saveAs = jest.fn();
jest.mock("file-saver", () => ({ saveAs: (...args: unknown[]) => saveAs(...args) }));
jest.mock("@/services/businessSalesService", () => ({ getBusinessSalesExport: jest.fn() }));
const axiosGet = jest.fn();
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: (...args: unknown[]) => axiosGet(...args) } }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const exportMock = getBusinessSalesExport as jest.MockedFunction<typeof getBusinessSalesExport>;


const VENTA = {
  id: "o-1",
  orderNumber: "ORD-1",
  storeId: "tienda-1",
  status: "PENDIENTE",
  commercialStage: "SALE",
  created_at: "2026-09-10T15:00:00.000Z",
  grandTotal: "100",
  customer: { fullName: "Ana", phoneNumber: "999" },
  items: [{ productName: "Polo", attributes: {}, quantity: 1 }],
  payments: [],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Excel del reporte de ventas en Ventas y canales", () => {
  it("aparece junto a «Abrir módulo Ventas» y descarga las ventas reales del periodo y las tiendas", async () => {
    exportMock.mockResolvedValue([VENTA] as never);
    renderWithPanel(<ViewHeader tab="canales" />);

    expect(screen.getByRole("link", { name: /Abrir módulo Ventas/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Descargar reporte de ventas en Excel" }));

    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
    const [tiendas, consulta] = exportMock.mock.calls[0];
    expect(tiendas).toEqual(["tienda-1"]);
    expect(consulta).toMatchObject({ tab: "todas", dateFrom: expect.any(String), dateTo: expect.any(String) });
    expect(saveAs.mock.calls[0][1]).toMatch(/^reporte_ventas_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("deja fuera las anuladas, igual que «Vendí … N ventas» del panel", async () => {
    exportMock.mockResolvedValue([VENTA, { ...VENTA, id: "o-2", orderNumber: "ORD-2", status: "ANULADO" }] as never);
    renderWithPanel(<ViewHeader tab="canales" />);

    await userEvent.click(screen.getByRole("button", { name: "Descargar reporte de ventas en Excel" }));

    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
    expect(toastSuccess.mock.calls[0][1]).toEqual({ description: "1 ventas del periodo." });
  });

  it("con un canal elegido deja solo los pedidos que el panel cuenta en ese canal", async () => {
    axiosGet.mockResolvedValue({ data: [{ id: "ficha-wa", canalNombre: "whatsapp" }] });
    exportMock.mockResolvedValue([
      { ...VENTA, id: "wa", orderNumber: "ORD-WA", salesChannel: "WHATSAPP" },
      { ...VENTA, id: "web", orderNumber: "ORD-WEB", salesChannel: "WEB" },
      { ...VENTA, id: "origen", orderNumber: "ORD-ORIGEN", salesChannel: "WEB", canalOrigen: "Whatsapp " },
    ] as never);
    renderWithPanel(<ViewHeader tab="canales" />, {
      state: { ...DEFAULT_PANEL_STATE, filters: { ...DEFAULT_PANEL_STATE.filters, canalId: "ficha-wa" } },
    });

    await userEvent.click(screen.getByRole("button", { name: "Descargar reporte de ventas en Excel" }));

    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
    expect(axiosGet).toHaveBeenCalledWith(expect.stringMatching(/\/config\/canales$/), { params: { empresaId: "empresa-1" } });
    expect(toastSuccess.mock.calls[0][1]).toEqual({ description: "2 ventas del periodo." });
  });

  it("no pide las fichas de canal si no hay canal elegido", async () => {
    exportMock.mockResolvedValue([VENTA] as never);
    renderWithPanel(<ViewHeader tab="canales" />);

    await userEvent.click(screen.getByRole("button", { name: "Descargar reporte de ventas en Excel" }));

    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
    expect(axiosGet).not.toHaveBeenCalled();
  });

  it("avisa y no descarga cuando el periodo no tiene ventas", async () => {
    exportMock.mockResolvedValue([]);
    renderWithPanel(<ViewHeader tab="canales" />);

    await userEvent.click(screen.getByRole("button", { name: "Descargar reporte de ventas en Excel" }));

    await waitFor(() => expect(toastWarning).toHaveBeenCalledWith("No hay ventas en el periodo elegido"));
    expect(saveAs).not.toHaveBeenCalled();
  });

  it("no aparece en otras pestañas", () => {
    renderWithPanel(<ViewHeader tab="operaciones" />);
    expect(screen.queryByRole("button", { name: /reporte de ventas/ })).not.toBeInTheDocument();
  });
});
