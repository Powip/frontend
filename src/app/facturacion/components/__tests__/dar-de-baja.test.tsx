import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotasTab } from "@/app/facturacion/components/tabs/NotasTab";
import { useVoidSunatDocuments } from "@/features/sunat/sunat-document/hooks/use-void-sunat-documents";
import type { SunatDocument } from "@/features/sunat/sunat-document/models/sunat-document.model";

jest.mock("@/features/sunat/sunat-document/hooks/use-void-sunat-documents");
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mutateAsync = jest.fn();

function nota(correlative: string, overrides: Partial<SunatDocument> = {}): SunatDocument {
  return {
    id: `n${correlative}`,
    orderId: "order-ama",
    companyId: "ama",
    rucIssuer: "20601234567",
    taxDocumentType: "07",
    series: "FC01",
    correlative: `00000${correlative}`,
    issueDate: "2026-11-27",
    cdrStatus: "ACCEPTED",
    sunatCode: "0",
    sunatDescription: null,
    observations: null,
    signedXmlStoragePath: null,
    cdrStoragePath: null,
    digestValue: null,
    referenceDocumentId: "f48",
    voidStatus: null,
    voidReason: null,
    voidRequestedAt: null,
    voidTicket: null,
    voidSunatCode: null,
    voidSunatDescription: null,
    voidedAt: null,
    voidDeadline: "2026-12-04",
    voidable: true,
    createdAt: "2026-11-27T10:00:00Z",
    updatedAt: "2026-11-27T10:00:00Z",
    taxDocumentPayload: {
      totals: {
        currency: "PEN",
        subtotal: 70.71,
        discountTotal: 0,
        shippingTotal: 0,
        taxTotal: 12.73,
        grandTotal: 83.44,
      },
      items: [],
    },
    ...overrides,
  };
}

function renderNotas(notas: SunatDocument[]) {
  return render(
    <NotasTab
      notas={notas}
      documents={notas}
      hasAceptados
      onNuevaNota={jest.fn()}
      onImprimir={jest.fn()}
    />,
  );
}

describe("Dar de baja en Notas de crédito", () => {
  beforeEach(() => {
    mutateAsync.mockReset().mockResolvedValue([]);
    jest.mocked(useVoidSunatDocuments).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useVoidSunatDocuments>);
  });

  it("solo ofrece «Dar de baja» en las notas que se pueden dar de baja, con su plazo", () => {
    renderNotas([
      nota("418"),
      nota("419", { voidStatus: "VOIDED", voidable: false }),
      nota("420", { voidable: false }),
    ]);

    expect(screen.getByTestId("dar-de-baja-n418")).toBeInTheDocument();
    expect(screen.queryByTestId("dar-de-baja-n419")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dar-de-baja-n420")).not.toBeInTheDocument();
    expect(screen.getByText("Plazo hasta 04/12/2026")).toBeInTheDocument();
  });

  it("muestra la etiqueta de baja y el mensaje de SUNAT si fue rechazada", () => {
    renderNotas([
      nota("417", { voidStatus: "IN_PROCESS", voidable: false }),
      nota("418", { voidStatus: "VOIDED", voidable: false }),
      nota("419", {
        voidStatus: "REJECTED",
        voidSunatCode: "2398",
        voidSunatDescription: "El documento no puede ser dado de baja",
      }),
    ]);

    expect(screen.getByTestId("baja-estado-n417")).toHaveTextContent("Baja en proceso");
    expect(screen.getByTestId("baja-estado-n418")).toHaveTextContent("De baja");
    expect(screen.getByTestId("baja-estado-n419")).toHaveTextContent("Baja rechazada");
    expect(screen.getByText("2398 · El documento no puede ser dado de baja")).toBeInTheDocument();
  });

  it("pide motivo y confirmar que es irreversible antes de enviar", async () => {
    const user = userEvent.setup();
    renderNotas([nota("418")]);

    await user.click(screen.getByTestId("dar-de-baja-n418"));
    const dialog = await screen.findByRole("dialog");
    const enviar = within(dialog).getByRole("button", { name: "Dar de baja" });

    expect(within(dialog).getByTestId("baja-plazo")).toHaveTextContent("04/12/2026");
    expect(enviar).toBeDisabled();

    await user.type(within(dialog).getByLabelText("Motivo de la baja"), "NC duplicada");
    expect(enviar).toBeDisabled();

    await user.click(within(dialog).getByLabelText("Entiendo que la baja es irreversible."));
    expect(enviar).toBeEnabled();

    await user.click(enviar);

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ documentIds: ["n418"], reason: "NC duplicada" }),
    );
  });
});
