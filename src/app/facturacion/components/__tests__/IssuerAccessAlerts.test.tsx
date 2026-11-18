import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IssuerAccessAlerts } from "@/app/facturacion/components/IssuerAccessAlerts";
import type { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";
import { useReleaseSunatIssuerAccessBlock } from "@/features/sunat/sunat-issuer-access/hooks/use-release-sunat-issuer-access-block";
import { useSunatIssuerAccessBlocks } from "@/features/sunat/sunat-issuer-access/hooks/use-sunat-issuer-access-blocks";

jest.mock("@/features/sunat/sunat-issuer-access/hooks/use-sunat-issuer-access-blocks");
jest.mock("@/features/sunat/sunat-issuer-access/hooks/use-release-sunat-issuer-access-block");

const RUC = "20123456789";
const mutate = jest.fn();

const invoiceBlock = {
  sunatProfileId: "profile-1",
  rucIssuer: RUC,
  razonSocial: "AMAGREEN S.A.C.",
  solUser: "FACTURA1",
  taxDocumentType: "01",
  category: "AUTHORIZATION",
  sunatCode: "0111",
  sunatMessage: "No tiene el perfil para enviar comprobantes electronicos",
  heldDocuments: 3,
};

const acceptedReceipt = {
  sale: { id: "sale-1" },
  taxDocument: {
    id: "doc-1",
    rucIssuer: RUC,
    taxDocumentType: "03",
    series: "B001",
    correlative: "00000045",
    cdrStatus: "ACCEPTED",
    createdAt: "2026-11-16T09:00:00Z",
  },
} as unknown as TaxDocumentRow;

function given(blocks: unknown[]) {
  (useSunatIssuerAccessBlocks as jest.Mock).mockReturnValue({ data: blocks });
  (useReleaseSunatIssuerAccessBlock as jest.Mock).mockReturnValue({ mutate, isPending: false });
}

describe("IssuerAccessAlerts", () => {
  beforeEach(() => jest.clearAllMocks());

  it("no muestra nada cuando SUNAT no está rechazando ningún RUC", () => {
    given([]);
    const { container } = render(<IssuerAccessAlerts rows={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("dice qué falla (facturas), de qué RUC, por qué, con qué usuario SOL y cuántos comprobantes esperan", () => {
    given([invoiceBlock]);
    render(<IssuerAccessAlerts rows={[]} />);

    const alert = screen.getByRole("alert");

    expect(alert).toHaveTextContent(
      "SUNAT no está aceptando las facturas de AMAGREEN S.A.C. (RUC 20123456789)",
    );
    expect(alert).toHaveTextContent("No es un problema de los comprobantes");
    expect(alert).toHaveTextContent(
      "El usuario SOL no tiene permiso para enviar comprobantes electrónicos",
    );
    expect(alert).toHaveTextContent("Código 0111 de SUNAT");
    expect(alert).toHaveTextContent(
      "SUNAT respondió: «No tiene el perfil para enviar comprobantes electronicos»",
    );
    expect(alert).toHaveTextContent("Usuario SOL con el que se envía: FACTURA1");
    expect(alert).toHaveTextContent("Hay 3 comprobantes en espera. Conservan su número");
  });

  it("si las boletas de ese RUC sí se aceptan, lo dice: el problema es solo con las facturas", () => {
    given([invoiceBlock]);
    render(<IssuerAccessAlerts rows={[acceptedReceipt]} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "SUNAT sí está aceptando las boletas de este RUC (última aceptada: B001-00000045). El problema es solo con las facturas.",
    );
  });

  it("no afirma que las boletas funcionan si no hay ninguna boleta aceptada", () => {
    given([invoiceBlock]);
    render(<IssuerAccessAlerts rows={[]} />);

    expect(screen.getByRole("alert")).not.toHaveTextContent("sí está aceptando");
  });

  it("el botón reenvía solo las facturas de ese RUC", async () => {
    given([invoiceBlock]);
    render(<IssuerAccessAlerts rows={[]} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Ya lo corregí en SUNAT — reenviar facturas" }),
    );

    expect(mutate).toHaveBeenCalledWith({ sunatProfileId: "profile-1", taxDocumentType: "01" });
  });

  it("un aviso por cada tipo bloqueado, y uno distinto si es la clave SOL", () => {
    given([
      invoiceBlock,
      {
        ...invoiceBlock,
        rucIssuer: "20987654321",
        razonSocial: "OTRA S.A.C.",
        taxDocumentType: "03",
        category: "CREDENTIALS",
        sunatCode: "0102",
        sunatMessage: "Usuario o contraseña incorrectos",
        heldDocuments: 1,
      },
    ]);
    render(<IssuerAccessAlerts rows={[]} />);

    const alerts = screen.getAllByRole("alert");

    expect(alerts).toHaveLength(2);
    expect(alerts[1]).toHaveTextContent("SUNAT no está aceptando las boletas de OTRA S.A.C.");
    expect(alerts[1]).toHaveTextContent("El usuario o la clave SOL son incorrectos");
    expect(alerts[1]).toHaveTextContent("Hay 1 comprobante en espera. Conserva su número");
  });
});
