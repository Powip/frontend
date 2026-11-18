import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { LabelFormat } from "@/lib/labels/types";
import {
  createLabelFormat,
  listLabelFormats,
  setDefaultLabelFormat,
  updateLabelFormat,
} from "@/services/labelsService";
import LabelFormatsView from "../LabelFormatsView";

jest.mock("next/navigation", () => ({ usePathname: () => "/productos/etiquetas", useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/services/labelsService", () => ({
  ...jest.requireActual("@/services/labelsService"),
  listLabelFormats: jest.fn(),
  createLabelFormat: jest.fn(),
  updateLabelFormat: jest.fn(),
  setDefaultLabelFormat: jest.fn(),
}));
jest.mock("../PrintLabelsDialog", () => ({
  PrintLabelsDialog: ({ source }: { source: { kind: string } }) => <div>diálogo de impresión: {source.kind}</div>,
}));

const formats: LabelFormat[] = [
  { id: "f1", name: "Básica", widthMm: 50, heightMm: 25, output: "termica", fields: ["name", "variant", "sku", "barcode"], priceSource: "price_vta", isDefault: true },
  { id: "f2", name: "Con precio", widthMm: 40, heightMm: 30, output: "termica", fields: ["name", "variant", "price", "barcode"], priceSource: "price_vta", isDefault: false },
  { id: "f3", name: "Góndola", widthMm: 60, heightMm: 40, output: "a4", fields: ["name", "price", "qr"], priceSource: "price_vta", isDefault: false },
];

function loginAs(role: string) {
  (useAuth as jest.Mock).mockReturnValue({
    auth: { accessToken: "t", company: { id: "c-1", name: "LIVII" }, user: { id: "u-1", email: "user@example.test", role, permissions: [] } },
  });
}

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LabelFormatsView />
    </QueryClientProvider>,
  );
}

const cards = () => screen.getAllByTestId("label-format-card");
const card = (name: string) => cards().find((c) => within(c).queryByRole("heading", { name }))!;

beforeEach(() => {
  jest.clearAllMocks();
  (listLabelFormats as jest.Mock).mockResolvedValue(formats);
});

describe("Catálogo › Etiquetas (FEAT-24 H7)", () => {
  it("lists the saved formats with size, printer, fields, preview and the default one", async () => {
    loginAs("ADMINISTRADOR");
    renderView();
    expect(await screen.findByRole("heading", { name: "Básica" })).toBeInTheDocument();
    expect(cards()).toHaveLength(3);
    expect(within(card("Básica")).getByText("50×25 mm")).toBeInTheDocument();
    expect(within(card("Básica")).getByText("Predeterminado")).toBeInTheDocument();
    expect(within(card("Góndola")).getByText(/Hoja A4 · Nombre del producto · Precio · QR/)).toBeInTheDocument();
    expect(within(card("Góndola")).getByRole("img", { name: "Vista previa de la etiqueta de 60×40 mm" })).toBeInTheDocument();
    expect(within(card("Básica")).queryByRole("button", { name: /Usar .* para todos/ })).not.toBeInTheDocument();
  });

  it("only the administrator creates, edits and chooses the default", async () => {
    loginAs("VENTAS");
    renderView();
    await screen.findByRole("heading", { name: "Básica" });
    expect(screen.queryByRole("button", { name: /Nuevo formato/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /para todos/ })).not.toBeInTheDocument();
    // Ver e imprimir sí puede.
    expect(screen.getByRole("button", { name: /Imprimir etiquetas/ })).toBeEnabled();
  });

  it("marks another format as default", async () => {
    loginAs("ADMINISTRADOR");
    (setDefaultLabelFormat as jest.Mock).mockResolvedValue({ ...formats[1], isDefault: true });
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Usar «Con precio» para todos" }));
    await waitFor(() => expect(setDefaultLabelFormat).toHaveBeenCalledWith("f2", expect.anything()));
    expect(toast.success).toHaveBeenCalledWith("«Con precio» queda como formato predeterminado");
    await waitFor(() => expect(listLabelFormats).toHaveBeenCalledTimes(2));
  });

  it("creates a format with live preview and requires a barcode or a QR", async () => {
    loginAs("ADMINISTRADOR");
    (createLabelFormat as jest.Mock).mockResolvedValue({ ...formats[2], id: "f4", name: "Vitrina" });
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: /Nuevo formato/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Nombre del formato"), { target: { value: "Vitrina" } });
    fireEvent.change(within(dialog).getByLabelText("Tamaño"), { target: { value: "60x40" } });
    fireEvent.change(within(dialog).getByLabelText("Impresora"), { target: { value: "a4" } });
    expect(within(dialog).getByRole("img", { name: "Vista previa de la etiqueta de 60×40 mm" })).toBeInTheDocument();
    expect(within(dialog).getByText(/S\/ 59\.90/)).toBeInTheDocument(); // el precio está activo por defecto

    fireEvent.click(within(dialog).getByRole("button", { name: "Código de barras", pressed: true }));
    expect(within(dialog).queryByTestId("label-preview-barcode")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar formato" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "La etiqueta necesita código de barras o QR para poder escanearse.",
    );
    expect(createLabelFormat).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "QR", pressed: false }));
    expect(within(dialog).getByTestId("label-preview-qr")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Usar este formato para todos/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar formato" }));
    await waitFor(() =>
      expect(createLabelFormat).toHaveBeenCalledWith({
        name: "Vitrina",
        widthMm: 60,
        heightMm: 40,
        output: "a4",
        fields: ["name", "variant", "price", "qr"],
        isDefault: true,
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Formato «Vitrina» guardado");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("edits a format and shows the server message when the name is taken", async () => {
    loginAs("ADMINISTRADOR");
    (updateLabelFormat as jest.Mock).mockRejectedValue(
      new AxiosError("Conflict", "409", undefined, undefined, {
        status: 409,
        statusText: "Conflict",
        data: { message: "Ya existe un formato con ese nombre." },
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Editar «Con precio»" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Nombre del formato")).toHaveValue("Con precio");
    expect(within(dialog).getByLabelText("Tamaño")).toHaveValue("40x30");
    fireEvent.change(within(dialog).getByLabelText("Nombre del formato"), { target: { value: "Básica" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar formato" }));
    await waitFor(() =>
      expect(updateLabelFormat).toHaveBeenCalledWith("f2", expect.objectContaining({ name: "Básica", widthMm: 40, heightMm: 30 })),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Ya existe un formato con ese nombre.");
  });

  it("opens the print dialog for the catalog", async () => {
    loginAs("ADMINISTRADOR");
    renderView();
    await screen.findByRole("heading", { name: "Básica" });
    fireEvent.click(screen.getByRole("button", { name: /Imprimir etiquetas/ }));
    expect(screen.getByText("diálogo de impresión: catalog")).toBeInTheDocument();
  });

  it("shows the load error with a retry", async () => {
    loginAs("ADMINISTRADOR");
    (listLabelFormats as jest.Mock).mockRejectedValueOnce(new Error("boom"));
    renderView();
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar los formatos.");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { name: "Básica" })).toBeInTheDocument();
  });
});
