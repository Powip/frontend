import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import QuotationsPage from "../page";
import { listQuotations } from "@/services/quotationService";

let mockSelectedStoreId: string | null = null;
const mockSetSelectedStore = jest.fn();
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
  QuotationWhatsAppDialog: () => null,
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
  await waitFor(() => expect(listQuotations).toHaveBeenCalledWith(expect.objectContaining({ storeId: "store-2" })));
  expect(screen.getAllByRole("button", { name: "Nueva cotización" }).every((button) => !(button as HTMLButtonElement).disabled)).toBe(true);
}, 30000);
