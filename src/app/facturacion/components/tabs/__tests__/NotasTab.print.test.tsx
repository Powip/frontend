import { fireEvent, render, screen } from "@testing-library/react";
import { NotasTab } from "@/app/facturacion/components/tabs/NotasTab";
import { imprimirNotaCreditoPdf } from "@/app/facturacion/lib/imprimir-nota-credito-pdf";
import type { useFacturacionMock } from "@/hooks/useFacturacionMock";
import type { Nota } from "@/types/facturacion";

jest.mock("@/app/facturacion/lib/imprimir-nota-credito-pdf", () => ({
  imprimirNotaCreditoPdf: jest.fn(),
}));

const nota: Nota = {
  fecha: "19/11/2026",
  num: "FC01-00000001",
  original: "F002-00000012",
  cliente: "DRASANVI PERU S.A.C.",
  motivo: "Devolución total",
  monto: 2730,
  estado: "ACEPTADO",
  rucEmisor: "20111111111",
};

const issuer = { ruc: "20111111111", razonSocial: "Emisor Uno S.A.C." };

function renderTab(getIssuer = jest.fn().mockReturnValue(issuer)) {
  const mock = { notas: [nota] } as unknown as ReturnType<typeof useFacturacionMock>;
  render(<NotasTab mock={mock} hasAceptados onNuevaNota={jest.fn()} getIssuer={getIssuer} />);
  return getIssuer;
}

describe("NotasTab · imprimir", () => {
  it("muestra el código del motivo junto a la descripción", () => {
    renderTab();
    expect(screen.getByText("06 · Devolución total")).toBeInTheDocument();
  });

  it("imprime la nota con el emisor resuelto para esa nota", () => {
    const getIssuer = renderTab();
    fireEvent.click(screen.getByRole("button", { name: /imprimir pdf/i }));
    expect(getIssuer).toHaveBeenCalledWith(nota);
    expect(imprimirNotaCreditoPdf).toHaveBeenCalledWith(nota, issuer);
  });
});
