import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as closingHooks from "@/hooks/useCierreDia";
import type { CierreDiaRecord } from "@/interfaces/ICierreDia";
import { CcCierreDiaDayView } from "../CcCierreDiaDayView";
import { CcCierreDiaMesView } from "../CcCierreDiaMesView";
import { CcCierreDiaModal } from "../CcCierreDiaModal";
import { CcCierreDiaRangoView } from "../CcCierreDiaRangoView";

jest.mock("@/hooks/useCierreDia", () => ({
  useCierreDiaDay: jest.fn(),
  useCierreDiaMonth: jest.fn(),
  useCierreDiaRange: jest.fn(),
  useCierreDiaClosingDataDay: jest.fn(),
  useCierreDiaClosingDataRange: jest.fn(),
  useSaveCierreDia: jest.fn(),
  useDeleteCierreDia: jest.fn(),
}));
jest.mock("../CcCierreDiaProductTable", () => ({ CcCierreDiaProductTable: () => null }));
jest.mock("../CcCierreDiaUpsellCards", () => ({ CcCierreDiaUpsellCards: () => null }));

const hooks = jest.mocked(closingHooks);
const save = jest.fn();
const DATE = "2026-10-08";
const STORE = "store-a";
const manual: CierreDiaRecord = {
  storeId: STORE, date: DATE, pedidosIngresados: 2,
  porConfirmar: 0, contactado: 0, noContesta: 0, confirmado: 0,
  despachado: 0, entregado: 2, anulado: 0,
  ingreso: 200, costo: 50, publiMeta: 30.5, publiTiktok: 4, publiGoogle: 2,
  upsells: 0, savedAt: 1, updatedAt: 2,
};

beforeEach(() => {
  jest.clearAllMocks();
  save.mockResolvedValue(undefined);
  hooks.useCierreDiaDay.mockReturnValue({ data: null, isLoading: false } as ReturnType<typeof closingHooks.useCierreDiaDay>);
  hooks.useCierreDiaMonth.mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof closingHooks.useCierreDiaMonth>);
  hooks.useCierreDiaRange.mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof closingHooks.useCierreDiaRange>);
  hooks.useCierreDiaClosingDataDay.mockReturnValue({ data: undefined, isLoading: false, isError: false } as ReturnType<typeof closingHooks.useCierreDiaClosingDataDay>);
  hooks.useCierreDiaClosingDataRange.mockReturnValue({ data: undefined, isLoading: false, isError: false } as ReturnType<typeof closingHooks.useCierreDiaClosingDataRange>);
  hooks.useSaveCierreDia.mockReturnValue({ mutateAsync: save, isPending: false } as unknown as ReturnType<typeof closingHooks.useSaveCierreDia>);
  hooks.useDeleteCierreDia.mockReturnValue({ mutateAsync: jest.fn(), isPending: false } as unknown as ReturnType<typeof closingHooks.useDeleteCierreDia>);
});

afterEach(() => {
  window.localStorage.removeItem(`powip_cierre_dia_${STORE}`);
});

function expectCompanyRange(from: string, to: string) {
  expect(screen.getByText("Sin asignación a esta tienda")).toBeVisible();
  expect(screen.getByText(/Este cierre conserva su publicidad manual/)).toBeVisible();
  expect(screen.getByRole("link", { name: "Ver gasto de empresa" })).toHaveAttribute(
    "href", `/administracion/pauta?from=${from}&to=${to}`,
  );
}

it("keeps the company link on a day without orders or a saved close", () => {
  render(<CcCierreDiaDayView storeId={STORE} date={DATE} onRegularizar={jest.fn()} />);
  expectCompanyRange(DATE, DATE);
  expect(screen.getByText("Sin datos para este día")).toBeVisible();
  expect(save).not.toHaveBeenCalled();
});

it("preserves manual advertising and store identity when saving the day", async () => {
  const original = { ...manual };
  hooks.useCierreDiaDay.mockReturnValue({ data: manual, isLoading: false } as ReturnType<typeof closingHooks.useCierreDiaDay>);
  window.localStorage.setItem(`powip_cierre_dia_${STORE}`, JSON.stringify({ [DATE]: manual }));
  const storedBefore = window.localStorage.getItem(`powip_cierre_dia_${STORE}`);
  render(<CcCierreDiaDayView storeId={STORE} date={DATE} onRegularizar={jest.fn()} />);
  expectCompanyRange(DATE, DATE);
  expect(screen.getByDisplayValue("30.5")).toBeVisible();
  expect(manual).toEqual(original);
  expect(window.localStorage.getItem(`powip_cierre_dia_${STORE}`)).toBe(storedBefore);
  fireEvent.click(screen.getByRole("button", { name: /Guardar día/ }));
  await waitFor(() => expect(save).toHaveBeenCalledWith({
    date: DATE,
    input: {
      pedidosIngresados: 2, porConfirmar: 0, contactado: 0, noContesta: 0,
      confirmado: 0, despachado: 0, entregado: 2, anulado: 0,
      ingreso: 200, costo: 50, publiMeta: 30.5, publiTiktok: 4, publiGoogle: 2, upsells: 0,
    },
  }));
  expect(hooks.useSaveCierreDia).toHaveBeenCalledWith(STORE);
  expect(manual).toEqual(original);
});

it("links the modal to the edited day without changing its advertising inputs", () => {
  hooks.useCierreDiaDay.mockReturnValue({ data: manual, isLoading: false } as ReturnType<typeof closingHooks.useCierreDiaDay>);
  render(<CcCierreDiaModal storeId={STORE} date={DATE} onClose={jest.fn()} />);
  expectCompanyRange(DATE, DATE);
  expect(screen.getByDisplayValue("30.5")).toBeVisible();
  expect(save).not.toHaveBeenCalled();
});

it("links the exact range across month boundaries", () => {
  render(<CcCierreDiaRangoView storeId={STORE} range={{
    from: new Date("2026-09-29T00:00:00"), to: new Date("2026-10-08T00:00:00"),
  }} onRegularizar={jest.fn()} />);
  expectCompanyRange("2026-09-29", DATE);
  expect(save).not.toHaveBeenCalled();
});

it("links all calendar days of a leap month", () => {
  render(<CcCierreDiaMesView storeId={STORE} monthStr="2024-02" onRegularizar={jest.fn()} onVerDia={jest.fn()} />);
  expectCompanyRange("2024-02-01", "2024-02-29");
  expect(save).not.toHaveBeenCalled();
});
