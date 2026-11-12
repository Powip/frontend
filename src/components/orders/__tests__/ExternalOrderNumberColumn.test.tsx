import { render, screen } from "@testing-library/react";
import {
  ExternalOrderNumberCell,
  ExternalOrderNumberHead,
  ExternalOrderNumberValue,
} from "../ExternalOrderNumberColumn";

function inTable(head: React.ReactNode, cell: React.ReactNode) {
  return render(
    <table>
      <thead>
        <tr>{head}</tr>
      </thead>
      <tbody>
        <tr>{cell}</tr>
      </tbody>
    </table>,
  );
}

describe("ExternalOrderNumberColumn (FEAT-31)", () => {
  it("el encabezado dice «N° Externo»", () => {
    inTable(<ExternalOrderNumberHead />, <td />);
    expect(screen.getByRole("columnheader", { name: "N° Externo" })).toBeInTheDocument();
  });

  it("la celda muestra el número con su valor completo en el title", () => {
    inTable(<th />, <ExternalOrderNumberCell value="AGPE923190" />);
    const value = screen.getByText("AGPE923190");
    expect(value).toBeInTheDocument();
    expect(value).toHaveAttribute("title", "AGPE923190");
  });

  it.each([[undefined], [null], [""], ["   "]])(
    "sin número muestra un guion: %p",
    (value) => {
      inTable(<th />, <ExternalOrderNumberCell value={value} />);
      expect(screen.getByRole("cell")).toHaveTextContent("—");
    },
  );

  it("acepta clases extra para columnas sticky", () => {
    inTable(
      <ExternalOrderNumberHead className="sticky-x" />,
      <ExternalOrderNumberCell value="A1" className="sticky-y" />,
    );
    expect(screen.getByRole("columnheader")).toHaveClass("sticky-x");
    expect(screen.getByRole("cell")).toHaveClass("sticky-y");
  });
});

describe("ExternalOrderNumberValue (FEAT-31, para tablas con <td> planos)", () => {
  it("muestra el número con su valor completo en el title", () => {
    render(<ExternalOrderNumberValue value="AGPE923190" />);
    expect(screen.getByText("AGPE923190")).toHaveAttribute("title", "AGPE923190");
  });

  it.each([[undefined], [null], [""], ["   "]])("sin número muestra un guion: %p", (value) => {
    render(<ExternalOrderNumberValue value={value} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
