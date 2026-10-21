import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ProveedoresPage from "../page";
import axios from "@/lib/axiosAuth";
import { toast } from "sonner";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { company: { id: "c" }, user: { id: "u" }, accessToken: "t" } }) }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: () => null }));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const get = jest.mocked(axios.get);
const post = jest.mocked(axios.post);

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ProveedoresPage /></QueryClientProvider>);
}

async function openNew() {
  fireEvent.click(await screen.findByRole("button", { name: /Nuevo Proveedor/ }));
  fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: "Textiles SAC" } });
}

describe("Proveedores — RUC (FEAT-24 H0)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    get.mockResolvedValue({ data: [{ id: "s1", name: "Textiles SAC", isActive: true, ruc: "20100047218", purchaseCount: 3 }] });
    post.mockResolvedValue({ data: {} });
  });

  it("la tabla muestra RUC y Compras", async () => {
    setup();
    const row = (await screen.findByText("Textiles SAC")).closest("tr")!;
    const headers = screen.getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers).toEqual(expect.arrayContaining(["RUC", "Compras"]));
    expect(within(row).getByText("20100047218")).toBeInTheDocument();
    expect(within(row).getByText("3")).toBeInTheDocument();
  });

  it("el RUC es opcional", async () => {
    setup();
    await openNew();
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1]).toMatchObject({ name: "Textiles SAC", ruc: null });
  });

  it("un RUC inválido no se envía", async () => {
    setup();
    await openNew();
    fireEvent.change(screen.getByLabelText("RUC (opcional)"), { target: { value: "20100047219" } });
    expect(screen.getByText("El RUC no es válido.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(post).not.toHaveBeenCalled();
  });

  it("un RUC válido se envía", async () => {
    setup();
    await openNew();
    fireEvent.change(screen.getByLabelText("RUC (opcional)"), { target: { value: "20100047218" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(post.mock.calls[0][1]).toMatchObject({ ruc: "20100047218" }));
  });

  it("un RUC repetido muestra el mensaje del backend", async () => {
    post.mockRejectedValue({ response: { status: 409, data: { message: "Ya existe un proveedor con ese RUC." } } });
    setup();
    await openNew();
    fireEvent.change(screen.getByLabelText("RUC (opcional)"), { target: { value: "20100047218" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Ya existe un proveedor con ese RUC."));
  });
});
