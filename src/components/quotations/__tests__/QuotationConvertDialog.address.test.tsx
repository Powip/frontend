import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QuotationConvertDialog } from "../QuotationDialogs";
import { convertQuotation } from "@/services/quotationService";
import type { Quotation } from "@/types/quotations";

jest.mock("@/services/quotationService", () => ({ convertQuotation: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const quote = (overrides: Partial<Quotation> = {}): Quotation => ({
  id: "quote-location", number: "COT-0042", storeId: "store-1", customerName: "Ana", customerPhone: "999222333",
  status: "PREVENTA", paymentType: "ADELANTO", expiresAt: new Date(Date.now() + 86400000).toISOString(),
  lines: [{ id: "line", productVariantId: "variant-1", name: "Crema", quantity: 1, unitPrice: 100, stockAvailable: 4 }],
  payments: [], total: 100, pendingBalance: 100, approvedDeposit: 0, customerConfirmed: true,
  publicToken: "token", publicUrl: "https://www.powip.tech/c/token", createdAt: new Date().toISOString(),
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

it("preserves the saved DNI, reference and geographic selection when converting", async () => {
  const quotation = quote({ address: {
    address: "Av. Ejemplo 123", department: "AREQUIPA", province: "Arequipa", district: "Cayma",
    reference: "Frente al parque", documentNumber: "12345678",
  } });
  jest.mocked(convertQuotation).mockResolvedValue({ ...quotation, status: "CONVERTIDA" });
  render(<QuotationConvertDialog quotation={quotation} onClose={jest.fn()} onSaved={jest.fn()} />);

  expect(screen.getByLabelText("Departamento *")).toHaveValue("Arequipa");
  expect(screen.getByLabelText("Provincia *")).toHaveValue("Arequipa");
  expect(screen.getByLabelText("Distrito *")).toHaveValue("Cayma");
  expect(screen.getByLabelText("Zona")).toHaveValue("PROVINCIAS");
  expect(screen.getByLabelText("DNI (opcional)")).toHaveValue("12345678");
  for (const [label, value] of [
    ["Moneda (PEN, USD…) *", "PEN"], ["Canal de venta", "WHATSAPP"],
    ["Canal de cierre", "LLAMADA"], ["Tipo de pago", "CONTRAENTREGA"],
  ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar y crear venta" }));

  await waitFor(() => expect(convertQuotation).toHaveBeenCalledWith(quotation.id, expect.objectContaining({
    address: "Av. Ejemplo 123", department: "Arequipa", province: "Arequipa", district: "Cayma",
    reference: "Frente al parque", documentNumber: "12345678", zone: "PROVINCIAS", salesRegion: "PROVINCIA",
  })));
});

it("starts without invented location defaults and resets dependent selections", () => {
  render(<QuotationConvertDialog quotation={quote()} onClose={jest.fn()} onSaved={jest.fn()} />);
  expect(screen.getByLabelText("Departamento *")).toHaveValue("");
  expect(screen.getByLabelText("Provincia *")).toBeDisabled();
  expect(screen.getByLabelText("Distrito *")).toBeDisabled();
  expect(screen.getByLabelText("Zona")).toHaveValue("");

  fireEvent.change(screen.getByLabelText("Departamento *"), { target: { value: "Lima" } });
  fireEvent.change(screen.getByLabelText("Provincia *"), { target: { value: "Lima" } });
  fireEvent.change(screen.getByLabelText("Distrito *"), { target: { value: "Breña" } });
  fireEvent.change(screen.getByLabelText("Zona"), { target: { value: "LIMA_CENTRO" } });
  fireEvent.change(screen.getByLabelText("Departamento *"), { target: { value: "Arequipa" } });

  expect(screen.getByLabelText("Provincia *")).toHaveValue("");
  expect(screen.getByLabelText("Distrito *")).toHaveValue("");
  expect(screen.getByLabelText("Distrito *")).toBeDisabled();
  expect(screen.getByLabelText("Zona")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("Provincia *"), { target: { value: "Arequipa" } });
  expect(screen.getByLabelText("Zona")).toHaveValue("PROVINCIAS");
  fireEvent.change(screen.getByLabelText("Distrito *"), { target: { value: "Cayma" } });
  fireEvent.change(screen.getByLabelText("Provincia *"), { target: { value: "Camana" } });
  expect(screen.getByLabelText("Distrito *")).toHaveValue("");
  expect(screen.queryByRole("option", { name: "Cayma" })).not.toBeInTheDocument();
});

it.each([
  { department: "Callao", province: "Callao", district: "Bellavista", salesRegion: "LIMA", zone: "" },
  { department: "Lima", province: "Barranca", district: "Barranca", salesRegion: "PROVINCIA", zone: "PROVINCIAS" },
])("uses the API dispatch region for $department / $province", async ({ salesRegion, zone, ...location }) => {
  const quotation = quote({ address: { address: "Av. Ejemplo 123", ...location } });
  jest.mocked(convertQuotation).mockResolvedValue({ ...quotation, status: "CONVERTIDA" });
  render(<QuotationConvertDialog quotation={quotation} onClose={jest.fn()} onSaved={jest.fn()} />);
  expect(screen.getByLabelText("Zona")).toHaveValue(zone);
  for (const [label, value] of [
    ["Moneda (PEN, USD…) *", "PEN"], ["Canal de venta", "WHATSAPP"],
    ["Canal de cierre", "LLAMADA"], ["Tipo de pago", "CONTRAENTREGA"],
  ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar y crear venta" }));
  await waitFor(() => expect(convertQuotation).toHaveBeenCalledWith(quotation.id, expect.objectContaining({ ...location, salesRegion, zone })));
});
