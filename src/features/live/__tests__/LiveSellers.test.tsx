import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import LiveSellersPanel from "../LiveSellersPanel";
import { saleRows } from "../LiveSellerSales";
import { liveLinks } from "../liveLinks";
import {
  createLiveSeller,
  getLiveSellerSales,
  getLiveSellers,
  payLiveSellerCommission,
  updateLiveSellerAgreement,
  updateLiveSellerProducts,
  updateLiveSuggestedAgreement,
} from "../liveService";
import type { LiveProduct, LiveSeller, LiveSellerSales, LiveSellersData } from "../types";

/**
 * FEAT-33 L5a (C1/C2): «Vendedores y comisiones» como el mockup: KPIs, tabla por persona, ⚙ Acuerdo con
 * un ejemplo en números reales, «Productos (N)», «Pasar a comisión» y «Marcar comisión como pagada».
 */
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("../liveService", () => ({
  ...jest.requireActual("../liveService"),
  getLiveSellers: jest.fn(),
  createLiveSeller: jest.fn(),
  updateLiveSellerAgreement: jest.fn(),
  updateLiveSellerProducts: jest.fn(),
  getLiveSellerSales: jest.fn(),
  payLiveSellerCommission: jest.fn(),
  updateLiveSuggestedAgreement: jest.fn(),
}));

const product = (patch: Partial<LiveProduct>): LiveProduct => ({
  variantId: "v1",
  productId: "p1",
  name: "Vestido Lino",
  sku: "VL-1",
  regularPrice: 199,
  livePrice: 178,
  availableStock: 4,
  maxPerCustomer: null,
  enabled: true,
  ...patch,
});
const products = [
  product({}),
  product({ variantId: "v2", livePrice: 178, availableStock: 2 }),
  product({ variantId: "v3", productId: "p2", name: "Polo Básico", regularPrice: 59, livePrice: 49 }),
];
const stats = { sales: 178, units: 1, orders: 1, earned: 17.8, pendingConfirmation: 10, paid: 0, toPay: 17.8 };
const rei: LiveSeller = {
  id: "s1",
  name: "Rei Hinojosa",
  email: "rei@example.invalid",
  phone: null,
  social: "@rei · TikTok",
  code: "rei-1a2b",
  userId: null,
  status: "ACTIVE",
  agreement: { type: "PERCENT", percent: 10 },
  createdAt: "2026-11-20T10:00:00Z",
  productIds: ["p1"],
  stats,
};
const data: LiveSellersData = {
  sellers: [rei],
  advisors: [{ id: "u1", name: "Lucía Paredes", code: "lucia" }],
  kpis: { sales: 178, earned: 17.8, toPay: 17.8, pendingConfirmation: 10, sellers: 1 },
  suggestedAgreement: { type: "PERCENT", percent: 10 },
};
const links = liveLinks({ origin: "https://www.powip.tech", slug: "kunca" });
const panel = () =>
  render(<LiveSellersPanel storeId="store" products={products} links={links} canManage />);
beforeEach(() => {
  jest.resetAllMocks();
  (getLiveSellers as jest.Mock).mockResolvedValue(data);
});

test("shows the KPIs and one row per seller and advisor with her link and agreement", async () => {
  panel();
  const kpis = within(await screen.findByTestId("seller-kpis"));
  expect(kpis.getByText("Ventas validadas de vendedores").nextSibling).toHaveTextContent(/S\/\s178\.00/);
  expect(kpis.getByText(/S\/\s10\.00 más cuando se validen sus pagos/)).toBeInTheDocument();
  expect(kpis.getByText("de 2 con link")).toBeInTheDocument();
  const row = within(screen.getByRole("table", { name: "Vendedores y su comisión" })).getByText("Rei Hinojosa").closest("tr")!;
  expect(within(row).getByText("10% sobre la venta")).toBeInTheDocument();
  expect(within(row).getByRole("button", { name: "Productos (1)" })).toBeInTheDocument();
  const advisor = screen.getByText("Lucía Paredes").closest("tr")!;
  expect(within(advisor).getByText("Sin comisión (asesora)")).toBeInTheDocument();
  expect(within(advisor).getByRole("button", { name: "Pasar a comisión" })).toBeInTheDocument();
});

test("⚙ Acuerdo shows a real example and saves the new agreement", async () => {
  (updateLiveSellerAgreement as jest.Mock).mockResolvedValue({ ...rei, agreement: { type: "PERCENT", percent: 15 } });
  panel();
  fireEvent.click(await screen.findByRole("button", { name: "Acuerdo de comisión de Rei Hinojosa" }));
  const dialog = within(await screen.findByRole("dialog"));
  expect(dialog.getByRole("heading", { name: "Acuerdo con Rei Hinojosa" })).toBeInTheDocument();
  expect(dialog.getByTestId("agreement-example")).toHaveTextContent(
    "Si vende 1 Vestido Lino a S/ 178.00 gana S/ 17.80.",
  );
  fireEvent.change(dialog.getByLabelText("Porcentaje"), { target: { value: "0" } });
  expect(dialog.getByText("El porcentaje va de 0.1 a 100.")).toBeInTheDocument();
  expect(dialog.getByRole("button", { name: "Guardar acuerdo" })).toBeDisabled();
  fireEvent.change(dialog.getByLabelText("Porcentaje"), { target: { value: "15" } });
  fireEvent.click(dialog.getByRole("button", { name: "Guardar acuerdo" }));
  await waitFor(() =>
    expect(updateLiveSellerAgreement).toHaveBeenCalledWith("store", "s1", { type: "PERCENT", percent: 15 }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByText("15% sobre la venta")).toBeInTheDocument();
});

test("volume agreements edit their tiers and the counting period", async () => {
  (updateLiveSellerAgreement as jest.Mock).mockImplementation(async (_s, _id, agreement) => ({ ...rei, agreement }));
  panel();
  fireEvent.click(await screen.findByRole("button", { name: "Acuerdo de comisión de Rei Hinojosa" }));
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.click(dialog.getByRole("button", { name: /Por volumen/ }));
  expect(dialog.getByLabelText("Desde prendas (escala 1)")).toBeDisabled();
  fireEvent.click(dialog.getByRole("button", { name: "Quitar escala 3" }));
  fireEvent.change(dialog.getByLabelText("Porcentaje (escala 2)"), { target: { value: "12,5" } });
  fireEvent.change(dialog.getByRole("combobox"), { target: { value: "LIVE" } });
  expect(dialog.getByTestId("agreement-example")).toHaveTextContent("Al llegar a 20 prendas en el live su % sube a 12.5%.");
  fireEvent.click(dialog.getByRole("button", { name: "Guardar acuerdo" }));
  await waitFor(() =>
    expect(updateLiveSellerAgreement).toHaveBeenCalledWith("store", "s1", {
      type: "VOLUME",
      period: "LIVE",
      tiers: [
        { from: 0, percent: 8 },
        { from: 20, percent: 12.5 },
      ],
    }),
  );
});

test("C2: Productos (N) chooses by product, not by variant, and saves the list", async () => {
  (updateLiveSellerProducts as jest.Mock).mockResolvedValue({ ...rei, productIds: ["p1", "p2"] });
  panel();
  fireEvent.click(await screen.findByRole("button", { name: "Productos (1)" }));
  const dialog = within(await screen.findByRole("dialog"));
  expect(dialog.getAllByRole("checkbox")).toHaveLength(2);
  expect(dialog.getByText(/Tienda S\/\s199\.00 · live S\/\s178\.00 · 6 disp\./)).toBeInTheDocument();
  fireEvent.click(dialog.getByRole("button", { name: "Todos" }));
  expect(dialog.getByText("2 productos")).toBeInTheDocument();
  fireEvent.click(dialog.getByRole("button", { name: "Guardar" }));
  await waitFor(() => expect(updateLiveSellerProducts).toHaveBeenCalledWith("store", "s1", ["p1", "p2"]));
  expect(await screen.findByRole("button", { name: "Productos (2)" })).toBeInTheDocument();
});

test("invite: errors below each field, then creates her link with the suggested agreement", async () => {
  (createLiveSeller as jest.Mock).mockResolvedValue({ ...rei, id: "s2", name: "Ana Torres" });
  panel();
  fireEvent.click(await screen.findByRole("button", { name: /Invitar creadora o vendedor/ }));
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.click(dialog.getByRole("button", { name: "Ninguno" }));
  fireEvent.change(dialog.getByLabelText("WhatsApp"), { target: { value: "12345" } });
  fireEvent.click(dialog.getByRole("button", { name: "Crear su link" }));
  expect(dialog.getByText("Escribe su nombre y apellido.")).toBeInTheDocument();
  expect(dialog.getByText("El WhatsApp tiene 9 dígitos y empieza con 9.")).toBeInTheDocument();
  expect(dialog.getByText("Elige al menos un producto.")).toBeInTheDocument();
  expect(createLiveSeller).not.toHaveBeenCalled();
  fireEvent.change(dialog.getByLabelText("Nombre y apellido"), { target: { value: " Ana Torres " } });
  fireEvent.change(dialog.getByLabelText("WhatsApp"), { target: { value: "987 654 321" } });
  fireEvent.change(dialog.getByLabelText("Correo (será su usuario)"), { target: { value: "ana@example.invalid" } });
  fireEvent.click(dialog.getByRole("checkbox", { name: /Polo Básico/ }));
  fireEvent.click(dialog.getByRole("button", { name: "Crear su link" }));
  await waitFor(() =>
    expect(createLiveSeller).toHaveBeenCalledWith("store", {
      name: "Ana Torres",
      email: "ana@example.invalid",
      phone: "987654321",
      agreement: { type: "PERCENT", percent: 10 },
      productIds: ["p2"],
    }),
  );
  await waitFor(() => expect(getLiveSellers).toHaveBeenCalledTimes(2));
});

test("an advisor passes to commission keeping her link", async () => {
  (createLiveSeller as jest.Mock).mockResolvedValue({ ...rei, id: "s3", name: "Lucía Paredes", code: "lucia" });
  panel();
  fireEvent.click(await screen.findByRole("button", { name: "Pasar a comisión" }));
  const dialog = within(await screen.findByRole("dialog"));
  expect(dialog.getByRole("heading", { name: "Pasar a comisión a Lucía Paredes" })).toBeInTheDocument();
  expect(dialog.getByLabelText("Nombre y apellido")).toHaveValue("Lucía Paredes");
  fireEvent.click(dialog.getByRole("button", { name: /Monto fijo por prenda/ }));
  fireEvent.click(dialog.getByRole("button", { name: "Pasar a comisión" }));
  await waitFor(() =>
    expect(createLiveSeller).toHaveBeenCalledWith(
      "store",
      expect.objectContaining({
        name: "Lucía Paredes",
        fromAdvisorId: "u1",
        agreement: { type: "PER_UNIT", amount: 5 },
        productIds: ["p1", "p2"],
      }),
    ),
  );
});

test("the suggested commission saves only when it changed", async () => {
  (updateLiveSuggestedAgreement as jest.Mock).mockResolvedValue({ suggestedAgreement: { type: "PER_UNIT", amount: 5 } });
  panel();
  const save = await screen.findByRole("button", { name: "Guardar comisión" });
  expect(save).toBeDisabled();
  const card = within(save.closest("section")!);
  fireEvent.click(card.getByRole("button", { name: /Monto fijo por prenda/ }));
  expect(card.getByText("● Cambios sin guardar")).toBeInTheDocument();
  expect(card.getByTestId("agreement-example")).toHaveTextContent("Gana S/ 5.00 por cada prenda, sin importar el precio.");
  fireEvent.click(save);
  await waitFor(() =>
    expect(updateLiveSuggestedAgreement).toHaveBeenCalledWith("store", { type: "PER_UNIT", amount: 5 }),
  );
});

const sales: LiveSellerSales = {
  seller: rei,
  stats: { ...stats, paid: 5, toPay: 12.8 },
  lines: [
    { id: "l1", orderId: "o1", orderNumber: "ORD-1", createdAt: "2026-11-20T15:00:00Z", quantity: 1, paid: 178, state: "CONFIRMED", commission: 17.8, customer: "Rosa Q.", product: "Vestido" },
    { id: "l2", orderId: "o2", orderNumber: "ORD-2", createdAt: "2026-11-21T15:00:00Z", quantity: 2, paid: 100, state: "PENDING", commission: 10, customer: "Ana T.", product: "Polo" },
  ],
  payouts: [{ id: "py", amount: 5, note: "Yape 20/11", paidAt: "2026-11-21T20:00:00Z" }],
};

test("Ver ventas lists her orders with their commission and records a payment up to what is owed", async () => {
  (getLiveSellerSales as jest.Mock).mockResolvedValue(sales);
  (payLiveSellerCommission as jest.Mock).mockResolvedValue({ ...rei, stats: { ...stats, paid: 17.8, toPay: 0 } });
  panel();
  fireEvent.click(await screen.findByRole("button", { name: "Ver ventas" }));
  expect(await screen.findByRole("heading", { name: /Rei Hinojosa/ })).toBeInTheDocument();
  expect(screen.getByText(`🔗 ${links.advisorUrl("rei-1a2b")}`)).toBeInTheDocument();
  const pending = (await screen.findByText("ORD-2")).closest("tr")!;
  expect(within(pending).getByText("Por confirmar")).toBeInTheDocument();
  expect(within(pending).getByText("Ana T.")).toBeInTheDocument();
  expect(within(screen.getByText("ORD-1").closest("tr")!).getByText("Validado")).toBeInTheDocument();
  expect(screen.getByText(/Yape 20\/11/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Marcar comisión como pagada" }));
  const dialog = within(await screen.findByRole("dialog"));
  expect(dialog.getByLabelText("Monto pagado")).toHaveValue("12.80");
  fireEvent.change(dialog.getByLabelText("Monto pagado"), { target: { value: "13" } });
  expect(dialog.getByRole("button", { name: "Marcar como pagada" })).toBeDisabled();
  fireEvent.change(dialog.getByLabelText("Monto pagado"), { target: { value: "12.8" } });
  fireEvent.click(dialog.getByRole("button", { name: "Marcar como pagada" }));
  await waitFor(() =>
    expect(payLiveSellerCommission).toHaveBeenCalledWith("store", "s1", { amount: 12.8 }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Vendedores" }));
  expect(await screen.findByTestId("seller-kpis")).toBeInTheDocument();
});

test("an order that merges purchases of several days is one row; any pending purchase keeps it pending", () => {
  const base = sales.lines[0];
  const rows = saleRows([
    base,
    { ...base, id: "x", state: "PENDING", paid: 50, commission: 5, quantity: 1, createdAt: "2026-11-22T10:00:00Z" },
    { ...base, id: "y", state: "VOID", paid: 999, commission: 0 },
  ]);
  expect(rows).toEqual([
    expect.objectContaining({ orderId: "o1", units: 2, sale: 228, commission: 22.8, state: "PENDING" }),
  ]);
  expect(saleRows([{ ...base, state: "VOID" }])[0]).toMatchObject({ state: "VOID", sale: 0 });
});
