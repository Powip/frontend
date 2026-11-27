import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EmitirComprobanteModal from "@/app/facturacion/components/modals/EmitirComprobanteModal";
import type { Order } from "@/features/sales/models/order";
import { useCreateSunatDocuments } from "@/features/sunat/sunat-document/hooks/use-create-sunat-documents";
import { useOrderPrepayments } from "@/features/sunat/sunat-document/hooks/use-order-prepayments";
import { useSunatDocumentSequences } from "@/features/sunat/sunat-document-sequence/hooks/use-sunat-document-sequences";
import type { SunatDocumentSequence } from "@/features/sunat/sunat-document-sequence/models/sunat-document-sequence";
import { useSunatProfiles } from "@/features/sunat/sunat-profile/hooks/use-sunat-profiles";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";

jest.mock("@/features/sunat/sunat-profile/hooks/use-sunat-profiles");
jest.mock("@/features/sunat/sunat-document-sequence/hooks/use-sunat-document-sequences");
jest.mock("@/features/sunat/sunat-document/hooks/use-create-sunat-documents");
jest.mock("@/features/sunat/sunat-document/hooks/use-order-prepayments");

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

// Shape returned by the emission hook: created documents and, apart, the
// documents the backend refused (it still answers 201 for those).
const mutateAsync = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mutateAsync.mockResolvedValue({ documents: [{ id: "doc-1" }], errors: [] });
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
  (useOrderPrepayments as jest.Mock).mockReturnValue({ ready: [], waiting: [], isLoading: false });
});

function renderModal(issuerProfileId?: string, saleToEmit: Order = sale) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <EmitirComprobanteModal
        isOpen
        onClose={jest.fn()}
        sale={saleToEmit}
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

  it("si el backend rechaza el comprobante, muestra el motivo y no un falso éxito", async () => {
    mutateAsync.mockResolvedValue({
      documents: [],
      errors: [
        {
          orderId: "order-1",
          error: { code: "SUNAT_DOCUMENT_SEQUENCE_NOT_INITIALIZED", message: "not initialized" },
        },
      ],
    });
    renderModal("p2");

    await screen.findByText("B002-00000041");
    await userEvent.click(screen.getByRole("button", { name: /Emitir a SUNAT/i }));

    expect(await screen.findByText(/no tiene esa serie configurada/i)).toBeInTheDocument();
    expect(screen.getByText("No se pudo emitir el comprobante")).toBeInTheDocument();
    expect(screen.queryByText(/enviado correctamente/i)).not.toBeInTheDocument();
  });

  it("si el backend lo crea, muestra el éxito", async () => {
    renderModal("p2");

    await screen.findByText("B002-00000041");
    await userEvent.click(screen.getByRole("button", { name: /Emitir a SUNAT/i }));

    expect(await screen.findByText(/enviado correctamente/i)).toBeInTheDocument();
  });
});

describe("EmitirComprobanteModal — validar antes de enviar a SUNAT", () => {
  const withItems = (items: unknown[], extra: Record<string, unknown> = {}) =>
    ({ ...sale, items, ...extra }) as unknown as Order;
  const product = {
    id: "i1",
    sku: "SKU-1",
    productName: "Kit",
    quantity: 1,
    unitPrice: 118,
    discountAmount: 0,
  };

  it("una venta con un regalo a precio 0 no se puede emitir: avisa cuál línea y por qué", async () => {
    renderModal(
      "p1",
      withItems([
        { ...product, id: "i0", sku: "REG", productName: "Muestra de regalo", unitPrice: 0 },
        product,
      ]),
    );

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent("No se puede emitir: «Muestra de regalo» queda en S/ 0.00.");
    expect(alert).toHaveTextContent("error 3105");
    expect(screen.getByText("Hay una línea en S/ 0.00: revisa los ítems.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Emitir a SUNAT/i })).toBeDisabled();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("el envío gratis no va en el comprobante y no bloquea la emisión", async () => {
    renderModal("p1", withItems([product], { shippingTotal: 10, discountTotal: 10 }));

    await screen.findByLabelText("Descuento de Kit");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Servicio de entrega")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Emitir a SUNAT/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const sent = mutateAsync.mock.calls[0][0].documents[0];
    // Solo el producto, y el total es lo que el cliente pagó.
    expect(sent.items).toHaveLength(1);
    expect(sent.items[0].sku).toBe("SKU-1");
    expect(sent.totals.grandTotal).toBe(118);
  });

  it("al quitar la línea en cero se puede emitir", async () => {
    renderModal(
      "p1",
      withItems([
        { ...product, id: "i0", sku: "REG", productName: "Muestra de regalo", unitPrice: 0 },
        product,
      ]),
    );

    await userEvent.click(await screen.findByRole("button", { name: "Quitar Muestra de regalo" }));

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Emitir a SUNAT/i })).toBeEnabled();
  });

  it("una venta con descuento muestra el descuento con 2 decimales y el navegador deja enviar", async () => {
    renderModal("p1", withItems([{ ...product, unitPrice: 199, discountAmount: 10 }]));

    const discount = (await screen.findByLabelText("Descuento de Kit")) as HTMLInputElement;

    // 10 con IGV incluido = 8.474576... sin IGV: se ve redondeado y es un valor válido.
    expect(discount.value).toBe("8.47");
    expect(discount.checkValidity()).toBe(true);
    expect(
      (screen.getByLabelText("Precio unitario de Kit") as HTMLInputElement).checkValidity(),
    ).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: /Emitir a SUNAT/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    // Por dentro conserva la precisión completa, para no descuadrar centavos.
    expect(mutateAsync.mock.calls[0][0].documents[0].items[0].discountAmount).toBeCloseTo(
      10 / 1.18,
      6,
    );
  });
});
