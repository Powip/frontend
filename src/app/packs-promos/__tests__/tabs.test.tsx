import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import PacksPromosPage from "../page";
import { packsPromosTab } from "../_components/PacksPromosTabs";
import PacksRedirect from "@/app/productos/packs/page";
import { listPacks } from "@/services/packsService";
import type { BundlePack } from "@/interfaces/IPack";

let mockSearch = "";
const mockReplace = jest.fn();
let mockBundles: { data?: BundlePack[]; isSuccess: boolean } = { data: [], isSuccess: true };
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
  usePathname: () => "/packs-promos",
  useSearchParams: () => new URLSearchParams(mockSearch),
  redirect: jest.fn(),
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "t", user: { id: "u1", role: "ADMINISTRADOR" }, company: { id: "c1" } } }) }));
jest.mock("@/services/packsService", () => ({ listPacks: jest.fn() }));
jest.mock("@/components/promotions/PromotionsView", () => ({ __esModule: true, default: () => <div>vista de promociones</div> }));
jest.mock("@/components/packs/PacksView", () => ({ __esModule: true, default: () => <div>vista de packs</div> }));
jest.mock("@/components/packs/LegacyBundlesView", () => ({
  __esModule: true,
  default: () => <div>bundles anteriores</div>,
  useLegacyBundles: () => mockBundles,
  activeBundles: (bundles?: BundlePack[]) => (bundles ?? []).filter((bundle) => bundle.active),
}));

const BUNDLE: BundlePack = { id: "b1", type: "BUNDLE", name: "Combo", active: true, channels: [], items: [], packPrice: 10 };
const page = (pendingCount: number) => ({ data: [], meta: { page: 1, limit: 1, total: 0, totalPages: 0, pendingCount } });

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PacksPromosPage /></QueryClientProvider>);
}

beforeEach(() => {
  mockSearch = "";
  mockReplace.mockClear();
  mockBundles = { data: [BUNDLE, { ...BUNDLE, id: "b2", active: false }], isSuccess: true };
  jest.mocked(listPacks).mockResolvedValue(page(0));
});

describe("Comercial › Packs y promociones (FEAT-32 M4, spec §3.1 y §7.12)", () => {
  it("tiene las pestañas Promociones, Packs y Bundles anteriores (con los activos); sin ?tab abre Promociones", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Packs y promociones" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Promociones", "Packs", "Bundles anteriores1"]);
    expect(screen.getByRole("tab", { name: "Promociones" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("vista de promociones")).toBeInTheDocument();
    expect(screen.queryByText("vista de packs")).not.toBeInTheDocument();
  });

  it.each([
    ["packs", "Packs", "vista de packs"],
    ["bundles", /Bundles anteriores/, "bundles anteriores"],
    ["promociones", "Promociones", "vista de promociones"],
  ])("?tab=%s abre su pestaña", (tab, label, content) => {
    mockSearch = `tab=${tab}`;
    renderPage();
    expect(screen.getByRole("tab", { name: label })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(content)).toBeInTheDocument();
  });

  it("un ?tab desconocido abre Promociones", () => {
    expect(packsPromosTab("otra")).toBe("promociones");
    expect(packsPromosTab(null)).toBe("promociones");
    mockSearch = "tab=otra";
    renderPage();
    expect(screen.getByRole("tab", { name: "Promociones" })).toHaveAttribute("aria-selected", "true");
  });

  it("cambiar de pestaña escribe ?tab= y saca los enlaces de una sola vez (nueva, productos, editar)", async () => {
    mockSearch = "nueva=campana&productos=p1";
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("tab", { name: "Packs" }));
    expect(mockReplace).toHaveBeenCalledWith("/packs-promos?tab=packs", { scroll: false });
  });

  it("/productos/packs redirige a la pestaña Packs", () => {
    PacksRedirect();
    expect(redirect).toHaveBeenCalledWith("/packs-promos?tab=packs");
  });
});

describe("FEAT-32 M5 (spec §7.15, §7.16)", () => {
  it("la pestaña Packs dice cuántos packs de creadoras hay por aprobar", async () => {
    jest.mocked(listPacks).mockResolvedValue(page(2));
    renderPage();
    expect(await screen.findByText("2 por aprobar")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Packs 2 por aprobar" })).toBeInTheDocument();
    expect(listPacks).toHaveBeenCalledWith({ page: 1, limit: 1 }, expect.anything());
  });

  it("sin bundles activos no hay pestaña Bundles anteriores", () => {
    mockBundles = { data: [{ ...BUNDLE, active: false, convertedToPackId: "p1" }], isSuccess: true };
    renderPage();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Promociones", "Packs"]);
  });

  it("?tab=bundles sin bundles activos (se convirtió el último) abre Packs", async () => {
    mockBundles = { data: [], isSuccess: true };
    mockSearch = "tab=bundles";
    renderPage();
    expect(screen.getByRole("tab", { name: "Packs" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("vista de packs")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Bundles/ })).not.toBeInTheDocument();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/packs-promos?tab=packs", { scroll: false }));
  });

  it("mientras cargan los bundles, ?tab=bundles se mantiene", () => {
    mockBundles = { data: undefined, isSuccess: false };
    mockSearch = "tab=bundles";
    renderPage();
    expect(screen.getByRole("tab", { name: /Bundles anteriores/ })).toHaveAttribute("aria-selected", "true");
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
