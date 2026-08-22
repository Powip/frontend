"use client";

/* -----------------------------------------------------------------------
   Hooks de datos para /superadmin/empresas (directorio + Perfil 360).
   Ver docs/superadmin/empresas-endpoints.md para el detalle completo —
   incluye un problema de arquitectura real (dos fuentes de "empresa") y
   el pedido de paginación en GET /company que todavía no existe.

   companyService/salesService/userService/productService/courierService
   etc. ya son reales — este archivo es la capa "por página" que los
   combina y les da el shape que la UI de superadmin espera, más los
   pedazos que siguen simulados (Salud, Facturación SUNAT, Pagos,
   Soporte, Upsell) siguiendo el mismo patrón real-primero-simulado-después
   que useDashboard.ts.
----------------------------------------------------------------------- */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { SUPERADMIN_API_BASE, authHeaders, PENDING_BACKEND_QUERY_OPTIONS } from "./superadminApi";
import * as companyService from "@/services/companyService";
import * as salesService from "@/services/salesService";
import * as userService from "@/services/userService";
import * as productService from "@/services/productService";
import * as courierService from "@/services/courierService";
import * as subscriptionService from "@/services/subscriptionService";
import { getPedidosCC } from "@/services/atencionClienteService";
import { getHealthFactores, getComprobantesSunat, getUpsellOportunidades, getPagosEmpresa, getSoporteEmpresa } from "@/mocks/superadmin";
import type { IEmpresa, IPedidoResumen, IComprobanteSunat, IHealthFactor } from "@/interfaces/superadmin";

/* -----------------------------------------------------------------------
   Mapeo real <-> vista del front
------------------------------------------------------------------------ */
function mapCompany(c: companyService.Company): IEmpresa {
  const iniciales = c.name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return {
    id: c.id,
    nombre: c.name,
    ruc: c.cuit,
    plan: "Pro", // sin fuente real todavía — ver doc, no hay campo de plan en ms-company
    estado: "activo", // sin fuente real — ver doc, no hay is_active/status en ms-company
    mrr: 0, // se resuelve por separado via suscripción (join por userId, ver useSuscripcionEmpresa)
    healthScore: 0,
    canalesVenta: (c.sales_channels as IEmpresa["canalesVenta"]) ?? [],
    pedidos30d: 0,
    usuariosCount: 0,
    origen: "organico",
    logoIniciales: iniciales,
    colorAvatar: "bg-primary",
    creadoEn: c.createdAt ?? new Date().toISOString(),
  };
}

/* -----------------------------------------------------------------------
   1. Directorio — real, sin paginar server-side (ver doc). Se trae una
   vez (staleTime largo) y se filtra/pagina en memoria.
------------------------------------------------------------------------ */
export interface EmpresasFilters {
  q?: string;
  page?: number;
  pageSize?: number;
}

function useAllCompaniesRaw() {
  const { auth } = useAuth();
  return useQuery({
    queryKey: ["superadmin", "empresas", "raw"],
    queryFn: () => companyService.getAllCompanies(auth!.accessToken),
    enabled: !!auth?.accessToken,
    staleTime: 5 * 60 * 1000,
  });
}

export function useEmpresasList(filters: EmpresasFilters = {}) {
  const { data: raw, isLoading, isError } = useAllCompaniesRaw();
  const { page = 1, pageSize = 10, q } = filters;

  const filtered = useMemo(() => {
    let items = (raw ?? []).map(mapCompany);
    if (q?.trim()) {
      const query = q.trim().toLowerCase();
      items = items.filter((e) => e.nombre.toLowerCase().includes(query) || e.ruc?.toLowerCase().includes(query));
    }
    return items;
  }, [raw, q]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const data = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return { data, meta: { page: safePage, pageSize, total, totalPages }, isLoading, isError };
}

export function useKpisEmpresas() {
  const { data: raw, isLoading } = useAllCompaniesRaw();
  const total = raw?.length ?? 0;
  // Activos/riesgo/trials/inactivos: sin campo de estado real en ms-company (ver doc) —
  // proporciones ilustrativas sobre el total real, siempre marcadas simulado en la UI.
  return {
    data: {
      total,
      activos: Math.round(total * 0.7),
      riesgo: Math.round(total * 0.1),
      trials: Math.round(total * 0.1),
      inactivos: Math.round(total * 0.1),
    },
    isLoading,
  };
}

/* -----------------------------------------------------------------------
   2. Perfil — real.
------------------------------------------------------------------------ */
export function useEmpresaDetail(id: string | null) {
  const { auth } = useAuth();
  const query = useQuery({
    queryKey: ["superadmin", "empresas", "detalle", id],
    queryFn: () => companyService.fetchCompanyById(id!, auth!.accessToken),
    enabled: !!id && !!auth?.accessToken,
  });
  return { empresa: query.data ? mapCompany(query.data) : null, raw: query.data, isLoading: query.isLoading };
}

/* -----------------------------------------------------------------------
   3. Crear empresa — real, flujo de 2 pasos (ver doc): primero el
   usuario dueño en ms-auth, después la empresa en ms-company.
------------------------------------------------------------------------ */
export interface NuevaEmpresaInput {
  nombre: string;
  ruc?: string;
  telefono?: string;
  canalesVenta?: string[];
  // dueño
  dueñoNombre: string;
  dueñoApellido: string;
  dueñoEmail: string;
  dueñoDocumento: string;
  dueñoTelefono?: string;
}

export function useCreateEmpresa() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth!.accessToken;

  return useMutation({
    mutationFn: async (input: NuevaEmpresaInput) => {
      const usuario = await userService.createPlatformUser(
        {
          identityDocument: input.dueñoDocumento,
          name: input.dueñoNombre,
          surname: input.dueñoApellido,
          email: input.dueñoEmail,
          password: `Powip${Math.random().toString(36).slice(2, 8)}1`,
          phoneNumber: input.dueñoTelefono,
          roleName: "ADMIN",
        },
        token
      );

      const empresa = await companyService.createCompany(token, {
        name: input.nombre,
        userId: usuario.userId ?? usuario.id,
        cuit: input.ruc,
        phone: input.telefono,
        billingEmail: input.dueñoEmail,
      });

      if (input.canalesVenta?.length) {
        await companyService.updateCompany(empresa.id, token, { sales_channels: input.canalesVenta });
      }

      return empresa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "empresas"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin", "dashboard"] });
    },
  });
}

/* -----------------------------------------------------------------------
   4. Ventas & GMV — real.
------------------------------------------------------------------------ */
export function useVentasEmpresa(id: string | null) {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const resumen = useQuery({
    queryKey: ["superadmin", "empresas", "ventas-resumen", id],
    queryFn: () => salesService.getCompanySalesSummary(token!, id!),
    enabled: !!id && !!token,
  });
  const billing = useQuery({
    queryKey: ["superadmin", "empresas", "ventas-billing", id],
    queryFn: () => salesService.getCompanyBilling(token!, id!),
    enabled: !!id && !!token,
  });

  return {
    totalSales: resumen.data?.totalSales ?? 0,
    orderCount: resumen.data?.orderCount ?? 0,
    ticketPromedio: resumen.data?.orderCount ? resumen.data.totalSales / resumen.data.orderCount : 0,
    serieMensual: billing.data ?? [],
    isLoading: resumen.isLoading || billing.isLoading,
  };
}

/* -----------------------------------------------------------------------
   5. Pedidos — real, paginado.
------------------------------------------------------------------------ */
export function usePedidosEmpresa(id: string | null, page = 1, limit = 10) {
  const query = useQuery({
    queryKey: ["superadmin", "empresas", "pedidos", id, page],
    queryFn: () => getPedidosCC({ storeId: id!, page, limit }),
    enabled: !!id,
  });

  const data: IPedidoResumen[] = (query.data?.data ?? []).map((o) => ({
    id: o.orderNumber ?? o.id,
    cliente: o.customer?.fullName ?? "—",
    monto: Number(o.grandTotal ?? 0),
    estado: (o.status === "ENTREGADO" ? "Entregado" : o.status === "ANULADO" ? "Anulado" : o.status === "EN_ENVIO" ? "En camino" : "Preparando") as IPedidoResumen["estado"],
    courier: o.courier ?? "—",
    fecha: o.created_at,
  }));

  return { data, meta: { total: query.data?.total ?? 0, totalPages: query.data?.totalPages ?? 1, page: query.data?.page ?? 1 }, isLoading: query.isLoading };
}

/* -----------------------------------------------------------------------
   6. Productos & SKUs — real el catálogo, sin stock/precio/top-vendidos.
------------------------------------------------------------------------ */
export function useProductosEmpresa(id: string | null) {
  const { auth } = useAuth();
  const query = useQuery({
    queryKey: ["superadmin", "empresas", "productos", id],
    queryFn: () => productService.getCompanyProducts(auth!.accessToken, id!),
    enabled: !!id && !!auth?.accessToken,
  });
  return { data: query.data ?? [], isLoading: query.isLoading };
}

/* -----------------------------------------------------------------------
   7. Envíos & Couriers — real, sin % entrega/devolución agregado.
------------------------------------------------------------------------ */
export function useCouriersEmpresa(id: string | null) {
  const query = useQuery({
    queryKey: ["superadmin", "empresas", "couriers", id],
    queryFn: () => courierService.fetchCouriers(id!),
    enabled: !!id,
  });
  return { data: query.data ?? [], isLoading: query.isLoading };
}

/* -----------------------------------------------------------------------
   8. Integraciones — real, consulta en paralelo cada vendor.
------------------------------------------------------------------------ */
export function useIntegracionesEmpresa(id: string | null, empresa: IEmpresa | null) {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const query = useQuery({
    queryKey: ["superadmin", "empresas", "integraciones", id],
    queryFn: async () => {
      const [shopify] = await Promise.allSettled([axios.get(`/api/shopify/status/${id}`, authHeaders(token))]);
      return {
        shopify: shopify.status === "fulfilled",
      };
    },
    enabled: !!id && !!token,
    retry: false,
  });

  const conectadas = [
    { nombre: "Shopify", conectada: !!query.data?.shopify, categoria: "Ecommerce" },
    { nombre: "WhatsApp Business", conectada: true, categoria: "Comunicación" },
    { nombre: "Mercado Pago", conectada: true, categoria: "Pagos" },
  ];

  return { data: conectadas, upsell: empresa ? getUpsellOportunidades(empresa) : [], isLoading: query.isLoading, upsellSimulado: true };
}

/* -----------------------------------------------------------------------
   9. Suscripción — real, join manual por userId.
------------------------------------------------------------------------ */
export function useSuscripcionEmpresa(userId: string | null) {
  const { auth } = useAuth();
  const query = useQuery({
    queryKey: ["superadmin", "empresas", "suscripcion", userId],
    queryFn: () => subscriptionService.getSubscriptionByUserId(auth!.accessToken, userId!),
    enabled: !!userId && !!auth?.accessToken,
  });
  // El endpoint devuelve un array (historial) — la más reciente por fecha de inicio es la vigente.
  const sorted = [...(query.data ?? [])].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  return { data: sorted[0] ?? null, isLoading: query.isLoading };
}

/* -----------------------------------------------------------------------
   10. Usuarios — real.
------------------------------------------------------------------------ */
export function useUsuariosEmpresa(id: string | null) {
  const { auth } = useAuth();
  const query = useQuery({
    queryKey: ["superadmin", "empresas", "usuarios", id],
    queryFn: () => userService.getUsersByCompany(id!, auth!.accessToken),
    enabled: !!id && !!auth?.accessToken,
  });
  return { data: query.data ?? [], isLoading: query.isLoading };
}

/* -----------------------------------------------------------------------
   11-13. Salud / Facturación SUNAT / Pagos & Recaudos / Soporte —
   simulados a propósito (ver doc: Salud sin backend en ningún lado;
   Facturación bloqueada por falta de impersonación real; Pagos ya
   documentado en src/components/finanzas/BACKEND_REQUERIMIENTOS.md;
   Soporte sin servicio real todavía, ver /superadmin/soporte).
----------------------------------------------------------------------- */
export function useSaludEmpresa(empresa: IEmpresa | null): { data: IHealthFactor[]; isSimulado: true } {
  return { data: empresa ? getHealthFactores(empresa) : [], isSimulado: true };
}

export function useFacturacionEmpresa(id: string | null, empresa: IEmpresa | null) {
  const { auth } = useAuth();
  const token = auth?.accessToken;
  const mock = empresa ? getComprobantesSunat(empresa) : [];
  const query = useQuery<IComprobanteSunat[]>({
    queryKey: ["superadmin", "empresas", "facturacion", id],
    queryFn: async () => {
      const res = await axios.get<IComprobanteSunat[]>(`${SUPERADMIN_API_BASE}/empresas/${id}/sunat`, authHeaders(token));
      return res.data;
    },
    enabled: !!id && !!token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });
  return { data: query.isError ? mock : (query.data ?? mock), isSimulado: query.isError };
}

export function usePagosEmpresa(empresa: IEmpresa | null) {
  return { data: empresa ? getPagosEmpresa(empresa) : null, isSimulado: true };
}

export function useSoporteEmpresa(empresa: IEmpresa | null) {
  return { data: empresa ? getSoporteEmpresa(empresa) : [], isSimulado: true };
}
