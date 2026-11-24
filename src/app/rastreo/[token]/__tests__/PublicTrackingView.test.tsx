import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { toPublicOrderTracking } from "@/features/whatsapp/api/public-tracking.api";
import { PublicTrackingView } from "../PublicTrackingView";

jest.mock("@/lib/api", () => ({ API: { integrations: "http://int" } }));
jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});
const get = jest.mocked(axios.get);

const dto = {
  store: { name: "LIVII", logoUrl: null },
  order: { number: "P-1001", createdAt: "2026-11-20T15:00:00.000Z", customerFirstName: "Ana", items: [{ name: "Polo", quantity: 2 }] },
  status: { label: "En camino", description: "Tu pedido va hacia ti.", tone: "progress" as const, incidentReason: null },
  timeline: [{ label: "Guía creada", at: "2026-11-21T15:00:00.000Z", done: true }],
  shipping: null,
  evidence: [],
  invoice: null,
  updatedAt: "2026-11-21T15:00:00.000Z",
};

beforeEach(() => get.mockReset());

describe("página pública de seguimiento (C-30)", () => {
  it("convierte las fechas ISO", () => {
    const view = toPublicOrderTracking(dto);
    expect(view.order.createdAt).toBeInstanceOf(Date);
    expect(view.timeline?.[0].at).toBeInstanceOf(Date);
    expect(view.updatedAt?.toISOString()).toBe("2026-11-21T15:00:00.000Z");
  });

  it("pide el token sin sesión y muestra el pedido", async () => {
    get.mockResolvedValueOnce({ data: dto });
    render(<PublicTrackingView token={"t".repeat(32)} />);
    expect(await screen.findByText(/P-1001/)).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(`http://int/p/${"t".repeat(32)}`, { withCredentials: false });
  });

  it("token inválido muestra «no encontrado» y un fallo permite reintentar", async () => {
    get.mockRejectedValueOnce({ isAxiosError: true, response: { status: 404 } });
    const { unmount } = render(<PublicTrackingView token="malo" />);
    expect(await screen.findByText(/No encontramos/i)).toBeInTheDocument();
    unmount();
    get.mockRejectedValueOnce(new Error("red"));
    get.mockResolvedValueOnce({ data: dto });
    render(<PublicTrackingView token={"t".repeat(32)} />);
    await userEvent.click(await screen.findByRole("button", { name: /Reintentar|Intentar/i }));
    expect(await screen.findByText(/P-1001/)).toBeInTheDocument();
  });
});
