import { render, screen } from "@testing-library/react";

/**
 * Botón $ de un pedido POWIP Live (FEAT-33 B1/D4): abre el validador Yape del pedido, el mismo
 * registro que Finanzas › Pagos por validar. Valida el Administrador o quien tiene el permiso de
 * Finanzas, igual que ms-ventas.
 */
let mockUser: { id: string; role?: string; permissions: string[] } = {
  id: "user-1",
  permissions: [],
};
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      company: { id: "company-1" },
      user: mockUser,
      accessToken: "synthetic",
    },
    hasPermission: (permission: string) =>
      mockUser.permissions.includes(permission),
  }),
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));
jest.mock("next/navigation", () => ({
  usePathname: () => "/ventas",
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("@/features/live/LiveYapeReviews", () => ({
  __esModule: true,
  default: ({
    orderId,
    canReview,
  }: {
    orderId: string;
    canReview: boolean;
  }) => (
    <p>
      Validador Yape {orderId} · {canReview ? "puede validar" : "solo mira"}
    </p>
  ),
}));

import axiosAuth from "@/lib/axiosAuth";
import PaymentVerificationModal from "../PaymentVerificationModal";

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
beforeEach(() => {
  (axiosAuth.get as jest.Mock).mockResolvedValue({
    data: {
      storeId: "store-1",
      externalSource: "POWIP_LIVE",
      grandTotal: "199.00",
      payments: [],
    },
  });
});

test.each([
  [{ id: "u", role: "ADMINISTRADOR", permissions: [] }, "puede validar"],
  [
    { id: "u", role: "FINANZAS", permissions: ["VIEW_FINANCES"] },
    "puede validar",
  ],
  [{ id: "u", role: "VENDEDOR", permissions: ["VIEW_SALES"] }, "solo mira"],
])(
  "a Live order opens its Yape validator (%p → %s)",
  async (user, expected) => {
    mockUser = user;
    render(
      <PaymentVerificationModal
        open
        onClose={jest.fn()}
        orderId="order-1"
        orderNumber="ORD-1"
      />,
    );
    expect(
      await screen.findByText(`Validador Yape order-1 · ${expected}`),
    ).toBeInTheDocument();
  },
);
