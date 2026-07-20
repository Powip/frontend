import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { getProducts } from "@/api/Productos";
import { VolumePack } from "@/interfaces/IPack";

/* -----------------------------------------
   Promos API — CRUD real (ver doc "endpoint Promos.pdf").
   Cuelga del microservicio de ventas (GATEWAY.ventas + /promos), no de uno propio.
   Por ahora el backend solo confirma el tipo VOLUME; BUNDLE y GIFT
   siguen viviendo en PacksContext como packs locales (localStorage).
----------------------------------------- */

const BASE = `${GATEWAY.ventas}/promos`;

interface ApiPromo {
  id: string;
  companyId: string;
  name: string;
  type: string;
  productId?: string;
  minQty?: number;
  maxQty?: number | null;
  packPrice?: number;
  channels?: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateVolumePromoPayload {
  companyId: string;
  name: string;
  type: "VOLUME";
  productId: string;
  minQty: number;
  maxQty?: number;
  packPrice: number;
  /** string[] a propósito — ver PROMO_CHANNELS en IPack.ts para los valores que hoy acepta el backend */
  channels: string[];
}

export type UpdateVolumePromoPayload = Partial<
  Omit<CreateVolumePromoPayload, "companyId" | "type">
> & { isActive?: boolean };

async function getPromoDetail(id: string): Promise<ApiPromo> {
  const { data } = await axiosAuth.get<ApiPromo>(`${BASE}/${id}`);
  return data;
}

/**
 * Trae los packs de Volumen reales del backend, resolviendo nombre y precio
 * del producto contra ms-products (la Promos API solo guarda el productId).
 */
export async function listVolumePromos(params: {
  companyId: string;
  isActive?: boolean;
}): Promise<VolumePack[]> {
  const query = new URLSearchParams({
    companyId: params.companyId,
    type: "VOLUME",
  });
  if (params.isActive !== undefined) {
    query.append("isActive", String(params.isActive));
  }

  const { data: list } = await axiosAuth.get<ApiPromo[]>(`${BASE}?${query}`);
  if (!list.length) return [];

  // El listado puede venir resumido (id/name/type/isActive). Si falta algún
  // campo necesario para operar el pack, se completa con el detalle por id.
  const needsDetail = list.some(
    (p) =>
      p.productId === undefined ||
      p.minQty === undefined ||
      p.packPrice === undefined,
  );
  const full = needsDetail
    ? await Promise.all(list.map((p) => getPromoDetail(p.id)))
    : list;

  // No se manda companyId: mismo problema que en useProductCatalog
  // (packs-promos/page.tsx) — el backend devuelve 500 con ese filtro.
  const products = await getProducts().catch(() => []);
  const productById = new Map(products.map((p) => [p.id, p]));

  return full.map((p) => mapToVolumePack(p, productById));
}

export async function createVolumePromo(
  payload: CreateVolumePromoPayload,
): Promise<ApiPromo> {
  const { data } = await axiosAuth.post<ApiPromo>(BASE, payload);
  return data;
}

export async function updatePromo(
  id: string,
  payload: UpdateVolumePromoPayload,
): Promise<{ message: string }> {
  const { data } = await axiosAuth.patch(`${BASE}/${id}`, payload);
  return data;
}

export async function deletePromo(id: string): Promise<{ message: string }> {
  const { data } = await axiosAuth.delete(`${BASE}/${id}`);
  return data;
}

function mapToVolumePack(
  p: ApiPromo,
  productById: Map<string, { name: string; priceVta: number }>,
): VolumePack {
  const product = p.productId ? productById.get(p.productId) : undefined;
  return {
    id: p.id,
    companyId: p.companyId,
    type: "VOLUME",
    name: p.name,
    active: p.isActive,
    channels: p.channels ?? [],
    product: {
      productId: p.productId,
      productKey: product?.name ?? p.productId ?? "",
      productName: product?.name ?? "Producto no encontrado",
      price: product?.priceVta ?? 0,
    },
    // La API real todavía no confirma "variantes libres" (PVS); hasta que exista
    // el campo, todo pack sincronizado se trata como variante fija.
    variantFree: false,
    minQty: p.minQty ?? 2,
    maxQty: p.maxQty ?? null,
    packPrice: p.packPrice ?? 0,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    synced: true,
  };
}
