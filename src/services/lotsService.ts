import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { writeConfigArgs } from "@/lib/idempotency";

// FEAT-24 H5-L — lotes con vencimiento (fachada `/lots` de ms-products, JWT; la
// empresa y el usuario salen del token). Ver los lotes: cualquier rol menos
// COURIER (403). Editar o bloquear: Administrador u Operaciones. «Registrar
// lote»: Administrador, Operaciones o Almacén.
//
// Costo por rol: sin `canSeeCosts` la fachada OMITE `averageCost`, `value`,
// `withoutCost` y `unitsWithoutCost` (no los manda en 0). Por eso son
// opcionales: si la clave no está, la pantalla muestra «••••».

const products = () => process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products;
const lots = () => `${products()}/lots`;
const id = (value: string) => encodeURIComponent(value);

/** `vencido` no se guarda: se calcula al leer (vencimiento anterior a hoy en Lima). */
export type LotStatus = "vigente" | "vencido" | "bloqueado";
/** `devolucion`: el lote DEVOLUCION de la variante (sin vencimiento; se crea solo). */
export type LotKind = "normal" | "devolucion";

/** Una fila por lote × almacén con saldo (con `includeEmpty`, también los lotes sin saldo, sin almacén). */
export interface LotRow {
  lotId: string;
  number: string;
  kind: LotKind | string;
  variantId: string;
  /** YYYY-MM-DD (null en el lote DEVOLUCION). */
  expiresAt: string | null;
  daysToExpiry: number | null;
  status: LotStatus;
  /** Lo guardado: `vigente` o `bloqueado`. */
  storedStatus: "vigente" | "bloqueado" | string;
  comment: string | null;
  inventoryId: string | null;
  inventoryName: string | null;
  quantity: number;
  createdAt?: string;
  updatedAt?: string;
  updatedByEmail?: string | null;
  updatedByName?: string | null;
}

/** Lo «sin lote» por almacén (con `variantId`, también el stock de los ítems que todavía no llevan lotes). */
export interface UnlottedRow {
  variantId: string;
  inventoryId: string;
  inventoryName: string | null;
  quantity: number;
}

export interface LotList {
  /** Hoy en Lima (YYYY-MM-DD), según el servidor. */
  today: string | null;
  items: LotRow[];
  unlotted: UnlottedRow[];
  /** Había más de 2000 filas y se cortó. */
  truncated: boolean;
}

export interface LotListFilters {
  variantId?: string;
  inventoryId?: string;
  status?: LotStatus;
  expiringInDays?: number;
  includeEmpty?: boolean;
}

export interface LotDetail {
  lotId: string;
  number: string;
  kind: LotKind | string;
  variantId: string;
  expiresAt: string | null;
  daysToExpiry: number | null;
  status: LotStatus;
  storedStatus: string;
  comment: string | null;
  quantity: number;
  warehouses: Array<{ inventoryId: string; inventoryName: string | null; quantity: number }>;
}

export interface UpdateLotBody {
  number?: string;
  /** YYYY-MM-DD. */
  expiresAt?: string;
  /** `null` lo borra. */
  comment?: string | null;
  status?: "vigente" | "bloqueado";
}

/** «Registrar lote»: pasa `quantity` unidades «sin lote» a un lote existente (`lotId`) o nuevo (número + vencimiento). */
export interface AssignLotBody {
  inventoryId: string;
  variantId: string;
  quantity: number;
  lotId?: string;
  lotNumber?: string;
  expiresAt?: string;
  comment?: string;
  operationId: string;
}

export interface AssignLotResult {
  lot: LotDetail;
  movementId: string | null;
  duplicate: boolean;
}

/** Fila de «Vencimiento en dinero» y de las alertas de lotes (H10). */
export interface ExpiringLotRow {
  lotId: string;
  lotNumber: string;
  variantId: string;
  inventoryId: string;
  inventoryName: string | null;
  expiresAt: string | null;
  daysToExpiry: number | null;
  status: LotStatus;
  quantity: number;
  /** Sin rol de costos no vienen. `null` = la variante no tiene costo. */
  averageCost?: number | null;
  value?: number | null;
}

export interface ExpiringTotals {
  lots: number;
  units: number;
  /** Sin rol de costos no vienen. */
  value?: number;
  withoutCost?: { lots: number; units: number };
}

export interface ExpiringLots {
  today: string | null;
  days: number;
  /** Días de aviso de la empresa (reglas de inventario). */
  alertDays: number;
  items: ExpiringLotRow[];
  truncated: boolean;
  totals: { expired: ExpiringTotals; withinAlert: ExpiringTotals; later: ExpiringTotals; all: ExpiringTotals };
  /** Mermas por vencimiento del mes en curso y los 3 anteriores (Lima). */
  lostByExpiry: Array<{ period: string; units: number; value?: number; unitsWithoutCost?: number }>;
}

const EMPTY_TOTALS: ExpiringTotals = { lots: 0, units: 0 };

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

export async function listLots(filters: LotListFilters, signal?: AbortSignal): Promise<LotList> {
  const params = Object.fromEntries(
    Object.entries({
      variantId: filters.variantId,
      inventoryId: filters.inventoryId,
      status: filters.status,
      expiringInDays: filters.expiringInDays,
      includeEmpty: filters.includeEmpty ? "true" : undefined,
    }).filter(([, value]) => value !== undefined && value !== ""),
  );
  const { data } = await axiosAuth.get<Partial<LotList>>(lots(), { params, signal });
  return {
    today: typeof data?.today === "string" ? data.today : null,
    items: asArray<LotRow>(data?.items),
    unlotted: asArray<UnlottedRow>(data?.unlotted),
    truncated: data?.truncated === true,
  };
}

export async function getLot(lotId: string, signal?: AbortSignal): Promise<LotDetail> {
  const { data } = await axiosAuth.get<LotDetail>(`${lots()}/${id(lotId)}`, { signal });
  return data;
}

/** Solo Administrador u Operaciones (403 al resto). Número repetido en la variante → 409. */
export async function updateLot(lotId: string, body: UpdateLotBody): Promise<LotDetail> {
  const { data } = await axiosAuth.put<LotDetail>(`${lots()}/${id(lotId)}`, body);
  return data;
}

/** Administrador, Operaciones o Almacén. Repetir con el mismo `operationId` devuelve el registrado (`duplicate`). */
export async function assignLot(body: AssignLotBody): Promise<AssignLotResult> {
  const { data } = await axiosAuth.post<AssignLotResult>(`${lots()}/assign`, body, ...writeConfigArgs({ idempotencyKey: body.operationId }));
  return data;
}

/** «Vencimiento en dinero»: lotes con stock que vencen en `days` días o menos (y los vencidos). */
export async function getExpiringLots(filters: { days?: number; inventoryId?: string } = {}, signal?: AbortSignal): Promise<ExpiringLots> {
  const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ""));
  const { data } = await axiosAuth.get<Partial<ExpiringLots>>(`${lots()}/expiring`, { params, signal });
  const totals = (data?.totals ?? {}) as Partial<ExpiringLots["totals"]>;
  return {
    today: typeof data?.today === "string" ? data.today : null,
    days: typeof data?.days === "number" ? data.days : filters.days ?? 90,
    alertDays: typeof data?.alertDays === "number" ? data.alertDays : 30,
    items: asArray<ExpiringLotRow>(data?.items),
    truncated: data?.truncated === true,
    totals: {
      expired: totals.expired ?? EMPTY_TOTALS,
      withinAlert: totals.withinAlert ?? EMPTY_TOTALS,
      later: totals.later ?? EMPTY_TOTALS,
      all: totals.all ?? EMPTY_TOTALS,
    },
    lostByExpiry: asArray<ExpiringLots["lostByExpiry"][number]>(data?.lostByExpiry),
  };
}
