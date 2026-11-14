import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoteEmisionModal from "@/app/facturacion/components/modals/LoteEmisionModal";
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

function boletaSequence(ruc: string, series: string): SunatDocumentSequence {
  return {
    companyId: "c1",
    rucIssuer: ruc,
    taxDocumentType: "03",
    series,
    nextCorrelative: 7,
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

function given(
  profiles: SunatProfile[],
  sequencesByProfile: Record<string, SunatDocumentSequence[]>,
) {
  (useSunatProfiles as jest.Mock).mockReturnValue({ data: profiles, isLoading: false });
  (useSunatDocumentSequences as jest.Mock).mockImplementation((profileId?: string) => ({
    data: sequencesByProfile[profileId ?? "default"] ?? [],
    isLoading: false,
  }));
  (useCreateSunatDocuments as jest.Mock).mockReturnValue({ mutateAsync, isPending: false });
}

const principal = profile({
  id: "p1",
  ruc: "20111111111",
  razonSocial: "PRINCIPAL S.A.C.",
  isDefault: true,
});
const segunda = profile({ id: "p2", ruc: "20222222222", razonSocial: "SEGUNDA E.I.R.L." });

describe("LoteEmisionModal — multi-RUC", () => {
  beforeEach(() => jest.clearAllMocks());

  it("emite el lote con el RUC elegido y su serie predeterminada", async () => {
    given([principal, segunda], {
      p1: [boletaSequence("20111111111", "B001")],
      p2: [boletaSequence("20222222222", "B002")],
    });

    render(<LoteEmisionModal isOpen onClose={jest.fn()} sales={[sale]} issuerProfileId="p2" />);

    expect(
      screen.getByText(/todos los comprobantes del lote se emitirán con este RUC/i),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Emitir 1 comprobantes/i }));

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync.mock.calls[0][0].documents[0]).toMatchObject({
      sunatProfileId: "p2",
      series: "B002",
    });
  });

  it("bloquea si el RUC elegido no tiene serie predeterminada para el tipo", async () => {
    given([principal, segunda], { p1: [boletaSequence("20111111111", "B001")], p2: [] });

    render(<LoteEmisionModal isOpen onClose={jest.fn()} sales={[sale]} issuerProfileId="p2" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /20222222222 no tiene serie predeterminada para Boleta/,
    );
    expect(screen.getByRole("button", { name: /Emitir 1 comprobantes/i })).toBeDisabled();
  });

  it("bloquea un RUC con certificado vencido", () => {
    const vencido = profile({
      ...segunda,
      certificateValidUntil: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    given([principal, vencido], { p2: [boletaSequence("20222222222", "B002")] });

    render(<LoteEmisionModal isOpen onClose={jest.fn()} sales={[sale]} issuerProfileId="p2" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /certificado digital de este RUC está vencido/i,
    );
    expect(screen.getByRole("button", { name: /Emitir 1 comprobantes/i })).toBeDisabled();
  });

  it("con un solo RUC no muestra selector y usa su serie predeterminada", async () => {
    given([principal], { p1: [boletaSequence("20111111111", "B001")] });

    render(<LoteEmisionModal isOpen onClose={jest.fn()} sales={[sale]} />);

    expect(screen.queryByRole("combobox", { name: "Emisor (RUC)" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Emitir 1 comprobantes/i }));

    expect(mutateAsync.mock.calls[0][0].documents[0]).toMatchObject({
      series: "B001",
      sunatProfileId: "p1",
    });
  });
});
