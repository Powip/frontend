import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { redirect } from "next/navigation";
import PacksPromosPage from "../page";
import { packsPromosTab } from "../_components/PacksPromosTabs";
import PacksRedirect from "@/app/productos/packs/page";

let mockSearch = "";
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
  usePathname: () => "/packs-promos",
  useSearchParams: () => new URLSearchParams(mockSearch),
  redirect: jest.fn(),
}));
jest.mock("@/components/promotions/PromotionsView", () => ({ __esModule: true, default: () => <div>vista de promociones</div> }));
jest.mock("@/components/packs/PacksView", () => ({ __esModule: true, default: () => <div>vista de packs</div> }));
jest.mock("@/contexts/PacksContext", () => ({ PacksProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("../_components/LegacyPacksPromos", () => ({
  PacksPromosContent: ({ bundlesOnly }: { bundlesOnly?: boolean }) => <div>bundles anteriores{bundlesOnly ? " (solo bundles)" : ""}</div>,
}));

beforeEach(() => {
  mockSearch = "";
  mockReplace.mockClear();
});

describe("Comercial › Packs y promociones (FEAT-32 M4, spec §3.1 y §7.12)", () => {
  it("tiene las pestañas Promociones, Packs y Bundles anteriores; sin ?tab abre Promociones", () => {
    render(<PacksPromosPage />);
    expect(screen.getByRole("heading", { name: "Packs y promociones" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Promociones", "Packs", "Bundles anteriores"]);
    expect(screen.getByRole("tab", { name: "Promociones" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("vista de promociones")).toBeInTheDocument();
    expect(screen.queryByText("vista de packs")).not.toBeInTheDocument();
  });

  it.each([
    ["packs", "Packs", "vista de packs"],
    ["bundles", "Bundles anteriores", "bundles anteriores (solo bundles)"],
    ["promociones", "Promociones", "vista de promociones"],
  ])("?tab=%s abre la pestaña %s", (tab, label, content) => {
    mockSearch = `tab=${tab}`;
    render(<PacksPromosPage />);
    expect(screen.getByRole("tab", { name: label })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(content)).toBeInTheDocument();
  });

  it("un ?tab desconocido abre Promociones", () => {
    expect(packsPromosTab("otra")).toBe("promociones");
    expect(packsPromosTab(null)).toBe("promociones");
    mockSearch = "tab=otra";
    render(<PacksPromosPage />);
    expect(screen.getByRole("tab", { name: "Promociones" })).toHaveAttribute("aria-selected", "true");
  });

  it("cambiar de pestaña escribe ?tab= y saca los enlaces de una sola vez (nueva, productos, editar)", async () => {
    mockSearch = "nueva=campana&productos=p1";
    const user = userEvent.setup();
    render(<PacksPromosPage />);
    await user.click(screen.getByRole("tab", { name: "Packs" }));
    expect(mockReplace).toHaveBeenCalledWith("/packs-promos?tab=packs", { scroll: false });
  });

  it("/productos/packs redirige a la pestaña Packs", () => {
    PacksRedirect();
    expect(redirect).toHaveBeenCalledWith("/packs-promos?tab=packs");
  });
});
