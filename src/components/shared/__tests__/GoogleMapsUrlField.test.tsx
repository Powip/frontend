import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { GoogleMapsUrlField } from "../GoogleMapsUrlField";
import { formatGoogleMapsClipboardLine, getGoogleMapsUrl } from "../MapsLink";

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const LONG_URL =
  "https://www.google.com/maps/place/Av.+Javier+Prado+Este+123/@-12.0912345,-77.0254321,17z/data=!3m1!4b1?entry=ttu&g_ep=EgoyMDI2";

let writeText: jest.Mock;

beforeEach(() => {
  jest.mocked(toast.success).mockClear();
  jest.mocked(toast.error).mockClear();
  writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

describe("GoogleMapsUrlField", () => {
  it("muestra la etiqueta y la URL completa como enlace seleccionable que abre en pestaña nueva", () => {
    render(<GoogleMapsUrlField url={LONG_URL} />);

    expect(screen.getByText(/Ubicación en Google Maps/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Abrir ubicación en Google Maps/ });
    expect(link).toHaveTextContent(LONG_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link.className).toMatch(/break-all/);
  });

  it("copia la URL completa y confirma", async () => {
    render(<GoogleMapsUrlField url={`  ${LONG_URL}  `} />);

    await userEvent.click(screen.getByRole("button", { name: "Copiar enlace de Google Maps" }));

    expect(writeText).toHaveBeenCalledWith(LONG_URL);
    expect(toast.success).toHaveBeenCalledWith("Enlace de Google Maps copiado");
  });

  it("avisa si el portapapeles falla", async () => {
    writeText.mockRejectedValueOnce(new Error("denied"));
    jest.spyOn(console, "error").mockImplementationOnce(() => {});
    render(<GoogleMapsUrlField url={LONG_URL} />);

    await userEvent.click(screen.getByRole("button", { name: "Copiar enlace de Google Maps" }));

    expect(toast.error).toHaveBeenCalledWith("No se pudo copiar el enlace");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it.each([null, undefined, "", "texto suelto", "javascript:alert(1)"])(
    "sin ubicación válida (%p) no muestra enlace ni botón",
    (url) => {
      render(<GoogleMapsUrlField url={url} />);

      expect(screen.getByText("-")).toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    },
  );

  it("abrir o copiar no dispara el clic del contenedor (fila)", async () => {
    const onRowClick = jest.fn();
    render(
      <table>
        <tbody>
          <tr onClick={onRowClick}>
            <td>
              <GoogleMapsUrlField url={LONG_URL} />
            </td>
          </tr>
        </tbody>
      </table>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Copiar enlace de Google Maps" }));
    screen.getByRole("link").addEventListener("click", (e) => e.preventDefault());
    await userEvent.click(screen.getByRole("link"));

    expect(onRowClick).not.toHaveBeenCalled();
  });
});

describe("helpers de Google Maps", () => {
  it("getGoogleMapsUrl conserva la URL completa (solo recorta espacios)", () => {
    expect(getGoogleMapsUrl(` ${LONG_URL} `)).toBe(LONG_URL);
    expect(getGoogleMapsUrl(null)).toBeNull();
    expect(getGoogleMapsUrl("ftp://x")).toBeNull();
  });

  it("formatGoogleMapsClipboardLine arma la línea o devuelve null", () => {
    expect(formatGoogleMapsClipboardLine(LONG_URL)).toBe(`Google Maps: ${LONG_URL}`);
    expect(formatGoogleMapsClipboardLine(undefined)).toBeNull();
  });
});
