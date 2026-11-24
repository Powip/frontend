import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import LegacyBundlesView, { activeBundles, bundleSeed } from "@/components/packs/LegacyBundlesView";
import type { PackFormBundle, PackFormSeed } from "@/components/packs/PackFormDialog";
import { getBundleCapabilities, listBundlePromos, setBundleActive } from "@/services/bundlePromos.service";
import type { BundlePack } from "@/interfaces/IPack";

let mockRole = "ADMINISTRADOR";
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => "/packs-promos" }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "t", user: { id: "u1", email: "ana@tienda.pe", role: mockRole }, company: { id: "c1" } } }),
}));
jest.mock("@/services/bundlePromos.service", () => ({ listBundlePromos: jest.fn(), getBundleCapabilities: jest.fn(), setBundleActive: jest.fn() }));
// La ventana del pack (y el convert al guardar) tiene su propio test: acá, con qué se abre.
jest.mock("@/components/packs/PackFormDialog", () => ({
  PackFormDialog: ({ seed, bundle }: { seed: PackFormSeed; bundle: PackFormBundle }) => (
    <div role="dialog" aria-label="Ventana del pack">
      convertir {bundle.id}: {seed.name} a S/ {seed.price} con {seed.components.map((component) => `${component.productName}${component.productId ? "" : " (sin producto)"}`).join(" + ")}
    </div>
  ),
}));

const COMBO: BundlePack = {
  id: "b-combo", type: "BUNDLE", name: "Combo verano", active: true, channels: ["WHATSAPP", "TIENDA_FISICA"], packPrice: 80, convertedToPackId: null,
  items: [
    { productId: "p-polo", productKey: "Polo", productName: "Polo", price: 59.9 },
    { productKey: "Gorra", productName: "Gorra", price: 39.9 },
  ],
};
const VIEJO: BundlePack = { ...COMBO, id: "b-viejo", name: "Dúo invierno", active: false, convertedToPackId: "p-duo" };
const PAUSADO: BundlePack = { ...COMBO, id: "b-pausado", name: "Trío", active: false, convertedToPackId: null };

function wrap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><LegacyBundlesView /></QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = "ADMINISTRADOR";
  jest.mocked(listBundlePromos).mockResolvedValue({ bundles: [VIEJO, COMBO, PAUSADO], deletedIds: [] });
  jest.mocked(getBundleCapabilities).mockResolvedValue({ canManage: true });
  jest.mocked(setBundleActive).mockResolvedValue({ ...COMBO, active: false });
});

describe("Bundles anteriores (FEAT-32 M5, spec §7.16)", () => {
  it("texto de la spec y tabla: bundle, productos, precio, canales y estado; sin crear bundles", async () => {
    wrap();
    expect(screen.getByText(/Los bundles se armaron por producto, sin elegir variante: el almacén no sabe qué SKU sacar\./)).toHaveTextContent(
      "Los bundles se armaron por producto, sin elegir variante: el almacén no sabe qué SKU sacar. Mientras existan, al venderlos se exige elegir la variante de cada producto. Conviértelos en pack para dejarlos amarrados a SKU; después se desactivan.",
    );
    const row = await screen.findByTestId("bundle-row-b-combo");
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Bundle", "Productos", "Precio", "Canales", "Estado", ""]);
    expect(within(row).getByText("Polo + Gorra")).toBeInTheDocument();
    expect(within(row).getByText("S/ 80.00")).toBeInTheDocument();
    expect(within(row).getByText("suelto S/ 99.80")).toBeInTheDocument();
    expect(within(row).getByText("WhatsApp")).toBeInTheDocument();
    expect(within(row).getByText("Tienda física")).toBeInTheDocument();
    expect(within(row).getByText("Activo")).toBeInTheDocument();
    // Activos primero.
    expect(screen.getAllByTestId(/^bundle-row-/).map((item) => item.dataset.testid)).toEqual(["bundle-row-b-combo", "bundle-row-b-viejo", "bundle-row-b-pausado"]);
    expect(screen.queryByRole("button", { name: /Nuevo|Crear/ })).not.toBeInTheDocument();
  });

  it("«Convertir en pack» abre la ventana del pack con los productos y el precio del bundle", async () => {
    const user = userEvent.setup();
    wrap();
    const row = await screen.findByTestId("bundle-row-b-combo");
    await user.click(await within(row).findByRole("button", { name: "Convertir en pack" }));
    expect(screen.getByRole("dialog", { name: "Ventana del pack" })).toHaveTextContent("convertir b-combo: Combo verano a S/ 80 con Polo + Gorra (sin producto)");
    expect(bundleSeed(COMBO)).toEqual({
      name: "Combo verano", price: 80, packType: "FIXED",
      components: [
        { productId: "p-polo", productName: "Polo", variantId: null, quantity: 1 },
        { productId: null, productName: "Gorra", variantId: null, quantity: 1 },
      ],
    });
  });

  it("«Desactivar» pide confirmación y manda active: false", async () => {
    const user = userEvent.setup();
    wrap();
    const row = await screen.findByTestId("bundle-row-b-combo");
    await user.click(await within(row).findByRole("button", { name: "Desactivar" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent("Deja de venderse. No se borra: los pedidos anteriores lo siguen mostrando.");
    expect(setBundleActive).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole("button", { name: "Sí, desactivar" }));
    await waitFor(() => expect(setBundleActive).toHaveBeenCalledWith("b-combo", false));
    expect(toast.success).toHaveBeenCalledWith("«Combo verano» desactivado: ya no se vende.");
  });

  it("un bundle convertido muestra su pack y no se puede activar; uno solo desactivado sí", async () => {
    wrap();
    const viejo = await screen.findByTestId("bundle-row-b-viejo");
    expect(within(viejo).getByText("Convertido en pack")).toBeInTheDocument();
    expect(within(viejo).getByRole("link", { name: "Ver el pack" })).toHaveAttribute("href", "/productos/p-duo");
    expect(within(viejo).queryByRole("button")).not.toBeInTheDocument();
    const pausado = screen.getByTestId("bundle-row-b-pausado");
    expect(await within(pausado).findByRole("button", { name: "Activar" })).toBeInTheDocument();
    expect(within(pausado).queryByRole("button", { name: "Convertir en pack" })).not.toBeInTheDocument();
  });

  it("sin permiso de administrar bundles no hay acciones", async () => {
    mockRole = "OPERACIONES";
    jest.mocked(getBundleCapabilities).mockResolvedValue({ canManage: false });
    wrap();
    const row = await screen.findByTestId("bundle-row-b-combo");
    expect(await screen.findByText("Convertir y desactivar bundles es del Administrador.")).toBeInTheDocument();
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
  });

  it("activeBundles deja solo los que se venden", () => {
    expect(activeBundles([VIEJO, COMBO, PAUSADO]).map((bundle) => bundle.id)).toEqual(["b-combo"]);
    expect(activeBundles(undefined)).toEqual([]);
  });
});
