import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import QuotationsPage from "../page";
import { listQuotations } from "@/services/quotationService";

let mockSelectedStoreId: string | null = null;
const mockSetSelectedStore = jest.fn();
jest.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
jest.mock("@/services/commercialLeadsService", () => ({
  getCommercialLeadConfirmationCapabilities: jest.fn().mockResolvedValue({ enabled: false, canConfirm: true }),
}));
jest.mock("@/components/quotations/QuotationPaymentSettings", () => ({ __esModule: true, default: () => null }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      user: { role: "ADMIN", permissions: [] },
      company: { stores: [{ id: "store-1", name: "Tienda Lima" }, { id: "store-2", name: "Tienda Sur" }] },
    },
    selectedStoreId: mockSelectedStoreId,
    setSelectedStore: mockSetSelectedStore,
  }),
}));
jest.mock("@/contexts/PacksContext", () => ({
  PacksProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/quotations/QuotationForm", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/quotations/QuotationDialogs", () => ({
  QuotationDetailDialog: () => null,
  QuotationConvertDialog: () => null,
  QuotationPaymentDialog: () => null,
  QuotationShareDialog: () => null,
}));
jest.mock("@/services/quotationService", () => ({ listQuotations: jest.fn() }));

it("lets an all-store session choose the store before loading or creating quotations", async () => {
  mockSelectedStoreId = null;
  (listQuotations as jest.Mock).mockResolvedValue({
    data: [], total: 0, page: 1, limit: 15,
    summary: { PREVENTA: 0, VENCIDA: 0, CONVERTIDA: 0, totalAmount: 0 },
  });
  const { rerender } = render(<QuotationsPage />);
  expect(screen.getByRole("button", { name: "Nueva cotización" })).toBeDisabled();
  expect(listQuotations).not.toHaveBeenCalled();

  fireEvent.change(screen.getByRole("combobox", { name: "Tienda de cotización" }), {
    target: { value: "store-2" },
  });
  expect(mockSetSelectedStore).toHaveBeenCalledWith("store-2");
  mockSelectedStoreId = "store-2";
  rerender(<QuotationsPage />);
  await waitFor(() => expect(listQuotations).toHaveBeenCalledWith(expect.objectContaining({ storeId: "store-2" }), expect.objectContaining({ signal: expect.any(AbortSignal) })));
  expect(screen.getAllByRole("button", { name: "Nueva cotización" }).every((button) => !(button as HTMLButtonElement).disabled)).toBe(true);
}, 30000);

it("pauses seller list refreshes while hidden or editing payment settings", async () => {
  jest.useFakeTimers();
  let visibility: DocumentVisibilityState = "visible";
  const visible = jest.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
  mockSelectedStoreId = "store-1";
  jest.mocked(listQuotations).mockClear().mockResolvedValue({
    data: [], total: 0, page: 1, limit: 15,
    summary: { PREVENTA: 0, VENCIDA: 0, CONVERTIDA: 0, totalAmount: 0 },
  });
  try {
    render(<QuotationsPage />);
    await waitFor(() => expect(listQuotations).toHaveBeenCalledTimes(1));
    visibility = "hidden";
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => { jest.advanceTimersByTime(90_000); });
    expect(listQuotations).toHaveBeenCalledTimes(1);
    visibility = "visible";
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => expect(listQuotations).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Datos de cobro" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => { jest.advanceTimersByTime(60_000); });
    expect(listQuotations).toHaveBeenCalledTimes(2);
  } finally {
    visible.mockRestore();
    jest.useRealTimers();
  }
}, 30000);
