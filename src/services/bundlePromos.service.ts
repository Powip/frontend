import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type { BundlePack } from "@/interfaces/IPack";

const BASE = `${GATEWAY.ventas}/bundle-promos`;
const sessionOptions = (token?: string) => token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;

/** Company and management grants are resolved by the server from the session. */
export async function getBundleCapabilities(token?: string): Promise<{ canManage: boolean }> {
  const { data } = await axiosAuth.get<{ canManage: boolean }>(`${BASE}/capabilities`, sessionOptions(token));
  return data;
}

function fromApi(pack: BundlePack): BundlePack {
  return { ...pack, type: "BUNDLE", packPrice: Number(pack.packPrice), shared: true, synced: false };
}

/** Keep session/company metadata out of client-controlled writes. */
function payload(pack: BundlePack) {
  return {
    id: pack.id,
    type: "BUNDLE" as const,
    name: pack.name,
    active: pack.active,
    channels: pack.channels,
    items: pack.items,
    packPrice: pack.packPrice,
    ...(pack.schemaVersion === 2 ? { schemaVersion: 2 as const } : {}),
  };
}

export async function listBundlePromos(token?: string): Promise<{ bundles: BundlePack[]; deletedIds: string[] }> {
  const { data } = await axiosAuth.get<{ bundles: BundlePack[]; deletedIds: string[] }>(BASE, sessionOptions(token));
  return { bundles: data.bundles.map(fromApi), deletedIds: data.deletedIds };
}

export async function importBundlePromos(bundles: BundlePack[], token?: string): Promise<{
  acceptedIds: string[];
  bundles: BundlePack[];
}> {
  const { data } = await axiosAuth.post<{ acceptedIds: string[]; bundles: BundlePack[] }>(
    `${BASE}/import`,
    { bundles: bundles.map(payload) },
    sessionOptions(token),
  );
  return { acceptedIds: data.acceptedIds, bundles: data.bundles.map(fromApi) };
}

export async function createBundlePromo(pack: BundlePack, token?: string): Promise<BundlePack> {
  const { data } = await axiosAuth.post<BundlePack>(BASE, payload(pack), sessionOptions(token));
  return fromApi(data);
}

export async function updateBundlePromo(id: string, pack: BundlePack, token?: string): Promise<BundlePack> {
  const { id: _id, type: _type, ...changes } = payload(pack);
  const { data } = await axiosAuth.patch<BundlePack>(`${BASE}/${encodeURIComponent(id)}`, changes, sessionOptions(token));
  return fromApi(data);
}

export async function deleteBundlePromo(id: string, token?: string): Promise<void> {
  await axiosAuth.delete(`${BASE}/${encodeURIComponent(id)}`, sessionOptions(token));
}
