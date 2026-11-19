import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PeriodCloseTab from "../PeriodCloseTab";
import { closePeriod, getPeriodClose, listPeriodCloses, reopenPeriod, type PeriodClose, type PeriodCloseList } from "@/services/inventoryReportsService";

// FEAT-24 H10-D6 — Cierre mensual: solo el Administrador cierra (con confirmación) y reabre (con motivo).

let role = "ADMINISTRADOR";
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "t", company: { id: "c1" }, user: { id: "u1", role } } }) }));
jest.mock("@/services/inventoryReportsService", () => ({ listPeriodCloses: jest.fn(), getPeriodClose: jest.fn(), closePeriod: jest.fn(), reopenPeriod: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const pdfDownload = jest.fn();
jest.mock("@/hooks/usePdfDownload", () => ({ usePdfDownload: () => pdfDownload, useReportAuthor: () => "Ana" }));

const close = (period: string, patch: Partial<PeriodClose> = {}): PeriodClose => ({
  id: `pc-${period}`, period, status: "cerrado", periodStart: `${period}-01`, periodEnd: `${period}-30`, lastDay: `${period}-30`,
  closedAt: "2026-10-01T15:00:00Z", closedBy: "admin@kunca.pe", closedByName: "Ana Admin", reopenedAt: null, reopenedBy: null, reopenedByName: null, reopenReason: null,
  itemsCount: 120, units: 900, totalValue: 15000, uncostedItems: 2, uncostedUnits: 5, ...patch,
});
const LIST: PeriodCloseList = { items: [close("2026-09"), close("2026-08")], currentPeriod: "2026-11", nextToClose: "2026-10" };
const httpError = (status: number, message: string) =>
  new AxiosError(String(status), "ERR", undefined, undefined, { status, statusText: "", headers: {}, config: { headers: new AxiosHeaders() }, data: { message } });

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PeriodCloseTab /></QueryClientProvider>);
}
const rowOf = async (month: string) => (await screen.findByText(month)).closest("tr")!;

beforeEach(() => {
  role = "ADMINISTRADOR";
  jest.clearAllMocks();
  jest.mocked(listPeriodCloses).mockResolvedValue(LIST);
});

it("lista el mes en curso, el próximo a cerrar y los cerrados, del más nuevo al más viejo", async () => {
  renderTab();
  await screen.findByText("Septiembre 2026");
  const months = screen.getAllByRole("row").slice(1).map((row) => row.querySelector("td")!.textContent);
  expect(months).toEqual(["Noviembre 2026", "Octubre 2026", "Septiembre 2026", "Agosto 2026"]);
  expect(within(await rowOf("Noviembre 2026")).getByText("Se puede cerrar desde el 1 de diciembre.")).toBeInTheDocument();
  const september = await rowOf("Septiembre 2026");
  expect(september.textContent?.replace(/\s/g, " ")).toContain("S/ 15,000.00");
  expect(within(september).getByText("Ana Admin")).toBeInTheDocument();
});

it("el Administrador cierra el próximo mes después de confirmar qué se bloquea", async () => {
  jest.mocked(closePeriod).mockResolvedValue(close("2026-10") as never);
  renderTab();
  fireEvent.click(within(await rowOf("Octubre 2026")).getByRole("button", { name: "Cerrar octubre" }));
  const dialog = await screen.findByRole("dialog");
  expect(dialog).toHaveTextContent("las operaciones con fecha de Octubre 2026");
  expect(dialog).toHaveTextContent("quedan bloqueadas");
  expect(closePeriod).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar Octubre 2026" }));
  await waitFor(() => expect(closePeriod).toHaveBeenCalledWith("2026-10"));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("si la API rechaza el cierre, el motivo queda en el diálogo", async () => {
  jest.mocked(closePeriod).mockRejectedValue(httpError(409, "Cierra primero Septiembre 2026."));
  renderTab();
  fireEvent.click(within(await rowOf("Octubre 2026")).getByRole("button", { name: "Cerrar octubre" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar Octubre 2026" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("Cierra primero Septiembre 2026.");
});

it("reabrir solo el último mes cerrado y con motivo", async () => {
  jest.mocked(reopenPeriod).mockResolvedValue(close("2026-09", { status: "reabierto" }) as never);
  renderTab();
  expect(within(await rowOf("Agosto 2026")).queryByRole("button", { name: "Reabrir" })).not.toBeInTheDocument();
  fireEvent.click(within(await rowOf("Septiembre 2026")).getByRole("button", { name: "Reabrir" }));
  const dialog = await screen.findByRole("dialog");
  const confirm = within(dialog).getByRole("button", { name: "Reabrir Septiembre 2026" });
  expect(confirm).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText("Motivo de la reapertura"), { target: { value: "ab" } });
  expect(confirm).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText("Motivo de la reapertura"), { target: { value: "  Faltó una compra del 28  " } });
  expect(confirm).toBeEnabled();
  fireEvent.click(confirm);
  await waitFor(() => expect(reopenPeriod).toHaveBeenCalledWith("2026-09", "Faltó una compra del 28"));
});

it("un mes reabierto muestra el motivo y se puede cerrar de nuevo", async () => {
  jest.mocked(listPeriodCloses).mockResolvedValue({
    items: [close("2026-09", { status: "reabierto", reopenedByName: "Ana Admin", reopenReason: "Faltó una compra" }), close("2026-08")],
    currentPeriod: "2026-11",
    nextToClose: "2026-09",
  });
  renderTab();
  const row = await rowOf("Septiembre 2026");
  expect(within(row).getByText("Reabierto")).toBeInTheDocument();
  expect(within(row).getByText("Reabierto por Ana Admin: Faltó una compra")).toBeInTheDocument();
  expect(within(row).getByRole("button", { name: "Cerrar de nuevo" })).toBeInTheDocument();
  expect(within(await rowOf("Agosto 2026")).getByRole("button", { name: "Reabrir" })).toBeInTheDocument();
});

it("Operaciones ve los cierres y sus archivos, pero no cierra ni reabre", async () => {
  role = "OPERACIONES";
  renderTab();
  await screen.findByText("Septiembre 2026");
  expect(screen.queryByRole("button", { name: /^Cerrar / })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Reabrir" })).not.toBeInTheDocument();
  expect(screen.getByText("Solo el Administrador puede cerrar o reabrir un mes.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "PDF del cierre de Septiembre 2026" })).toBeInTheDocument();
});

it("el PDF del cierre usa el helper con encabezado común y firmas", async () => {
  jest.mocked(getPeriodClose).mockResolvedValue({ ...close("2026-09"), items: [] });
  renderTab();
  fireEvent.click(await screen.findByRole("button", { name: "PDF del cierre de Septiembre 2026" }));
  await waitFor(() => expect(pdfDownload).toHaveBeenCalledWith(expect.objectContaining({ title: "Inventario al cierre", number: "Septiembre 2026", signatures: ["Administrador", "Contador"] })));
  expect(getPeriodClose).toHaveBeenCalledWith("2026-09");
});
