import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EmitirComprobanteModal from "@/app/facturacion/components/modals/EmitirComprobanteModal";
import type { Order } from "@/features/sales/models/order";
import { useCreateSunatDocuments } from "@/features/sunat/sunat-document/hooks/use-create-sunat-documents";
import { useOrderPrepayments } from "@/features/sunat/sunat-document/hooks/use-order-prepayments";
import type { SunatDocument } from "@/features/sunat/sunat-document/models/sunat-document.model";
import { useSunatDocumentSequences } from "@/features/sunat/sunat-document-sequence/hooks/use-sunat-document-sequences";
import { useSunatProfiles } from "@/features/sunat/sunat-profile/hooks/use-sunat-profiles";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";

jest.mock("@/features/sunat/sunat-profile/hooks/use-sunat-profiles");
jest.mock("@/features/sunat/sunat-document-sequence/hooks/use-sunat-document-sequences");
jest.mock("@/features/sunat/sunat-document/hooks/use-create-sunat-documents");
jest.mock("@/features/sunat/sunat-document/hooks/use-order-prepayments");

const profile = {
  id: "p1",
  companyId: "c1",
  name: "Perfil",
  description: null,
  ruc: "20123456789",
  razonSocial: "EMPRESA DE PRUEBA S.A.C.",
  countryCode: "PE",
  ubigeo: "150101",
  address: "Av. 1",
  establishmentCode: "0000",
  logoUrl: null,
  certificateSubject: null,
  certificateSerial: null,
  certificateValidFrom: new Date("2026-01-01"),
  certificateValidUntil: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000),
  isDefault: true,
  isActive: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
} as SunatProfile;

const sale = {
  id: "order-1",
  orderNumber: "ORD-1",
  taxMode: "INCLUIDO",
  shippingTotal: 0,
  discountTotal: 0,
  customer: {
    fullName: "Cliente",
    documentType: "DNI",
    documentNumber: "12345678",
    address: "Av. 1",
  },
  items: [
    {
      id: "i1",
      sku: "SKU-1",
      productName: "Producto",
      quantity: 1,
      unitPrice: 354,
      discountAmount: 0,
    },
  ],
} as unknown as Order;

function anticipo(overrides: Partial<SunatDocument> = {}): SunatDocument {
  return {
    id: "ant-1",
    orderId: "order-1",
    companyId: "c1",
    rucIssuer: "20123456789",
    taxDocumentType: "03",
    series: "B001",
    correlative: "00000007",
    issueDate: "2026-11-20",
    cdrStatus: "ACCEPTED",
    taxDocumentPayload: {
      isPrepayment: true,
      items: [],
      totals: { currency: "PEN", subtotal: 100, taxTotal: 18, grandTotal: 118 },
    },
    referenceDocumentId: null,
    ...overrides,
  } as unknown as SunatDocument;
}

const mutateAsync = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mutateAsync.mockResolvedValue({ documents: [{ id: "doc-1" }], errors: [] });
  (useSunatProfiles as jest.Mock).mockReturnValue({ data: [profile], isLoading: false });
  (useSunatDocumentSequences as jest.Mock).mockReturnValue({
    data: [
      {
        companyId: "c1",
        rucIssuer: "20123456789",
        taxDocumentType: "03",
        series: "B001",
        nextCorrelative: 8,
        isDefault: true,
      },
    ],
    isLoading: false,
  });
  (useCreateSunatDocuments as jest.Mock).mockReturnValue({ mutateAsync, isPending: false });
  (useOrderPrepayments as jest.Mock).mockReturnValue({ ready: [], waiting: [], isLoading: false });
});

function renderModal() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <EmitirComprobanteModal isOpen onClose={jest.fn()} sale={sale} issuerProfileId="p1" />
    </QueryClientProvider>,
  );
}

describe("EmitirComprobanteModal — anticipos", () => {
  it("emite un anticipo: una sola línea por el monto recibido, con IGV incluido", async () => {
    renderModal();
    await screen.findByText("B001-00000008");

    await userEvent.click(screen.getByRole("tab", { name: /Anticipo/i }));
    await userEvent.type(screen.getByLabelText(/Monto recibido/i), "118");
    await userEvent.click(screen.getByRole("button", { name: /Emitir anticipo/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const [document] = mutateAsync.mock.calls[0][0].documents;
    expect(document.isPrepayment).toBe(true);
    expect(document.prepaymentDocumentIds).toBeUndefined();
    expect(document.items).toHaveLength(1);
    expect(document.items[0]).toMatchObject({ sku: "ANTICIPO", taxType: "10", subtotal: 100 });
    expect(document.totals).toMatchObject({ subtotal: 100, taxTotal: 18, grandTotal: 118 });
  });

  it("no deja emitir un anticipo igual o mayor a lo que falta pagar", async () => {
    renderModal();
    await screen.findByText("B001-00000008");

    await userEvent.click(screen.getByRole("tab", { name: /Anticipo/i }));
    await userEvent.type(screen.getByLabelText(/Monto recibido/i), "354");

    expect(screen.getByText(/Debe ser menor a lo que falta pagar/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Emitir anticipo/i })).toBeDisabled();
  });

  it("el comprobante de la venta descuenta el anticipo aceptado y muestra lo que falta pagar", async () => {
    (useOrderPrepayments as jest.Mock).mockReturnValue({
      ready: [anticipo()],
      waiting: [],
      isLoading: false,
    });
    renderModal();
    await screen.findByText("B001-00000008");

    expect(screen.getByText("Anticipo B001-00000007")).toBeInTheDocument();
    expect(screen.getByText("A pagar")).toBeInTheDocument();
    expect(screen.getAllByText(/236\.00/).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: /Emitir a SUNAT/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const [document] = mutateAsync.mock.calls[0][0].documents;
    expect(document.prepaymentDocumentIds).toEqual(["ant-1"]);
    expect(document.isPrepayment).toBeUndefined();
    // Full values: the backend deducts the anticipo.
    expect(document.totals.grandTotal).toBe(354);
  });

  it("espera la respuesta de SUNAT a un anticipo antes de emitir el comprobante de la venta", async () => {
    (useOrderPrepayments as jest.Mock).mockReturnValue({
      ready: [],
      waiting: [anticipo({ cdrStatus: "PENDING" })],
      isLoading: false,
    });
    renderModal();
    await screen.findByText("B001-00000008");

    expect(
      screen.getByText(/SUNAT aún no responde el anticipo B001-00000007/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Emitir a SUNAT/i })).toBeDisabled();
  });
});
