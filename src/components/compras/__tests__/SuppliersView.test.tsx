/**
 * Tests: Compras › Proveedores (FEAT-24 H3-E; reemplaza la prueba del RUC de H0).
 *
 * 1. La tabla muestra RUC, condición, compras, comprado en 12 meses y por pagar.
 * 2. Sin la clave (rol sin costos) los montos se ven «••••» y no hay botones de escritura.
 * 3. RUC opcional; uno inválido no se envía; uno repetido muestra el mensaje del servidor.
 * 4. Editar permite desactivar.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  createPurchaseSupplier,
  listPurchaseSuppliers,
  updatePurchaseSupplier,
  type PurchaseSupplier,
} from "@/services/purchasesService";
import SuppliersView from "../SuppliersView";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => "/proveedores" }));
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: () => null }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/services/purchasesService", () => ({
  listPurchaseSuppliers: jest.fn(),
  createPurchaseSupplier: jest.fn(),
  updatePurchaseSupplier: jest.fn(),
}));

const supplier: PurchaseSupplier = {
  id: "s-1",
  companyId: "c-1",
  name: "Textiles",
  businessName: "Textiles del Sur SAC",
  tradeName: "Textiles",
  ruc: "20100047218",
  contactPerson: "Rosa",
  phone: "999111222",
  email: "rosa@textiles.pe",
  fiscalAddress: null,
  paymentTerms: "credito_30",
  active: true,
  purchaseCount: 3,
  purchasedLast12Months: 4500,
  payable: 1200,
  createdAt: "",
  updatedAt: "",
};

function loginAs(role: string) {
  jest.mocked(useAuth).mockReturnValue({
    auth: { accessToken: "t", user: { id: "u-1", role, permissions: [] }, company: { id: "c-1", stores: [] } },
  } as unknown as ReturnType<typeof useAuth>);
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SuppliersView />
    </QueryClientProvider>,
  );
}

async function openNew() {
  fireEvent.click(await screen.findByRole("button", { name: /Nuevo proveedor/ }));
  fireEvent.change(screen.getByLabelText("Razón social"), { target: { value: "Textiles SAC" } });
}

beforeEach(() => {
  jest.clearAllMocks();
  loginAs("ADMIN");
  jest.mocked(listPurchaseSuppliers).mockResolvedValue([supplier]);
  jest.mocked(createPurchaseSupplier).mockResolvedValue(supplier);
});

describe("Proveedores de compras", () => {
  it("la tabla muestra RUC, condición, compras, comprado y por pagar", async () => {
    setup();
    const row = (await screen.findByText("Textiles")).closest("tr")!;
    expect(within(row).getByText("Textiles del Sur SAC")).toBeInTheDocument();
    expect(within(row).getByText("20100047218")).toBeInTheDocument();
    expect(within(row).getByText("Crédito 30 días")).toBeInTheDocument();
    expect(within(row).getByText("3")).toBeInTheDocument();
    expect(within(row).getByTestId("purchased-s-1")).toHaveTextContent(/4,500\.00/);
    expect(within(row).getByTestId("payable-s-1")).toHaveTextContent(/1,200\.00/);
  });

  it("sin permiso de costos los montos se ven «••••» y no se edita", async () => {
    loginAs("VENTAS");
    const masked: Partial<PurchaseSupplier> = { ...supplier };
    delete masked.purchasedLast12Months;
    delete masked.payable;
    jest.mocked(listPurchaseSuppliers).mockResolvedValue([masked as PurchaseSupplier]);
    setup();
    const row = (await screen.findByText("Textiles")).closest("tr")!;
    expect(within(row).getByTestId("purchased-s-1")).toHaveTextContent("••••");
    expect(within(row).getByTestId("payable-s-1")).toHaveTextContent("••••");
    expect(screen.queryByRole("button", { name: /Nuevo proveedor/ })).not.toBeInTheDocument();
    expect(within(row).queryByTitle("Editar")).not.toBeInTheDocument();
  });

  it("el RUC es opcional", async () => {
    setup();
    await openNew();
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(createPurchaseSupplier).toHaveBeenCalled());
    expect(jest.mocked(createPurchaseSupplier).mock.calls[0][0]).toMatchObject({
      name: "Textiles SAC",
      businessName: "Textiles SAC",
      ruc: null,
      paymentTerms: "contado",
    });
  });

  it("un RUC inválido no se envía; uno válido sí", async () => {
    setup();
    await openNew();
    fireEvent.change(screen.getByLabelText("RUC (opcional)"), { target: { value: "20100047219" } });
    expect(screen.getByText("El RUC no es válido.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("RUC (opcional)"), { target: { value: "20100047218" } });
    fireEvent.change(screen.getByLabelText("Condición de pago"), { target: { value: "credito_15" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(jest.mocked(createPurchaseSupplier).mock.calls[0][0]).toMatchObject({ ruc: "20100047218", paymentTerms: "credito_15" }));
  });

  it("sin razón social ni nombre comercial avisa y no guarda", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: /Nuevo proveedor/ }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Escribe la razón social o el nombre comercial.");
    expect(createPurchaseSupplier).not.toHaveBeenCalled();
  });

  it("un RUC repetido muestra el mensaje del servidor", async () => {
    jest.mocked(createPurchaseSupplier).mockRejectedValue({ response: { status: 409, data: { message: "Ya existe un proveedor con ese RUC." } } });
    setup();
    await openNew();
    fireEvent.change(screen.getByLabelText("RUC (opcional)"), { target: { value: "20100047218" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ya existe un proveedor con ese RUC.");
  });

  it("editar permite desactivarlo", async () => {
    jest.mocked(updatePurchaseSupplier).mockResolvedValue({ ...supplier, active: false });
    setup();
    fireEvent.click(await screen.findByTitle("Editar"));
    expect(screen.getByLabelText("Nombre comercial")).toHaveValue("Textiles");
    fireEvent.click(screen.getByRole("switch", { name: "Activo" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(updatePurchaseSupplier).toHaveBeenCalledWith("s-1", expect.objectContaining({ active: false, ruc: "20100047218" })));
  });
});
