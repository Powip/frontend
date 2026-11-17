import { render, screen } from "@testing-library/react";
import WarehouseHome from "../_components/WarehouseHome";
import ReceiveMenu from "../_components/ReceiveMenu";
import { hasRouteAccess } from "@/config/permissions.config";

// FEAT-24 H6-D (H6-D3) — inicio y «Recibir» del modo almacén: los 4 accesos,
// Contar y Recibir traslados deshabilitados («Próximamente»), y cada uno según
// los permisos. FEAT-24 H3: Recibir órdenes de compra ya está habilitado.

const mockAuth = { user: { id: "u-1", role: "ALMACEN", permissions: ["UPDATE_DELIVERY_STATUS"] }, company: { id: "c-1" } };
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: mockAuth, hasPermission: (permission: string) => mockAuth.user.permissions.includes(permission) }),
}));
jest.mock("@/components/almacen/WarehouseQueueContext", () => ({
  useWarehouseQueue: () => ({ outbox: [{ id: "a" }], review: [], persistent: true, otherSessions: 0 }),
}));

describe("Inicio del modo almacén (FEAT-24 H6-D)", () => {
  it("el rol Almacén entra a Consultar, Recibir y Picking; Contar está deshabilitado", () => {
    render(<WarehouseHome />);
    expect(screen.getByTestId("tile-Consultar")).toHaveAttribute("href", "/almacen/consultar");
    expect(screen.getByTestId("tile-Recibir")).toHaveAttribute("href", "/almacen/recibir");
    expect(screen.getByTestId("tile-Picking")).toHaveAttribute("href", "/almacen/picking");
    const contar = screen.getByTestId("tile-Contar");
    expect(contar).toHaveAttribute("aria-disabled", "true");
    expect(contar).toHaveTextContent("Próximamente");
    expect(screen.getByText("1 por enviar")).toBeInTheDocument();
  });

  it("sin permiso de Operaciones ni rol que recibe, Picking y Recibir quedan deshabilitados con el motivo", () => {
    const saved = { ...mockAuth.user };
    mockAuth.user.role = "VENTAS";
    mockAuth.user.permissions = ["VIEW_SALES"];
    try {
      render(<WarehouseHome />);
      expect(screen.getByTestId("tile-Picking")).toHaveTextContent("Necesitas permiso de Operaciones");
      expect(screen.getByTestId("tile-Recibir")).toHaveTextContent("Tu rol no recibe mercadería");
      expect(screen.getByTestId("tile-Consultar")).toHaveAttribute("href", "/almacen/consultar");
    } finally {
      Object.assign(mockAuth.user, saved);
    }
  });

  it("Recibir: devoluciones y órdenes de compra habilitados; traslados, próximamente", () => {
    render(<ReceiveMenu />);
    expect(screen.getByRole("link", { name: /Devoluciones/ })).toHaveAttribute("href", "/almacen/recibir/devoluciones");
    expect(screen.getByRole("link", { name: /Órdenes de compra/ })).toHaveAttribute("href", "/almacen/recibir/compras");
    expect(screen.queryByRole("link", { name: /Traslados/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Próximamente")).toHaveLength(1);
  });

  it("/almacen se abre con cualquier sesión", () => {
    expect(hasRouteAccess("/almacen", { role: "VENTAS", permissions: [] })).toBe(true);
    expect(hasRouteAccess("/almacen/picking", { role: "ALMACEN", permissions: [] })).toBe(true);
  });
});
