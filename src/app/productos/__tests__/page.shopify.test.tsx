/**
 * FEAT-24 SEC (sec6b): la tarjeta «Sincronizar Shopify» de /productos es solo de un administrador de la empresa
 * (ms-integrations responde 403 al resto al sincronizar).
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Productos from "../page";

let mockAuthRole = "ADMINISTRADOR";
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { user: { id: "user-1", role: mockAuthRole }, company: { id: "company-1" } } }),
}));
jest.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("") }));
jest.mock("@/components/products/BusinessProductCatalog", () => ({
  __esModule: true,
  default: ({ onCreate }: { onCreate: () => void }) => (
    <button type="button" onClick={onCreate}>
      Crear producto
    </button>
  ),
}));
jest.mock("../create-product/create-product", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/excel/ExcelImportWizard", () => ({ __esModule: true, default: () => null }));
jest.mock("../shopify-sync-wizard", () => ({ __esModule: true, default: () => <div>Asistente Shopify</div> }));
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: () => null }));

async function openModeSelector() {
  render(<Productos />);
  await userEvent.setup().click(await screen.findByRole("button", { name: "Crear producto" }));
  await screen.findByText("Carga Manual");
}

beforeEach(() => {
  mockAuthRole = "ADMINISTRADOR";
});

it("un administrador ve la tarjeta y entra al asistente de Shopify", async () => {
  await openModeSelector();

  await userEvent.setup().click(screen.getByText("Sincronizar Shopify"));

  expect(await screen.findByText("Asistente Shopify")).toBeInTheDocument();
});

it("quien no es administrador no ve la tarjeta de Shopify (sí las de carga manual y Excel)", async () => {
  mockAuthRole = "VENTAS";
  await openModeSelector();

  expect(screen.getByText("Importar Excel")).toBeInTheDocument();
  expect(screen.queryByText("Sincronizar Shopify")).not.toBeInTheDocument();
});
