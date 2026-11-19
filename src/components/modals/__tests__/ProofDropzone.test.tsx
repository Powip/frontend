import { fireEvent, render, screen } from "@testing-library/react";
import ProofDropzone from "../ProofDropzone";

const accept = "image/png,image/jpeg";
const png = () => new File(["x"], "captura.png", { type: "image/png" });

function setup(extra: Partial<React.ComponentProps<typeof ProofDropzone>> = {}) {
  const onFile = jest.fn();
  const validate = jest.fn(() => true);
  render(<ProofDropzone onFile={onFile} validate={validate} accept={accept} {...extra} />);
  return { onFile, validate };
}

describe("ProofDropzone", () => {
  it("toma el archivo soltado sobre la zona", () => {
    const { onFile } = setup();
    const zone = screen.getByText(/Arrastra aquí la imagen/).closest("div")!.parentElement!;
    fireEvent.drop(zone, { dataTransfer: { files: [png()], items: [] } });
    expect(onFile).toHaveBeenCalledWith(expect.objectContaining({ name: "captura.png" }));
  });

  it("avisa si lo soltado no trae archivo (p. ej. WhatsApp Web)", () => {
    const { onFile } = setup();
    const zone = screen.getByText(/Arrastra aquí la imagen/).closest("div")!.parentElement!;
    fireEvent.drop(zone, { dataTransfer: { files: [], items: [] } });
    expect(onFile).not.toHaveBeenCalled();
  });

  it("toma la imagen pegada con Ctrl+V en cualquier parte (globalPaste)", () => {
    const { onFile } = setup({ globalPaste: true });
    const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
    event.clipboardData = { files: [png()], items: [] };
    document.dispatchEvent(event);
    expect(onFile).toHaveBeenCalledWith(expect.objectContaining({ name: "captura.png" }));
  });

  it("no pasa el archivo si la validación falla", () => {
    const { onFile } = setup({ validate: jest.fn(() => false) });
    const zone = screen.getByText(/Arrastra aquí la imagen/).closest("div")!.parentElement!;
    fireEvent.drop(zone, { dataTransfer: { files: [png()], items: [] } });
    expect(onFile).not.toHaveBeenCalled();
  });

  it("no acepta nada si está deshabilitada", () => {
    const { onFile } = setup({ disabled: true, globalPaste: true });
    const zone = screen.getByText(/Arrastra aquí la imagen/).closest("div")!.parentElement!;
    fireEvent.drop(zone, { dataTransfer: { files: [png()], items: [] } });
    expect(onFile).not.toHaveBeenCalled();
  });
});
