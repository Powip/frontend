import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios, { type AxiosResponse } from "axios";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { type OrderEvidence, OrderEvidenceSection } from "../OrderEvidenceSection";

jest.mock("axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const response = <T,>(data: T) => ({ data }) as AxiosResponse<T>;

const evidence: OrderEvidence = {
  id: "evidence-1",
  orderId: "order-1",
  type: "DISPATCH",
  url: "https://storage.example.test/signed/photo.png",
  originalName: "paquete.png",
  mimeType: "image/png",
  sizeBytes: 1024,
  uploadedBy: "user-1",
  uploadedByEmail: "operaciones@tienda.pe",
  createdAt: "2026-09-25T10:00:00.000Z",
};

describe("OrderEvidenceSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("muestra un estado consistente cuando el pedido no tiene evidencia", async () => {
    mockedAxios.get.mockResolvedValue(response([]));

    render(<OrderEvidenceSection orderId="order-1" accessToken="token" />);

    expect(await screen.findByText("Sin fotografías")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Evidencia de despacho" })).toBeInTheDocument();
    // Estado vacío compacto: sin descripción ni caja interna de mensaje.
    expect(screen.queryByText(/Fotografías del paquete preparado/)).not.toBeInTheDocument();
    expect(screen.queryByText(/aún no tiene fotografías/)).not.toBeInTheDocument();
    expect(screen.queryByText("Tomar o subir fotos")).not.toBeInTheDocument();
  });

  it("con permiso de carga, el estado vacío muestra el botón en el mismo encabezado", async () => {
    mockedAxios.get.mockResolvedValue(response([]));

    render(<OrderEvidenceSection orderId="order-1" accessToken="token" canUpload />);

    expect(await screen.findByText("Sin fotografías")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tomar o subir fotos/ })).toBeEnabled();
  });

  it("con fotos no muestra 'Sin fotografías' y conserva galería y botón de carga", async () => {
    mockedAxios.get.mockResolvedValue(
      response([evidence, { ...evidence, id: "ev-2", originalName: "caja.png" }]),
    );

    render(<OrderEvidenceSection orderId="order-1" accessToken="token" canUpload />);

    expect(await screen.findByRole("button", { name: "Ver evidencia paquete.png" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver evidencia caja.png" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tomar o subir fotos/ })).toBeInTheDocument();
    expect(screen.queryByText("Sin fotografías")).not.toBeInTheDocument();
  });

  it("muestra la galería y permite visualizar una foto sin salir del detalle", async () => {
    mockedAxios.get.mockResolvedValue(response([evidence]));
    const user = userEvent.setup();

    render(<OrderEvidenceSection orderId="order-1" accessToken="token" />);
    await user.click(await screen.findByRole("button", { name: "Ver evidencia paquete.png" }));

    expect(
      screen.getByRole("heading", { level: 2, name: "Evidencia de despacho" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/operaciones@tienda\.pe/)).toBeInTheDocument();
  });

  it("descarta la vista previa al cambiar de pedido", async () => {
    mockedAxios.get.mockResolvedValueOnce(response([evidence])).mockResolvedValueOnce(response([]));
    const user = userEvent.setup();
    const { rerender } = render(<OrderEvidenceSection orderId="order-1" accessToken="token" />);

    await user.click(await screen.findByRole("button", { name: "Ver evidencia paquete.png" }));
    expect(
      screen.getByRole("heading", { level: 2, name: "Evidencia de despacho" }),
    ).toBeInTheDocument();

    rerender(<OrderEvidenceSection orderId="order-2" accessToken="token" />);

    expect(await screen.findByText("Sin fotografías")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 2, name: "Evidencia de despacho" }),
    ).not.toBeInTheDocument();
  });

  it("rechaza en cliente un archivo con MIME no permitido", async () => {
    mockedAxios.get.mockResolvedValue(response([]));
    render(<OrderEvidenceSection orderId="order-1" canUpload accessToken="token" />);
    const input = await screen.findByLabelText("Tomar o subir fotos de evidencia");

    fireEvent.change(input, {
      target: {
        files: [new File(["contenido"], "evidencia.txt", { type: "text/plain" })],
      },
    });

    expect(toast.error).toHaveBeenCalledWith("Usa imágenes JPEG, PNG o WebP");
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("deshabilita la carga si la sesión no tiene access token", async () => {
    render(<OrderEvidenceSection orderId="order-1" canUpload />);

    expect(await screen.findByRole("button", { name: "Tomar o subir fotos" })).toBeDisabled();
    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("sube una imagen válida como multipart y refresca la galería", async () => {
    mockedAxios.get.mockResolvedValueOnce(response([])).mockResolvedValueOnce(response([evidence]));
    mockedAxios.post.mockResolvedValue(response([evidence]));
    const user = userEvent.setup();
    render(<OrderEvidenceSection orderId="order-1" canUpload accessToken="token" />);
    const input = await screen.findByLabelText("Tomar o subir fotos de evidencia");

    await user.upload(input, new File(["png"], "paquete.png", { type: "image/png" }));

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledTimes(1));
    const body = mockedAxios.post.mock.calls[0][1] as FormData;
    expect(body.get("type")).toBe("DISPATCH");
    expect(body.getAll("files")).toHaveLength(1);
    expect(await screen.findByText("paquete.png")).toBeInTheDocument();
  });
});
