import { render, screen, within } from "@testing-library/react";
import CommentsTimelineModal from "../CommentsTimelineModal";
import axios from "@/lib/axiosAuth";

// FEAT-33 A7: el historial de Ventas y Finanzas dice quién hizo cada cosa y no muestra códigos internos.
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { user: { id: "u-1", email: "ana@negocio.pe" } } }),
}));
jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open?: boolean; children?: React.ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
}));

const entry = (id: number, extra: Record<string, unknown>) => ({
  id,
  orderId: "order-1",
  operacion: "UPDATE",
  timestamp: `2026-11-24T10:0${id}:00Z`,
  userId: null,
  userName: null,
  isSystemGenerated: false,
  comentarios: null,
  ...extra,
});

test("buyer entries read «Cliente», system ones «Sistema», reviewers by name, without raw codes", async () => {
  (axios.get as jest.Mock).mockResolvedValue({
    data: [
      entry(1, { comentarios: "Separó 2 prendas desde POWIP Link", userName: "Cliente", isSystemGenerated: true, data: { actor: "CUSTOMER" } }),
      entry(2, { comentarios: "Orden creada desde POWIP Link", userName: "Sistema", isSystemGenerated: true, operacion: "CREATE_ORDER_WITH_ITEMS", data: { actor: "SYSTEM" } }),
      entry(3, { comentarios: "LIVE_ORDER_CANCELLED", userId: "u-1", data: { action: "LIVE_ORDER_CANCELLED" } }),
      entry(4, { comentarios: "Pago validado", userId: "u-1", userName: "ana@negocio.pe", data: { actor: "USER" } }),
    ],
  });
  render(<CommentsTimelineModal open onClose={jest.fn()} orderId="order-1" orderNumber="ORD-1" />);

  const separo = (await screen.findByText("Separó 2 prendas desde POWIP Link")).closest(
    '[data-testid="historial-entrada"]',
  ) as HTMLElement;
  expect(within(separo).getByTestId("historial-actor")).toHaveTextContent("Cliente");
  expect(within(separo).queryByText("Sistema")).not.toBeInTheDocument();

  const creada = screen.getByText("Orden creada desde POWIP Link").closest('[data-testid="historial-entrada"]') as HTMLElement;
  expect(within(creada).getByTestId("historial-actor")).toHaveTextContent("Sistema");
  expect(within(creada).getAllByText("Sistema")).toHaveLength(1);

  const validado = screen.getByText("Pago validado").closest('[data-testid="historial-entrada"]') as HTMLElement;
  expect(within(validado).getByText("ana@negocio.pe")).toBeInTheDocument();

  expect(screen.queryByText("LIVE_ORDER_CANCELLED")).not.toBeInTheDocument();
});
