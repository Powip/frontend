import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PromotionsView from "@/components/promotions/PromotionsView";
import { createPromotion, listPromotions, updatePromotion, type Promotion } from "@/services/promotionsService";
import { listPurchasableProducts } from "@/services/purchasesService";
import { getStockByVariants } from "@/services/inventoryItems.service";
import { fetchVariantsByIds } from "@/services/variantCodesService";
import { searchReconciliationVariants } from "@/services/reconciliationTask.service";
import { giftBackupKey, giftMigrationKey, giftToPromotion, legacyPackKeys, migrateLocalGifts, type LocalGiftPack } from "@/lib/promotions/giftMigration";
import { endsAtFromDate, lastDayFromEndsAt, startsAtFromDate } from "@/lib/promotions/promoRules";
import { volumeApplies } from "@/hooks/usePacksEngine";
import type { VolumePack } from "@/interfaces/IPack";

let mockRole = "ADMINISTRADOR";
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => "/packs-promos" }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      accessToken: "t",
      user: { id: "u1", email: "ana@tienda.pe", role: mockRole },
      company: { id: "c1", stores: [{ id: "s1", name: "Livii" }, { id: "s2", name: "Sisi" }] },
    },
  }),
}));
jest.mock("@/services/promotionsService", () => ({
  listPromotions: jest.fn(),
  createPromotion: jest.fn(),
  updatePromotion: jest.fn(),
  deletePromotion: jest.fn(),
  getCampaignPrices: jest.fn(),
  resolvePrices: jest.fn(),
}));
jest.mock("@/services/purchasesService", () => ({ listPurchasableProducts: jest.fn(), listProductVariants: jest.fn(), getVariantCosts: jest.fn() }));
jest.mock("@/services/inventoryItems.service", () => ({ getStockByVariants: jest.fn() }));
jest.mock("@/services/variantCodesService", () => ({ fetchVariantsByIds: jest.fn() }));
jest.mock("@/services/reconciliationTask.service", () => ({ searchReconciliationVariants: jest.fn() }));

const GIFT_PROMO: Promotion = {
  id: "pr-1", name: "Gorra de regalo", type: "GIFT", isActive: true, channels: ["WHATSAPP"], storeIds: ["s1"],
  startsAt: "2026-11-01T05:00:00.000Z", endsAt: "2026-12-01T05:00:00.000Z", productId: null, minQty: null, maxQty: null,
  packPrice: null, giftCondition: "AMOUNT", minAmount: 150, triggerVariantId: null, giftVariantId: "v-gorra", giftQuantity: 1,
  variantIds: [],
} as unknown as Promotion;

/** FEAT-32 M4 — volumen por SKUs (3 blusas Sofía a S/ 210, hasta 6). */
const VOLUME_PROMO = {
  ...GIFT_PROMO, id: "pr-2", name: "Lleva 3 blusas Sofía", type: "VOLUME", channels: [], storeIds: [], startsAt: null, endsAt: null,
  giftCondition: null, minAmount: null, giftVariantId: null, giftQuantity: null, minQty: 3, maxQty: 6, packPrice: 210,
  variantIds: ["v-sof-s", "v-sof-m", "v-sof-l"], status: "ACTIVE", combinable: false,
} as unknown as Promotion;

const localGift = (patch: Partial<LocalGiftPack> = {}): LocalGiftPack => ({
  id: "g-1", type: "GIFT", name: "Llavero", active: true, channels: ["WHATSAPP", "SHOPIFY", "RAPPI"], triggerBy: "amount", minAmount: 100,
  gifts: [{ variantId: "v-llavero", productName: "Llavero", trackingMode: "NONE" }, { variantId: "v-otro", productName: "Otro" }], ...patch,
});

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PromotionsView /></QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  mockRole = "ADMINISTRADOR";
  jest.mocked(listPromotions).mockResolvedValue([GIFT_PROMO]);
  jest.mocked(listPurchasableProducts).mockResolvedValue([]);
  jest.mocked(fetchVariantsByIds).mockResolvedValue([
    { id: "v-gorra", sku: "G", companySku: "GOR", barcode: null, powipEan: null, attributeValues: { Color: "Negro" }, productName: "Gorra" },
  ]);
  jest.mocked(getStockByVariants).mockResolvedValue([{ variant_id: "v-gorra", quantity: 5, reserved_quantity: 1, available: 4, inventories: [] }]);
  jest.mocked(updatePromotion).mockResolvedValue(undefined);
});

describe("vigencia y reglas (H9-D5)", () => {
  it("«hasta» incluido se guarda como el inicio del día siguiente en Lima y vuelve igual", () => {
    expect(startsAtFromDate("2026-11-20")).toBe("2026-11-20T00:00:00-05:00");
    expect(endsAtFromDate("2026-11-30")).toBe("2026-12-01T00:00:00-05:00");
    expect(lastDayFromEndsAt("2026-12-01T05:00:00.000Z")).toBe("2026-11-30");
  });

  it("una promo de Volumen aplica por tienda, canal (vacío = todos, SHOPIFY = WEB) y vigencia", () => {
    const now = Date.parse("2026-11-18T15:00:00Z");
    const promo = { type: "VOLUME", channels: [], storeIds: [], startsAt: null, endsAt: null } as unknown as VolumePack;
    expect(volumeApplies(promo, "WHATSAPP", "s1", now)).toBe(true);
    expect(volumeApplies({ ...promo, channels: ["WEB"] }, "SHOPIFY", "s1", now)).toBe(true);
    expect(volumeApplies({ ...promo, channels: ["WEB"] }, "WHATSAPP", "s1", now)).toBe(false);
    expect(volumeApplies({ ...promo, storeIds: ["s2"] }, "WHATSAPP", "s1", now)).toBe(false);
    expect(volumeApplies({ ...promo, startsAt: "2026-11-19T05:00:00Z" }, undefined, undefined, now)).toBe(false);
    expect(volumeApplies({ ...promo, endsAt: "2026-11-18T15:00:00Z" }, undefined, undefined, now)).toBe(false);
  });
});

describe("Ventas › Promociones", () => {
  it("lista la promo de regalo con su regla (SKU y monto), tiendas, canales y vigencia con hora de Lima", async () => {
    renderView();
    const card = await screen.findByRole("row", { name: /Gorra de regalo/ });
    await waitFor(() => expect(within(card).getByText("Regalo GOR desde S/ 150.00")).toBeInTheDocument());
    expect(within(card).getByText("Gorra · Negro")).toBeInTheDocument();
    expect(within(card).getByText("Livii")).toBeInTheDocument();
    expect(within(card).getByText("WhatsApp")).toBeInTheDocument();
    expect(within(card).getByText("01/11/2026 00:00")).toBeInTheDocument();
    expect(within(card).getByText("hasta 01/12/2026 00:00")).toBeInTheDocument();
    expect(getStockByVariants).toHaveBeenCalledWith(["v-gorra"]);
    expect(within(card).queryByText("Sin stock del regalo")).not.toBeInTheDocument();
  });

  it("FEAT-32 M4: un regalo sin stock dice «Sin stock del regalo»", async () => {
    jest.mocked(getStockByVariants).mockResolvedValue([{ variant_id: "v-gorra", quantity: 2, reserved_quantity: 2, available: 0, inventories: [] }]);
    renderView();
    const card = await screen.findByRole("row", { name: /Gorra de regalo/ });
    expect(await within(card).findByText("Sin stock del regalo")).toBeInTheDocument();
  });

  it("FEAT-32 M4: el volumen dice «3 por S/ 210.00 · hasta 6 u.» y nombra sus primeros SKUs", async () => {
    jest.mocked(listPromotions).mockResolvedValue([VOLUME_PROMO]);
    jest.mocked(fetchVariantsByIds).mockResolvedValue([
      { id: "v-sof-s", sku: "x", companySku: "SOF-S-CRE", barcode: null, powipEan: null, attributeValues: { Talla: "S" }, productName: "Blusa Sofía" },
      { id: "v-sof-m", sku: "y", companySku: "SOF-M-CRE", barcode: null, powipEan: null, attributeValues: { Talla: "M" }, productName: "Blusa Sofía" },
    ]);
    renderView();
    const row = await screen.findByRole("row", { name: /Lleva 3 blusas Sofía/ });
    expect(within(row).getByText("3 por S/ 210.00 · hasta 6 u.")).toBeInTheDocument();
    expect(within(row).getByText("S/ 70.00 c/u")).toBeInTheDocument();
    expect(await within(row).findByText("SOF-S-CRE, SOF-M-CRE y 1 más")).toBeInTheDocument();
    expect(within(row).getByText("3 SKUs")).toBeInTheDocument();
    expect(within(row).getByText("Sin fecha")).toBeInTheDocument();
    // Solo pide los 2 SKUs que nombra la tabla.
    expect(fetchVariantsByIds).toHaveBeenCalledWith(["v-sof-m", "v-sof-s"], "c1");
  });

  it("crea un regalo por monto con los canales reales del pedido (sin Rappi ni Pedidos Ya), tienda y vigencia", async () => {
    jest.mocked(listPromotions).mockResolvedValue([]);
    jest.mocked(createPromotion).mockResolvedValue(GIFT_PROMO);
    jest.mocked(searchReconciliationVariants).mockResolvedValue([
      { variant_id: "v-gorra", product_name: "Gorra", sku: "G", company_sku: "GOR", attribute_values: {}, product_type: "simple", tracking_mode: "NONE" },
    ]);
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByRole("button", { name: "Nueva promoción" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /^Regalo/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Nueva promoción · Regalo" })).toBeInTheDocument();
    // FEAT-32 M4 (spec §6.19): la misma lista que la campaña, más POWIP Live.
    const channels = within(dialog).getByRole("group", { name: "Canales" });
    expect(within(channels).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "POWIP Live", "POWIP CRM", "Catálogo web", "Tienda física", "WhatsApp", "Instagram", "Facebook", "Marketplace", "Mercado Libre", "Web / Shopify", "Google Sheets", "Otro",
    ]);
    await user.type(within(dialog).getByLabelText("Nombre"), "Gorra gratis");
    await user.click(within(within(dialog).getByRole("group", { name: "Tiendas" })).getByRole("button", { name: "Livii" }));
    await user.click(within(channels).getByRole("button", { name: "Instagram" }));
    fireEvent.change(within(dialog).getByLabelText(/^Hasta/), { target: { value: "2026-11-30T23:59" } });
    await user.type(within(dialog).getByLabelText("Compras desde (S/)"), "150");
    await user.type(within(dialog).getByLabelText("SKU que se regala"), "gor");
    await user.click(await within(dialog).findByRole("button", { name: /Gorra/ }));
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(createPromotion).toHaveBeenCalledWith({
        name: "Gorra gratis", type: "GIFT", channels: ["INSTAGRAM"], storeIds: ["s1"], startsAt: null, endsAt: "2026-11-30T23:59:00-05:00",
        giftCondition: "AMOUNT", giftVariantId: "v-gorra", giftQuantity: 1, minAmount: 150, combinable: false,
      }),
    );
  });

  it("sin rol de Administrador no edita ni migra los regalos del navegador", async () => {
    mockRole = "VENTAS";
    window.localStorage.setItem(legacyPackKeys("c1")[0], JSON.stringify([localGift()]));
    renderView();
    await screen.findByRole("row", { name: /Gorra de regalo/ });
    expect(screen.queryByRole("button", { name: "Nueva promoción" })).not.toBeInTheDocument();
    expect(screen.getByText(/Pídele a un Administrador/)).toBeInTheDocument();
    expect(createPromotion).not.toHaveBeenCalled();
  });

  it("FEAT-32 M3: Operaciones también gestiona promociones (igual que ms-ventas)", async () => {
    mockRole = "OPERACIONES";
    renderView();
    await screen.findByRole("row", { name: /Gorra de regalo/ });
    expect(screen.getByRole("button", { name: "Nueva promoción" })).toBeInTheDocument();
  });

  it("FEAT-32 M3: «Crear promoción» desde Productos abre la campaña con los productos ya elegidos", async () => {
    jest.mocked(listPurchasableProducts).mockResolvedValue([
      { id: "p1", name: "Pantalón Jimena", companySku: "JIM" },
      { id: "p2", name: "Blusa Sofía", companySku: "SOF" },
    ] as never);
    window.history.pushState({}, "", "/packs-promos?nueva=campana&productos=p1");
    try {
      renderView();
      expect(await screen.findByRole("heading", { name: "Nueva promoción" })).toBeInTheDocument();
      expect(await screen.findByRole("checkbox", { name: "Incluir Pantalón Jimena" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Incluir Blusa Sofía" })).not.toBeChecked();
    } finally {
      window.history.pushState({}, "", "/");
    }
  });
});

describe("migración única de regalos del navegador", () => {
  it("convierte un regalo local: monto, primera opción, SHOPIFY → WEB y sin Rappi", () => {
    expect(giftToPromotion(localGift())).toEqual({
      body: {
        name: "Llavero", type: "GIFT", channels: ["WHATSAPP", "WEB"], storeIds: [], startsAt: null, endsAt: null,
        giftCondition: "AMOUNT", minAmount: 100, giftVariantId: "v-llavero", giftQuantity: 1,
      },
      isActive: true,
      extraOptions: 1,
    });
    expect(giftToPromotion(localGift({ triggerBy: "qty", minQty: 3 }))).toEqual({ reason: expect.stringMatching(/cantidad total/) });
    expect(giftToPromotion(localGift({ channels: ["RAPPI", "PEDIDOS_YA"] }))).toEqual({ reason: expect.stringMatching(/Rappi/) });
  });

  it("los pasa una sola vez: avisa, saca los regalos del navegador, conserva los bundles y no repite al volver", async () => {
    const bundle = { id: "b-1", type: "BUNDLE", name: "Combo", active: true, channels: [], items: [], packPrice: 10 };
    const inactive = localGift({ id: "g-2", name: "Taza", active: false, gifts: [{ variantId: "v-taza", productName: "Taza" }] });
    const byQty = localGift({ id: "g-3", name: "Por unidades", triggerBy: "qty" });
    window.localStorage.setItem(legacyPackKeys("c1")[0], JSON.stringify([bundle, localGift(), inactive, byQty]));
    jest.mocked(createPromotion).mockResolvedValueOnce({ ...GIFT_PROMO, id: "new-1" }).mockResolvedValueOnce({ ...GIFT_PROMO, id: "new-2" });

    const { unmount } = renderView();
    const notice = await screen.findByText(/Pasamos 2 regalo\(s\) al servidor/);
    expect(notice.closest("[role=status]")).toHaveTextContent("Por unidades: La condición «cantidad total de unidades» ya no existe");
    expect(createPromotion).toHaveBeenCalledTimes(2);
    expect(updatePromotion).toHaveBeenCalledWith("new-2", { isActive: false });
    expect(JSON.parse(window.localStorage.getItem(legacyPackKeys("c1")[0])!)).toEqual([bundle]);
    expect(JSON.parse(window.localStorage.getItem(giftBackupKey("c1"))!)).toEqual([expect.objectContaining({ id: "g-3" })]);
    expect(JSON.parse(window.localStorage.getItem(giftMigrationKey("c1"))!)).toMatchObject({ done: true, migrated: { "g-1": "new-1", "g-2": "new-2" } });
    unmount();

    renderView();
    await screen.findByRole("row", { name: /Gorra de regalo/ });
    expect(screen.queryByText(/Pasamos/)).not.toBeInTheDocument();
    expect(createPromotion).toHaveBeenCalledTimes(2);
  });

  it("un regalo ya creado no se duplica aunque siga en el navegador, y uno que falló se reintenta", async () => {
    const storage = window.localStorage;
    storage.setItem(legacyPackKeys("c1")[1], JSON.stringify([localGift(), localGift({ id: "g-2", name: "Taza" })]));
    storage.setItem(giftMigrationKey("c1"), JSON.stringify({ done: false, migrated: { "g-1": "ya-creada" }, skipped: {} }));
    const create = jest.fn().mockRejectedValueOnce(new Error("Network Error"));
    const first = await migrateLocalGifts({ storage, companyId: "c1", create, deactivate: jest.fn() });
    expect(create).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({ status: "partial", failed: [{ name: "Taza" }] });
    expect(JSON.parse(storage.getItem(legacyPackKeys("c1")[1])!)).toEqual([expect.objectContaining({ id: "g-2" })]);

    create.mockResolvedValueOnce({ id: "new-2" });
    const second = await migrateLocalGifts({ storage, companyId: "c1", create, deactivate: jest.fn() });
    expect(second).toMatchObject({ status: "done", migrated: [{ name: "Taza" }] });
    expect(JSON.parse(storage.getItem(legacyPackKeys("c1")[1])!)).toEqual([]);
  });
});
