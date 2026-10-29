import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PublicQuotationPaymentDestinations from "../PublicQuotationPaymentDestinations";
import QuotationPaymentSettings from "../QuotationPaymentSettings";
import * as api from "@/services/quotationSettingsService";

jest.mock("@/services/quotationSettingsService");
const destination = {
  id: "test-yape",
  method: "YAPE_QR" as const,
  label: "Yape oficial",
  holder: "Negocio de prueba",
  phone: "900000001",
  enabled: true,
};

describe("Quotation payment destinations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value: () => "00000000-0000-4000-8000-000000000001",
    });
  });
  it("shows configured public payment details while leaving pending verification explicit", () => {
    render(
      <PublicQuotationPaymentDestinations
        destinations={[
          destination,
          { ...destination, id: "hidden", label: "Destino deshabilitado", enabled: false },
          {
            id: "bank",
            method: "TRANSFERENCIA",
            label: "Transferencia",
            holder: "Negocio",
            bank: "Banco de prueba",
            accountNumber: "123456789",
            cci: "12345678901234567890",
          },
        ]}
      />,
    );
    expect(screen.getByText("Yape oficial")).toBeInTheDocument();
    expect(screen.getByText("900000001")).toBeInTheDocument();
    expect(screen.getByText("12345678901234567890")).toBeInTheDocument();
    expect(screen.queryByText("Destino deshabilitado")).not.toBeInTheDocument();
    expect(screen.getByText(/comprobante quedará pendiente/)).toBeInTheDocument();
  });
  it("does not invent a payment destination or render an unsafe QR", () => {
    const { rerender } = render(<PublicQuotationPaymentDestinations />);
    expect(screen.getByText(/aún no ha configurado/)).toBeInTheDocument();
    rerender(
      <PublicQuotationPaymentDestinations
        destinations={[{ ...destination, qrUrl: "javascript:alert(1)" }]}
      />,
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
  it("allows an administrator to configure a real Yape destination with version control", async () => {
    jest
      .mocked(api.getQuotationSettings)
      .mockResolvedValue({ storeId: "store-a", destinations: [], version: 0, canManage: true });
    jest
      .mocked(api.saveQuotationSettings)
      .mockResolvedValue({
        storeId: "store-a",
        destinations: [destination],
        version: 1,
        canManage: true,
      });
    const user = userEvent.setup();
    render(<QuotationPaymentSettings storeId="store-a" />);
    await user.click(await screen.findByRole("button", { name: "Añadir Yape" }));
    await user.type(screen.getByLabelText("Titular"), "Negocio de prueba");
    await user.type(screen.getByLabelText("Número Yape"), "900000001");
    await user.click(screen.getByRole("button", { name: "Guardar datos de pago" }));
    await waitFor(() =>
      expect(api.saveQuotationSettings).toHaveBeenCalledWith("store-a", 0, [
        expect.objectContaining({
          holder: "Negocio de prueba",
          phone: "900000001",
          enabled: true,
          method: "YAPE_QR",
        }),
      ]),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Datos de pago guardados");
  });
  it("keeps configuration read-only for a seller", async () => {
    jest
      .mocked(api.getQuotationSettings)
      .mockResolvedValue({
        storeId: "store-a",
        destinations: [destination],
        version: 1,
        canManage: false,
      });
    render(<QuotationPaymentSettings storeId="store-a" />);
    expect(await screen.findByLabelText("Titular")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Guardar datos de pago" })).not.toBeInTheDocument();
  });
});
