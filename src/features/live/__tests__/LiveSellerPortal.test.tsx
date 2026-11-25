import { act, fireEvent, render, screen, within } from "@testing-library/react";
import LiveSellerPortal from "../LiveSellerPortal";
import {
  gainPerUnit,
  portalLinkInfo,
  portalLogin,
  portalMe,
  portalProducts,
  portalSales,
  portalSetOnAir,
  portalSetPassword,
  readPortalSession,
  savePortalSession,
} from "../liveSellerPortalService";
import type { LiveSellerPortalMe } from "../types";

/**
 * FEAT-33 L5b (C3/C4, D8): portal de la creadora con su propio ingreso. El token del enlace llega en el
 * fragmento (#t=), se borra de la barra apenas se lee; la sesión vencida vuelve al ingreso.
 */
jest.mock("../liveSellerPortalService", () => ({
  ...jest.requireActual("../liveSellerPortalService"),
  portalLogin: jest.fn(),
  portalLinkInfo: jest.fn(),
  portalSetPassword: jest.fn(),
  portalLogout: jest.fn(),
  portalMe: jest.fn(),
  portalProducts: jest.fn(),
  portalSales: jest.fn(),
  portalSetOnAir: jest.fn(),
}));

const TOKEN = "A".repeat(43);
const stats = { sales: 356, units: 2, orders: 2, earned: 17.8, pendingConfirmation: 17.8, paid: 0, toPay: 17.8 };
const me: LiveSellerPortalMe = {
  seller: {
    name: "Rei Hinojosa",
    social: "@rei",
    code: "rei-1a2b",
    agreement: { type: "PERCENT", percent: 10 },
    onAir: false,
    onAirUntil: null,
  },
  store: { name: "Kunca", slug: "kunca" },
  stats,
  today: { units: 2, orders: 2 },
  lastPayoutAt: null,
};
const session = { token: "S".repeat(43), expiresAt: "2099-01-01T00:00:00Z", seller: { name: "Rei Hinojosa" } };
const axios401 = Object.assign(new Error("401"), {
  isAxiosError: true,
  response: { status: 401, data: { message: "Tu sesión terminó. Vuelve a entrar." } },
});
beforeEach(() => {
  jest.resetAllMocks();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/vendedor/kunca");
  (portalMe as jest.Mock).mockResolvedValue(me);
});

test("signs in with email and password, keeps the session and shows her link and today", async () => {
  (portalLogin as jest.Mock).mockResolvedValue(session);
  render(<LiveSellerPortal slug="kunca" />);
  fireEvent.change(await screen.findByLabelText("Correo"), { target: { value: "rei@example.invalid" } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "secreta123" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  expect(await screen.findByRole("heading", { name: "Hola, Rei" })).toBeInTheDocument();
  expect(portalLogin).toHaveBeenCalledWith("kunca", "rei@example.invalid", "secreta123");
  expect(portalMe).toHaveBeenCalledWith("kunca", session.token);
  expect(readPortalSession("kunca")).toBe(session.token);
  expect(screen.getByText(/http:\/\/localhost\/live\/kunca\?a=rei-1a2b/)).toBeInTheDocument();
  expect(screen.getByText("Vendiste hoy").nextSibling).toHaveTextContent("2");
});

test("a wrong password shows the server message and clears the field", async () => {
  (portalLogin as jest.Mock).mockRejectedValue(
    Object.assign(new Error("401"), { isAxiosError: true, response: { status: 401, data: { message: "Correo o contraseña incorrectos." } } }),
  );
  render(<LiveSellerPortal slug="kunca" />);
  fireEvent.change(await screen.findByLabelText("Correo"), { target: { value: "rei@example.invalid" } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "mala1234" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  expect(await screen.findByText("Correo o contraseña incorrectos.")).toBeInTheDocument();
  expect(screen.getByLabelText("Contraseña")).toHaveValue("");
  expect(screen.getByLabelText("Contraseña")).toHaveAttribute("aria-invalid", "true");
});

test("the invitation link creates her password: token read from the fragment and removed from the bar", async () => {
  window.history.replaceState(null, "", `/vendedor/kunca#t=${TOKEN}`);
  (portalLinkInfo as jest.Mock).mockResolvedValue({ name: "Rei Hinojosa", email: "rei@example.invalid", kind: "INVITE", storeName: "Kunca" });
  (portalSetPassword as jest.Mock).mockResolvedValue(session);
  render(<LiveSellerPortal slug="kunca" />);
  expect(await screen.findByRole("heading", { name: "Hola Rei, crea tu contraseña." })).toBeInTheDocument();
  expect(window.location.hash).toBe("");
  expect(portalLinkInfo).toHaveBeenCalledWith("kunca", TOKEN);
  fireEvent.change(screen.getByLabelText("Contraseña nueva"), { target: { value: "corta1" } });
  fireEvent.change(screen.getByLabelText("Repite la contraseña"), { target: { value: "corta1" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar y entrar" }));
  expect(screen.getByText("La contraseña tiene al menos 8 caracteres.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Contraseña nueva"), { target: { value: "nueva2026" } });
  fireEvent.change(screen.getByLabelText("Repite la contraseña"), { target: { value: "nueva2027" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar y entrar" }));
  expect(screen.getByText("Las contraseñas no coinciden.")).toBeInTheDocument();
  expect(portalSetPassword).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Repite la contraseña"), { target: { value: "nueva2026" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar y entrar" }));
  expect(await screen.findByRole("heading", { name: "Hola, Rei" })).toBeInTheDocument();
  expect(portalSetPassword).toHaveBeenCalledWith("kunca", TOKEN, "nueva2026");
});

test("a used or expired link explains it and offers the sign-in", async () => {
  window.history.replaceState(null, "", `/vendedor/kunca#t=${TOKEN}`);
  (portalLinkInfo as jest.Mock).mockRejectedValue(
    Object.assign(new Error("404"), {
      isAxiosError: true,
      response: { status: 404, data: { message: "El enlace venció o ya se usó. Pídele a Kunca uno nuevo." } },
    }),
  );
  render(<LiveSellerPortal slug="kunca" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("El enlace venció o ya se usó. Pídele a Kunca uno nuevo.");
  fireEvent.click(screen.getByRole("button", { name: "Ir al ingreso" }));
  expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
});

test("an expired session goes back to the sign-in and forgets the token", async () => {
  savePortalSession("kunca", session);
  (portalMe as jest.Mock).mockRejectedValue(axios401);
  render(<LiveSellerPortal slug="kunca" />);
  expect(await screen.findByText("Tu sesión terminó. Vuelve a entrar.")).toBeInTheDocument();
  expect(readPortalSession("kunca")).toBeNull();
});

test("forgot password asks the business for a new link", async () => {
  render(<LiveSellerPortal slug="kunca" />);
  fireEvent.click(await screen.findByRole("button", { name: "Olvidé mi contraseña" }));
  expect(screen.getByText(/Pídele al negocio que te mande un enlace/)).toBeInTheDocument();
});

test("tabs: her products with gain per unit, her sales without customer data and her earnings", async () => {
  savePortalSession("kunca", session);
  (portalProducts as jest.Mock).mockResolvedValue({
    agreement: { type: "PERCENT", percent: 10 },
    products: [{ productId: "p1", name: "Vestido Lino", imageUrl: null, regularPrice: 199, livePrice: 178, available: 6 }],
  });
  (portalSales as jest.Mock).mockResolvedValue({
    stats,
    lines: [
      { id: "l1", orderId: "o1", orderNumber: "ORD-1", createdAt: "2026-11-24T15:00:00Z", quantity: 1, paid: 178, state: "PENDING", commission: 17.8, customer: "María P.", product: "Vestido Lino" },
    ],
    payouts: [],
  });
  render(<LiveSellerPortal slug="kunca" />);
  fireEvent.click(await screen.findByRole("tab", { name: "Mis productos" }));
  const product = (await screen.findByText("Vestido Lino")).closest("tr")!;
  expect(within(product).getByText(/S\/\s17\.80/)).toBeInTheDocument();
  expect(screen.getByText(/Tu acuerdo: 10% sobre la venta/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Mis ventas" }));
  const sale = (await screen.findByText("ORD-1")).closest("tr")!;
  expect(within(sale).getByText("María P.")).toBeInTheDocument();
  expect(within(sale).getByText("Por confirmar")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Mis ganancias" }));
  expect(screen.getByRole("tab", { name: "Mis ganancias" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("Ya te pagaron")).toBeInTheDocument();
});

test("gain per unit follows each kind of agreement", () => {
  const p = { livePrice: 178, regularPrice: 199 };
  expect(gainPerUnit({ type: "PERCENT", percent: 10 }, p)).toBe(17.8);
  expect(gainPerUnit({ type: "PER_UNIT", amount: 5 }, p)).toBe(5);
  // Revendedora con 20 %: compra a 159.20 y vende a 178.
  expect(gainPerUnit({ type: "RESELLER", percent: 20 }, p)).toBe(18.8);
  expect(gainPerUnit({ type: "VOLUME", period: "MONTH", tiers: [{ from: 0, percent: 8 }] }, p)).toBe(14.24);
});

test("an expired stored session is ignored", () => {
  window.localStorage.setItem("powip-live-seller:kunca", JSON.stringify({ token: "x", expiresAt: "2000-01-01T00:00:00Z" }));
  expect(readPortalSession("kunca")).toBeNull();
  act(() => savePortalSession("kunca", null));
  expect(window.localStorage.getItem("powip-live-seller:kunca")).toBeNull();
});

// FEAT-33 C5: «Estoy en vivo» en Hoy: su catálogo pasa a los precios live del negocio; «Terminar live» lo vuelve normal.
test("«Estoy en vivo» puts her link on live prices and «Terminar live» ends it", async () => {
  savePortalSession("kunca", session);
  (portalSetOnAir as jest.Mock)
    .mockResolvedValueOnce({ onAir: true, onAirUntil: "2099-01-01T08:00:00Z" })
    .mockResolvedValueOnce({ onAir: false, onAirUntil: null });
  render(<LiveSellerPortal slug="kunca" />);
  const live = await screen.findByRole("region", { name: "Tu live" });
  expect(within(live).getByText("No estás en vivo")).toBeInTheDocument();
  expect(within(live).getByText("Tu link sigue abierto con precios normales")).toBeInTheDocument();
  fireEvent.click(within(live).getByRole("button", { name: "🔴 Estoy en vivo" }));
  expect(await within(live).findByText("Estás en vivo")).toBeInTheDocument();
  expect(within(live).getByText(/Tu catálogo muestra los precios del live del negocio/)).toBeInTheDocument();
  expect(portalSetOnAir).toHaveBeenLastCalledWith("kunca", session.token, true);
  fireEvent.click(within(live).getByRole("button", { name: "⏹ Terminar live" }));
  expect(await within(live).findByText("No estás en vivo")).toBeInTheDocument();
  expect(portalSetOnAir).toHaveBeenLastCalledWith("kunca", session.token, false);
  expect(within(live).getByRole("link", { name: "Ver mi catálogo ↗" })).toHaveAttribute(
    "href",
    expect.stringContaining("?a=rei-1a2b"),
  );
});
