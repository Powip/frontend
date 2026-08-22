/* -----------------------------------------------------------------------
   Helpers compartidos por los servicios mock de /superadmin.

   Los servicios de esta carpeta simulan la forma de respuesta que define
   la especificación (paginación page/page_size, meta.total) para que,
   cuando el backend (Marco) exponga /api/v1/*, solo haya que reemplazar
   el cuerpo de cada función por un axios.get real — la firma y el shape
   de retorno ya quedan listos.
------------------------------------------------------------------------ */

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PagedResponse<T> {
  data: T[];
  meta: PageMeta;
}

export interface PageParams {
  page?: number;
  pageSize?: number;
}

/** Simula latencia de red para que loading states sean visibles en la UI. */
export function mockDelay<T>(value: T, ms = 260): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function paginate<T>(items: T[], { page = 1, pageSize = 10 }: PageParams): PagedResponse<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    data: items.slice(start, start + pageSize),
    meta: { page: safePage, pageSize, total, totalPages },
  };
}

export function matchesQuery(haystack: (string | undefined)[], query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return haystack.some((h) => h?.toLowerCase().includes(q));
}
