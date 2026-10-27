import { useState } from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { PacksProvider, usePacks } from "../PacksContext";
import { usePacksEngine } from "@/hooks/usePacksEngine";
import SuggestionsPanel from "@/components/registrar-venta/SuggestionsPanel";
import type { BundlePack, GiftPack } from "@/interfaces/IPack";
import type { CartItem } from "@/interfaces/IOrder";
import * as api from "@/services/bundlePromos.service";
import { listVolumePromos } from "@/services/promos.service";
import { toast } from "sonner";
import { tokenStore } from "@/lib/tokenStore";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/services/promos.service", () => ({
  listVolumePromos: jest.fn().mockResolvedValue([]), createVolumePromo: jest.fn(), updatePromo: jest.fn(), deletePromo: jest.fn(),
}));
jest.mock("@/services/bundlePromos.service", () => ({
  listBundlePromos: jest.fn(), getBundleCapabilities: jest.fn(), importBundlePromos: jest.fn(),
  createBundlePromo: jest.fn(), updateBundlePromo: jest.fn(), deleteBundlePromo: jest.fn(),
}));
const mockApi = jest.mocked(api);
const mockAuth = jest.mocked(useAuth);
const bundle: BundlePack = {
  id: "4825ec4e-5fdc-4c35-a0d0-ac59929cef77", type: "BUNDLE", schemaVersion: 2,
  name: "Kit salud 300 g", active: true, channels: ["WHATSAPP"], packPrice: 120,
  items: [
    { productId: "supplement", variantId: "supplement-300", productKey: "Suplemento", productName: "Suplemento", price: 100, sku: "SUP-300", attributes: { Tamaño: "300 g" } },
    { productId: "vitamin", variantId: "vitamin-1", productKey: "Vitamina", productName: "Vitamina", price: 50, sku: "VIT-1" },
  ],
};
const gift: GiftPack = {
  id: "gift-local", type: "GIFT", name: "Obsequio", active: true, channels: ["WHATSAPP"], triggerBy: "qty", minQty: 99,
  gifts: [{ variantId: "gift-variant", inventoryItemId: "gift-stock", sku: "G", productName: "Obsequio", value: 1 }],
};
const localKey = (company = "A") => `powip.packs.local.${company}`;
const variantKey = (company = "A") => `powip.packs.variants.v1.${company}`;
const backupKey = (company = "A") => `powip.packs.shared-backup.v1.${company}`;
const shared = (pack = bundle): BundlePack => ({ ...pack, shared: true, synced: false });
const server = new Map<string, Map<string, BundlePack | null>>();
function companyFor(token?: string) { return token?.split(":")[0] ?? "A"; }
function rows(token?: string) {
  const company = companyFor(token);
  if (!server.has(company)) server.set(company, new Map());
  return server.get(company)!;
}
function session(company = "A", user = "owner", admin = true) {
  tokenStore.invalidate();
  tokenStore.set(`${company}:${admin ? "admin" : "seller"}`, `${company}:${user}`);
  mockAuth.mockReturnValue({ loading: false, auth: {
    company: { id: company }, user: { id: user, role: admin ? "ADMINISTRADOR" : "VENDEDOR", permissions: ["CREATE_SALE"] },
    accessToken: `${company}:${admin ? "admin" : "seller"}`,
  } } as ReturnType<typeof useAuth>);
}
function wrapper({ children }: { children: React.ReactNode }) { return <PacksProvider>{children}</PacksProvider>; }
const renderPacks = () => renderHook(() => usePacks(), { wrapper });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function Recommendations() {
  const { packs } = usePacks();
  const [cart, setCart] = useState<CartItem[]>(bundle.items.map((item) => ({
    id: item.variantId!, variantId: item.variantId!, inventoryItemId: `stock-${item.variantId}`,
    sku: item.sku!, productName: item.productName, price: item.price, pvp: item.price, quantity: 1, discount: 0,
  })));
  const engine = usePacksEngine({ packs, channel: "WHATSAPP", cart, setCart, getVariantsForProduct: async () => [] });
  return <SuggestionsPanel packs={packs} channel="WHATSAPP" appliedPacks={engine.appliedPacks}
    pendingHints={engine.pendingHints} modelQtyInCart={engine.modelQtyInCart} bundleQtyInCart={engine.bundleQtyInCart}
    subtotalPayable={engine.subtotalPayable} totalUnits={engine.totalUnits} isAdmin={false}
    onApplyPack={engine.applyPack} onAutoFillVolume={() => {}} onAutoAddBundleItem={() => {}} />;
}
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(listVolumePromos).mockResolvedValue([]);
  window.localStorage.clear(); server.clear(); session();
  mockApi.listBundlePromos.mockImplementation(async (token) => ({
    bundles: [...rows(token).values()].filter((value): value is BundlePack => value !== null),
    deletedIds: [...rows(token)].filter(([, value]) => value === null).map(([id]) => id),
  }));
  mockApi.getBundleCapabilities.mockImplementation(async (token) => ({ canManage: token?.endsWith(":admin") === true }));
  mockApi.importBundlePromos.mockImplementation(async (packs, token) => {
    const store = rows(token);
    for (const pack of packs) if (!store.has(pack.id)) store.set(pack.id, shared(pack));
    return { acceptedIds: packs.map((pack) => pack.id), bundles: [...store.values()].filter((value): value is BundlePack => !!value) };
  });
  mockApi.createBundlePromo.mockImplementation(async (pack, token) => { const saved = shared(pack); rows(token).set(pack.id, saved); return saved; });
  mockApi.updateBundlePromo.mockImplementation(async (id, pack, token) => { const saved = shared({ ...pack, id }); rows(token).set(id, saved); return saved; });
  mockApi.deleteBundlePromo.mockImplementation(async (id, token) => { rows(token).set(id, null); });
});
afterEach(() => jest.restoreAllMocks());

it("importa el origen, conserva regalos y respaldo, y otro vendedor sin storage recibe la recomendación exacta", async () => {
  window.localStorage.setItem(variantKey(), JSON.stringify([bundle]));
  window.localStorage.setItem(localKey(), JSON.stringify([gift]));
  const owner = renderPacks();
  await waitFor(() => expect(owner.result.current.packs).toEqual([gift, shared()]));
  expect(JSON.parse(window.localStorage.getItem(backupKey())!)).toEqual([bundle]);
  expect(JSON.parse(window.localStorage.getItem(localKey())!)).toEqual([gift]);
  expect(window.localStorage.getItem(variantKey())).toBe("[]");
  owner.unmount();

  // A separate browser/session has no access to the creator's localStorage.
  window.localStorage.clear(); session("A", "seller", false);
  const seller = render(<PacksProvider><Recommendations /></PacksProvider>);
  expect(await screen.findByRole("button", { name: "Aplicar bundle" })).toBeInTheDocument();
  expect(screen.getByText(/Suplemento · 300 g \+ Vitamina · VIT-1/)).toBeInTheDocument();
  expect(mockApi.importBundlePromos).toHaveBeenCalledTimes(1);
  seller.unmount();
  window.localStorage.clear(); session("B", "other-seller", false);
  const other = renderPacks();
  await waitFor(() => expect(other.result.current.loading).toBe(false));
  expect(other.result.current.packs).toEqual([]);
});

it("un fallo de capabilities no oculta el listado al vendedor ni importa su copia local", async () => {
  session("A", "seller", false); rows("A:seller").set(bundle.id, shared());
  window.localStorage.setItem(localKey(), JSON.stringify([gift]));
  mockApi.getBundleCapabilities.mockRejectedValue(new Error("offline"));
  const { result } = renderPacks();
  await waitFor(() => expect(result.current.packs).toEqual([gift, shared()]));
  expect(result.current.canManageBundles).toBe(false);
  expect(mockApi.importBundlePromos).not.toHaveBeenCalled();
});

it("un import fallido conserva el origen y el reintento no duplica ni sobrescribe el remoto", async () => {
  const remote = shared({ ...bundle, name: "Nombre servidor", active: false });
  rows("A:admin").set(bundle.id, remote);
  window.localStorage.setItem(variantKey(), JSON.stringify([bundle]));
  mockApi.importBundlePromos.mockRejectedValueOnce(new Error("offline"));
  const { result } = renderPacks();
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Se conserva la copia local")));
  expect(JSON.parse(window.localStorage.getItem(variantKey())!)).toEqual([bundle]);
  expect(result.current.packs).toEqual([remote]);
  fireEvent(window, new Event("focus"));
  await waitFor(() => expect(window.localStorage.getItem(variantKey())).toBe("[]"));
  expect(result.current.packs).toEqual([remote]);
  expect(rows("A:admin").size).toBe(1);
});

it("un tombstone confirmado retira la copia local sin resucitarla y conserva respaldo", async () => {
  rows("A:admin").set(bundle.id, null);
  window.localStorage.setItem(variantKey(), JSON.stringify([bundle]));
  const { result } = renderPacks();
  await waitFor(() => expect(window.localStorage.getItem(variantKey())).toBe("[]"));
  expect(result.current.packs).toEqual([]);
  expect(JSON.parse(window.localStorage.getItem(backupKey())!)).toEqual([bundle]);
});

it("un GET anterior a actualizar o eliminar no restaura el estado viejo", async () => {
  rows("A:admin").set(bundle.id, shared());
  const { result } = renderPacks();
  await waitFor(() => expect(result.current.canManageBundles).toBe(true));
  const oldList = deferred<{ bundles: BundlePack[]; deletedIds: string[] }>();
  mockApi.listBundlePromos.mockReturnValueOnce(oldList.promise);
  fireEvent(window, new Event("focus"));
  await act(async () => expect(await result.current.updatePack(bundle.id, { ...bundle, name: "Actualizado" })).toBe(true));
  expect(mockApi.updateBundlePromo).toHaveBeenCalledWith(bundle.id, expect.objectContaining({ name: "Actualizado" }), "A:admin");
  expect(mockApi.createBundlePromo).not.toHaveBeenCalled();
  await act(async () => oldList.resolve({ bundles: [shared()], deletedIds: [] }));
  expect(result.current.packs[0].name).toBe("Actualizado");

  const beforeDelete = deferred<{ bundles: BundlePack[]; deletedIds: string[] }>();
  mockApi.listBundlePromos.mockReturnValueOnce(beforeDelete.promise);
  fireEvent(window, new Event("focus"));
  await act(async () => expect(await result.current.deletePack(bundle.id)).toBe(true));
  await act(async () => beforeDelete.resolve({ bundles: [shared()], deletedIds: [] }));
  expect(result.current.packs).toEqual([]);
  expect(result.current.loading).toBe(false);
});

it("una importación pendiente de A no escribe storage de B ni aparece después de logout", async () => {
  const imported = deferred<{ acceptedIds: string[]; bundles: BundlePack[] }>();
  mockApi.importBundlePromos.mockReturnValueOnce(imported.promise);
  window.localStorage.setItem(variantKey(), JSON.stringify([bundle]));
  window.localStorage.setItem(localKey("B"), JSON.stringify([gift]));
  const { result, rerender } = renderPacks();
  await waitFor(() => expect(mockApi.importBundlePromos).toHaveBeenCalledTimes(1));
  session("B", "other", false); rerender();
  await waitFor(() => expect(result.current.packs).toEqual([gift]));
  mockAuth.mockReturnValue({ loading: false, auth: null } as ReturnType<typeof useAuth>); rerender();
  await act(async () => imported.resolve({ acceptedIds: [bundle.id], bundles: [shared()] }));
  expect(result.current.packs).toEqual([]);
  expect(JSON.parse(window.localStorage.getItem(variantKey())!)).toEqual([bundle]);
  expect(JSON.parse(window.localStorage.getItem(localKey("B"))!)).toEqual([gift]);
});

it("un guardado iniciado antes de A→B→A no altera la sesión restaurada", async () => {
  const pendingSave = deferred<BundlePack>();
  rows("A:admin").set(bundle.id, shared());
  const { result, rerender } = renderPacks();
  await waitFor(() => expect(result.current.canManageBundles).toBe(true));
  mockApi.updateBundlePromo.mockReturnValueOnce(pendingSave.promise);
  let saved!: Promise<boolean>;
  act(() => { saved = result.current.updatePack(bundle.id, { ...bundle, name: "Obsoleto" }); });
  session("B", "other", false); rerender();
  session(); rerender();
  await waitFor(() => expect(result.current.packs).toEqual([shared()]));
  await act(async () => pendingSave.resolve(shared({ ...bundle, name: "Obsoleto" })));
  expect(await saved).toBe(false);
  expect(result.current.packs).toEqual([shared()]);
});

it("un vendedor no puede crear, editar, activar ni eliminar bundles", async () => {
  session("A", "seller", false); rows("A:seller").set(bundle.id, shared());
  const { result } = renderPacks();
  await waitFor(() => expect(result.current.packs).toHaveLength(1));
  await act(async () => {
    expect(await result.current.addPack(bundle)).toBe(false);
    expect(await result.current.updatePack(bundle.id, bundle)).toBe(false);
    await result.current.togglePack(bundle.id);
    expect(await result.current.deletePack(bundle.id)).toBe(false);
  });
  expect(mockApi.createBundlePromo).not.toHaveBeenCalled();
  expect(mockApi.updateBundlePromo).not.toHaveBeenCalled();
  expect(mockApi.deleteBundlePromo).not.toHaveBeenCalled();
});

it("si falla el respaldo no importa ni borra los bundles de origen", async () => {
  window.localStorage.setItem(variantKey(), JSON.stringify([bundle]));
  const setItem = Storage.prototype.setItem;
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
    if (key === backupKey()) throw new DOMException("Quota", "QuotaExceededError");
    setItem.call(this, key, value);
  });
  const { result } = renderPacks();
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(mockApi.importBundlePromos).not.toHaveBeenCalled();
  expect(JSON.parse(window.localStorage.getItem(variantKey())!)).toEqual([bundle]);
});


it("el vendedor suprime una copia local cuando recibe el tombstone del servidor", async () => {
  session("A", "seller", false);
  rows("A:seller").set(bundle.id, null);
  window.localStorage.setItem(variantKey(), JSON.stringify([bundle]));
  const { result } = renderPacks();
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.packs).toEqual([]);
  expect(JSON.parse(window.localStorage.getItem(variantKey())!)).toEqual([bundle]);
  expect(mockApi.importBundlePromos).not.toHaveBeenCalled();
});

it("una nueva sesión idéntica invalida el import anterior e inicia una carga que termina", async () => {
  window.localStorage.setItem(variantKey(), JSON.stringify([bundle]));
  const imported = deferred<{ acceptedIds: string[]; bundles: BundlePack[] }>();
  mockApi.importBundlePromos.mockReturnValueOnce(imported.promise);
  const { result, rerender } = renderPacks();
  await waitFor(() => expect(mockApi.importBundlePromos).toHaveBeenCalledTimes(1));
  const newRemote = shared({ ...bundle, name: "Nueva sesión" });
  rows("A:admin").set(bundle.id, newRemote);
  mockApi.getBundleCapabilities.mockResolvedValue({ canManage: false });
  tokenStore.invalidate(); tokenStore.set("A:admin", "A:owner");
  rerender();
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => imported.resolve({ acceptedIds: [bundle.id], bundles: [shared()] }));
  expect(result.current.packs).toEqual([newRemote]);
  expect(mockApi.listBundlePromos).toHaveBeenCalledTimes(2);
  expect(JSON.parse(window.localStorage.getItem(variantKey())!)).toEqual([bundle]);
});

it("relee el origen de otra pestaña y divide más de 100 bundles en lotes", async () => {
  const { result } = renderPacks();
  await waitFor(() => expect(result.current.loading).toBe(false));
  const many = Array.from({ length: 101 }, (_, i) => ({ ...bundle, id: `bundle-${i}` }));
  window.localStorage.setItem(variantKey(), JSON.stringify(many));
  fireEvent(window, new StorageEvent("storage", { key: variantKey() }));
  await waitFor(() => expect(result.current.packs).toHaveLength(101));
  expect(mockApi.importBundlePromos.mock.calls.map(([packs]) => packs.length)).toEqual([100, 1]);
  expect(JSON.parse(window.localStorage.getItem(backupKey())!)).toHaveLength(101);
});


it("un bundle con referencia borrada no bloquea la importación de los demás", async () => {
  const invalid = { ...bundle, id: "bundle-missing" };
  window.localStorage.setItem(variantKey(), JSON.stringify([bundle, invalid]));
  const importValid = mockApi.importBundlePromos.getMockImplementation()!;
  mockApi.importBundlePromos.mockImplementation(async (packs, token) => {
    if (packs.some((pack) => pack.id === invalid.id)) throw { response: { status: 400 } };
    return importValid(packs, token);
  });
  const { result } = renderPacks();
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(JSON.parse(window.localStorage.getItem(variantKey())!)).toEqual([invalid]);
  expect(rows("A:admin").get(bundle.id)).toEqual(shared());
  expect(result.current.packs).toEqual([invalid, shared()]);
  expect(JSON.parse(window.localStorage.getItem(backupKey())!)).toEqual([bundle, invalid]);
});
