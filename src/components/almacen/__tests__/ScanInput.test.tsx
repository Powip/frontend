import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ScanInput from "../ScanInput";

// FEAT-24 H6-D (H6-D2) — campo del lector: Enter manda el código limpio, no
// abre el teclado del celular salvo que se pida, recupera el foco y abre la
// cámara a pedido (simulada).

jest.mock("../CameraScanner", () => ({
  __esModule: true,
  default: ({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) => (
    <div>
      <button type="button" onClick={() => onCode("7750000000016")}>
        leer con cámara
      </button>
      <button type="button" onClick={onClose}>
        cerrar
      </button>
    </div>
  ),
}));

describe("ScanInput (FEAT-24 H6-D)", () => {
  it("el lector escribe y manda Enter: llega el código sin espacios y el campo se limpia", async () => {
    const onCode = jest.fn();
    render(<ScanInput onCode={onCode} />);
    const input = screen.getByLabelText("Escanear código");
    expect(input).toHaveFocus();
    await userEvent.type(input, "  POL-M  {Enter}");
    expect(onCode).toHaveBeenCalledWith("POL-M");
    expect(input).toHaveValue("");
    await userEvent.type(input, "   {Enter}");
    expect(onCode).toHaveBeenCalledTimes(1);
  });

  it("no abre el teclado del celular hasta que se pide «Teclado»", async () => {
    render(<ScanInput onCode={jest.fn()} />);
    const input = screen.getByLabelText("Escanear código");
    expect(input).toHaveAttribute("inputmode", "none");
    await userEvent.click(screen.getByRole("button", { name: "Escribir el código con el teclado" }));
    expect(input).toHaveAttribute("inputmode", "text");
  });

  it("si pierde el foco y nadie más lo toma, lo recupera", async () => {
    jest.useFakeTimers();
    try {
      render(<ScanInput onCode={jest.fn()} />);
      const input = screen.getByLabelText("Escanear código");
      input.blur();
      expect(input).not.toHaveFocus();
      jest.advanceTimersByTime(100);
      expect(input).toHaveFocus();
    } finally {
      jest.useRealTimers();
    }
  });

  it("la cámara manda sus lecturas por el mismo camino", async () => {
    const onCode = jest.fn();
    render(<ScanInput onCode={onCode} />);
    await userEvent.click(screen.getByRole("button", { name: "Escanear con la cámara" }));
    await userEvent.click(screen.getByRole("button", { name: "leer con cámara" }));
    expect(onCode).toHaveBeenCalledWith("7750000000016");
    await userEvent.click(screen.getByRole("button", { name: "cerrar" }));
    expect(screen.queryByRole("button", { name: "leer con cámara" })).not.toBeInTheDocument();
  });
});
