import axiosAuth from "@/lib/axiosAuth";
import { createBundlePromo, importBundlePromos, listBundlePromos, updateBundlePromo } from "../bundlePromos.service";
import type { BundlePack } from "@/interfaces/IPack";
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));
const bundle: BundlePack = { id: "bundle", type: "BUNDLE", name: "Combo", active: true, channels: ["WHATSAPP"], items: [{ productKey: "A", productName: "A", price: 10 }], packPrice: 8 };
beforeEach(() => jest.clearAllMocks());
it("lista por sesión y marca shared separado de synced para no enviar FK Promo al guardar cotización", async () => {
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: { bundles: [{ ...bundle, packPrice: "8.00" }], deletedIds: ["deleted"] } });
  expect(await listBundlePromos("session-A")).toEqual({ bundles: [{ ...bundle, shared: true, synced: false }], deletedIds: ["deleted"] });
  expect(axiosAuth.get).toHaveBeenCalledWith(expect.stringMatching(/\/bundle-promos$/), { headers: { Authorization: "Bearer session-A" } });
});
it("create/import no envían metadatos ni una empresa controlada por el cliente", async () => {
  const client = { ...bundle, shared: true, synced: true, companyId: "foreign-company" } as BundlePack;
  jest.mocked(axiosAuth.post).mockResolvedValueOnce({ data: bundle }).mockResolvedValueOnce({ data: { acceptedIds: [bundle.id], bundles: [bundle] } });
  await createBundlePromo(client);
  const result = await importBundlePromos([client]);
  expect(jest.mocked(axiosAuth.post).mock.calls[0][1]).toEqual(bundle);
  expect(jest.mocked(axiosAuth.post).mock.calls[1][1]).toEqual({ bundles: [bundle] });
  expect(result.bundles[0]).toMatchObject({ shared: true, synced: false });
});
it("patch usa el ID de la ruta y omite id/type del cuerpo", async () => {
  jest.mocked(axiosAuth.patch).mockResolvedValue({ data: bundle });
  await updateBundlePromo("bundle/a", bundle);
  const { id: _id, type: _type, ...fields } = bundle;
  expect(axiosAuth.patch).toHaveBeenCalledWith(expect.stringMatching(/\/bundle-promos\/bundle%2Fa$/), fields, undefined);
});
