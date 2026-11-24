import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import LiveSellersPanel from "../LiveSellersPanel";
import { liveLinks } from "../liveLinks";
import { changeLiveSellerAccess, createLiveSeller, getLiveSellers, issueLiveSellerLink } from "../liveService";
import type { LiveSeller, LiveSellersData } from "../types";

/**
 * FEAT-33 L5b (C3/C4): «Accesos al portal de creadoras». El negocio invita, restablece, pausa, desbloquea y
 * quita el acceso; sin proveedor de correo, el enlace de un solo uso se copia o se manda por WhatsApp.
 */
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("../liveService", () => ({
  ...jest.requireActual("../liveService"),
  getLiveSellers: jest.fn(),
  createLiveSeller: jest.fn(),
  issueLiveSellerLink: jest.fn(),
  changeLiveSellerAccess: jest.fn(),
}));

const TOKEN = "T".repeat(43);
const stats = { sales: 0, units: 0, orders: 0, earned: 0, pendingConfirmation: 0, paid: 0, toPay: 0 };
const seller = (patch: Partial<LiveSeller>): LiveSeller => ({
  id: "s1",
  name: "Rei Hinojosa",
  email: "rei@example.invalid",
  phone: "987654321",
  social: "@rei",
  code: "rei-1a2b",
  userId: null,
  status: "ACTIVE",
  agreement: { type: "PERCENT", percent: 10 },
  createdAt: "2026-11-20T10:00:00Z",
  productIds: [],
  stats,
  access: null,
  ...patch,
});
const active = { status: "ACTIVE" as const, hasPassword: true, lastLoginAt: null, locked: false, lockedUntil: null, pendingLink: null };
const load = (sellers: LiveSeller[]) =>
  (getLiveSellers as jest.Mock).mockResolvedValue({
    sellers,
    advisors: [],
    kpis: { sales: 0, earned: 0, toPay: 0, pendingConfirmation: 0, sellers: sellers.length },
    suggestedAgreement: { type: "PERCENT", percent: 10 },
  } satisfies LiveSellersData);
const links = liveLinks({ origin: "https://www.powip.tech", slug: "kunca" });
const vestido = {
  variantId: "v1",
  productId: "p1",
  name: "Vestido Lino",
  sku: "VL-1",
  regularPrice: 199,
  livePrice: 178,
  availableStock: 4,
  maxPerCustomer: null,
  enabled: true,
};
const panel = () =>
  render(<LiveSellersPanel storeId="store" storeName="Kunca" products={[vestido]} links={links} canManage />);
const accessRow = async (id = "s1") => within(await screen.findByTestId(`access-${id}`));
beforeEach(() => jest.resetAllMocks());

test("inviting shows the one-use portal link once, ready to copy or send by WhatsApp", async () => {
  load([seller({})]);
  (issueLiveSellerLink as jest.Mock).mockResolvedValue({ token: TOKEN, kind: "INVITE", expiresAt: "2026-12-01T10:00:00Z" });
  panel();
  const row = await accessRow();
  expect(row.getByText("Sin acceso")).toBeInTheDocument();
  fireEvent.click(row.getByRole("button", { name: "Darle acceso" }));
  const dialog = within(await screen.findByRole("dialog"));
  expect(issueLiveSellerLink).toHaveBeenCalledWith("store", "s1", "invite");
  expect(dialog.getByTestId("issued-link")).toHaveTextContent(`https://www.powip.tech/vendedor/kunca#t=${TOKEN}`);
  const whatsapp = dialog.getByRole("link", { name: /Enviar por WhatsApp/ });
  expect(decodeURIComponent(whatsapp.getAttribute("href")!)).toContain("Kunca te invitó a su portal de creadoras");
  expect(whatsapp.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/51987654321\?text=/);
  fireEvent.click(dialog.getByRole("button", { name: "Listo" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect((await accessRow()).getByText("Invitada")).toBeInTheDocument();
});

test("a seller without email needs one before she can be invited", async () => {
  load([seller({ email: null })]);
  panel();
  const row = await accessRow();
  expect(row.queryByRole("button", { name: "Darle acceso" })).not.toBeInTheDocument();
  expect(row.getByRole("button", { name: "Agregar correo" })).toBeInTheDocument();
});

test("each access state offers its own actions", async () => {
  load([
    seller({ access: { ...active, lastLoginAt: "2026-11-23T20:00:00Z" } }),
    seller({ id: "s2", name: "Ivana", access: { ...active, locked: true, lockedUntil: "2099-01-01T00:00:00Z" } }),
    seller({ id: "s3", name: "Mara", access: { ...active, status: "PAUSED" } }),
    seller({
      id: "s4",
      name: "Lía",
      access: { ...active, status: "INVITED", hasPassword: false, pendingLink: { kind: "INVITE", expiresAt: "2099-01-01T00:00:00Z" } },
    }),
  ]);
  panel();
  const rei = await accessRow("s1");
  expect(rei.getByText("Activa")).toBeInTheDocument();
  expect(rei.queryByText("Nunca")).not.toBeInTheDocument();
  expect(rei.getByRole("button", { name: "Restablecer contraseña" })).toBeInTheDocument();
  expect(rei.getByRole("button", { name: "Pausar acceso" })).toBeInTheDocument();
  const ivana = await accessRow("s2");
  expect(ivana.getByText("Bloqueada")).toBeInTheDocument();
  expect(ivana.getByRole("button", { name: "Desbloquear" })).toBeInTheDocument();
  expect((await accessRow("s3")).getByRole("button", { name: "Reactivar" })).toBeInTheDocument();
  const lia = await accessRow("s4");
  expect(lia.getByText("Invitada")).toBeInTheDocument();
  expect(lia.getByText(/Enlace vigente hasta/)).toBeInTheDocument();
  expect(lia.getByRole("button", { name: "Reenviar invitación" })).toBeInTheDocument();
});

test("pause, unlock and remove call the API and update the row", async () => {
  load([seller({ access: active }), seller({ id: "s2", name: "Ivana", access: { ...active, locked: true, lockedUntil: "2099-01-01T00:00:00Z" } })]);
  (changeLiveSellerAccess as jest.Mock).mockImplementation(async (_store, id, action) =>
    action === "remove" ? { access: null } : { access: { ...active, status: action === "pause" ? "PAUSED" : "ACTIVE" } },
  );
  panel();
  fireEvent.click((await accessRow("s1")).getByRole("button", { name: "Pausar acceso" }));
  await waitFor(() => expect((screen.getByTestId("access-s1"))).toHaveTextContent("Pausada"));
  expect(changeLiveSellerAccess).toHaveBeenCalledWith("store", "s1", "pause");
  fireEvent.click((await accessRow("s2")).getByRole("button", { name: "Desbloquear" }));
  await waitFor(() => expect(screen.getByTestId("access-s2")).toHaveTextContent("Activa"));
  fireEvent.click((await accessRow("s2")).getByRole("button", { name: "Quitar acceso" }));
  const dialog = within(await screen.findByRole("dialog"));
  expect(dialog.getByText(/Su link de venta y sus comisiones siguen igual/)).toBeInTheDocument();
  fireEvent.click(dialog.getByRole("button", { name: "Quitar acceso" }));
  await waitFor(() => expect(screen.getByTestId("access-s2")).toHaveTextContent("Sin acceso"));
  expect(changeLiveSellerAccess).toHaveBeenCalledWith("store", "s2", "remove");
});

test("creating a seller with email also issues her portal invitation", async () => {
  load([]);
  (createLiveSeller as jest.Mock).mockResolvedValue(seller({ id: "s9", name: "Nina Ríos", email: "nina@example.invalid" }));
  (issueLiveSellerLink as jest.Mock).mockResolvedValue({ token: TOKEN, kind: "INVITE", expiresAt: "2026-12-01T10:00:00Z" });
  panel();
  fireEvent.click(await screen.findByRole("button", { name: /Invitar creadora o vendedor/ }));
  const form = within(await screen.findByRole("dialog"));
  fireEvent.change(form.getByLabelText("Nombre y apellido"), { target: { value: "Nina Ríos" } });
  fireEvent.change(form.getByLabelText("Correo (será su usuario)"), { target: { value: "nina@example.invalid" } });
  fireEvent.click(form.getByRole("button", { name: "Crear su link" }));
  await waitFor(() => expect(issueLiveSellerLink).toHaveBeenCalledWith("store", "s9", "invite"));
  expect(await screen.findByTestId("issued-link")).toHaveTextContent(`/vendedor/kunca#t=${TOKEN}`);
});
