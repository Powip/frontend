import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EmitirComprobanteModal from "@/app/facturacion/components/modals/EmitirComprobanteModal";
import type { Order } from "@/features/sales/models/order";
import { useCreateSunatDocuments } from "@/features/sunat/sunat-document/hooks/use-create-sunat-documents";
import { useSunatDocumentSequences } from "@/features/sunat/sunat-document-sequence/hooks/use-sunat-document-sequences";
import type { SunatDocumentSequence } from "@/features/sunat/sunat-document-sequence/models/sunat-document-sequence";
import { useSunatProfiles } from "@/features/sunat/sunat-profile/hooks/use-sunat-profiles";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";

jest.mock("@/features/sunat/sunat-profile/hooks/use-sunat-profiles");
jest.mock("@/features/sunat/sunat-document-sequence/hooks/use-sunat-document-sequences");
jest.mock("@/features/sunat/sunat-document/hooks/use-create-sunat-documents");

function profile(overrides: Partial<SunatProfile>): SunatProfile {
  return {
    id: "p1",
    companyId: "c1",
    name: "Perfil",
    description: null,
    ruc: "20111111111",
    razonSocial: "PRINCIPAL S.A.C.",
    countryCode: "PE",
    ubigeo: "150101",
    address: "Av. 1",
    establishmentCode: "0000",
    logoUrl: null,
    certificateSubject: null,
    certificateSerial: null,
    certificateValidFrom: new Date("2026-01-01"),
    certificateValidUntil: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000),
    isDefault: false,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function boleta(ruc: string, series: string, nextCorrelative: number): SunatDocumentSequence {
  return {
    companyId: "c1",
    rucIssuer: ruc,
    taxDocumentType: "03",
    series,
    nextCorrelative,
    isDefault: true,
  };
}

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
      unitPrice: 118,
      discountAmount: 0,
    },
  ],
} as unknown as Order;

const mutateAsync = jest.fn().mockResolvedValue({ results: [] });

beforeEach(() => {
  jest.clearAllMocks();
  (useSunatProfiles as jest.Mock).mockReturnValue({
    data: [
      profile({ id: "p1", ruc: "20111111111", isDefault: true }),
      profile({ id: "p2", ruc: "20222222222", razonSocial: "SEGUNDA E.I.R.L." }),
    ],
    isLoading: false,
  });
  (useSunatDocumentSequences as jest.Mock).mockImplementation((profileId?: string) => ({
    data:
      profileId === "p2" ? [boleta("20222222222", "B002", 41)] : [boleta("20111111111", "B001", 5)],
    isLoading: false,
  }));
  (useCreateSunatDocuments as jest.Mock).mockReturnValue({ mutateAsync, isPending: false });
});

function renderModal(issuerProfileId?: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <EmitirComprobanteModal
        isOpen
        onClose={jest.fn()}
        sale={sale}
        issuerProfileId={issuerProfileId}
      />
    </QueryClientProvider>,
  );
}

describe("EmitirComprobanteModal — multi-RUC", () => {
  it("usa el RUC de la barra: su serie, su próximo número y lo envía al backend", async () => {
    renderModal("p2");

    expect(await screen.findByText("B002-00000041")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Emitir a SUNAT/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0][0].documents[0]).toMatchObject({
      sunatProfileId: "p2",
      series: "B002",
    });
  });

  it("sin RUC en la barra parte del predeterminado", async () => {
    renderModal();

    expect(await screen.findByText("B001-00000005")).toBeInTheDocument();
  });
});
