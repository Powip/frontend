"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Plus,
  RefreshCw,
  Settings2,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  commercialLeadError,
  getCommercialLeadCapabilities,
  getCommercialLeadConfirmationCapabilities,
  listCommercialLeads,
  listCommercialLeadTypes,
} from "@/services/commercialLeadsService";
import type {
  LeadCapabilities,
  LeadConfirmationCapabilities,
  LeadListParams,
  LeadListResponse,
  LeadStatus,
  LeadType,
} from "@/types/leads";
import LeadContactForm from "./LeadContactForm";
import LeadDetailPanel from "./LeadDetailPanel";
import LeadTypeCatalog from "./LeadTypeCatalog";
import { LEAD_STATUS_LABELS, leadDate, leadMoney } from "./lead-ui";

const EMPTY: LeadListResponse = { items: [], total: 0, page: 1, limit: 25 };
const control = "w-full rounded-md border bg-background px-3 py-2 text-sm";
interface Props {
  companyId: string;
  selectedStoreId: string | null;
  stores: Array<{ id: string; name: string }>;
}
function ScopedWorkspace({ companyId, selectedStoreId, stores }: Props) {
  const params = useSearchParams();
  const [capabilities, setCapabilities] = useState<LeadCapabilities | null>(
      null,
    ),
    [confirmation, setConfirmation] =
      useState<LeadConfirmationCapabilities | null>(null);
  const [types, setTypes] = useState<LeadType[]>([]),
    [result, setResult] = useState<LeadListResponse>(EMPTY);
  const [loading, setLoading] = useState(true),
    [accessLoading, setAccessLoading] = useState(true),
    [error, setError] = useState("");
  const [filters, setFilters] = useState<LeadListParams>({
    storeId: selectedStoreId ?? undefined,
    statusGroup: "OPEN",
    page: 1,
    limit: 25,
  });
  const [search, setSearch] = useState(""),
    [channelFilter, setChannelFilter] = useState(""),
    [active, setActive] = useState<string | null>(null),
    [creating, setCreating] = useState(false),
    [catalog, setCatalog] = useState(false),
    [revision, setRevision] = useState(0);
  const [accessRevision, setAccessRevision] = useState(0);
  const [catalogError, setCatalogError] = useState("");
  const accessRequest = useRef(0),
    listRequest = useRef(0),
    typesRequest = useRef(0);
  useEffect(() => {
    const current = ++accessRequest.current;
    setAccessLoading(true);
    setCapabilities(null);
    setConfirmation(null);
    setError("");
    getCommercialLeadCapabilities()
      .then(async (caps) => {
        if (current !== accessRequest.current) return;
        setCapabilities(caps);
        if (caps.enabled && caps.canView) {
          try {
            const confirmationCaps =
              await getCommercialLeadConfirmationCapabilities();
            if (current === accessRequest.current)
              setConfirmation(confirmationCaps);
          } catch {
            if (current === accessRequest.current) setConfirmation(null);
          }
        }
      })
      .catch((failure) => {
        if (current === accessRequest.current)
          setError(commercialLeadError(failure));
      })
      .finally(() => {
        if (current === accessRequest.current) setAccessLoading(false);
      });
    return () => {
      ++accessRequest.current;
    };
  }, [companyId, accessRevision]);
  useEffect(() => {
    setFilters({
      storeId: selectedStoreId ?? undefined,
      statusGroup: "OPEN",
      page: 1,
      limit: 25,
    });
    setSearch("");
    setChannelFilter("");
    setResult(EMPTY);
    setActive(null);
    setCreating(false);
    setCatalog(false);
  }, [selectedStoreId]);
  const linkedId = params.get("leadId");
  useEffect(() => {
    if (capabilities?.enabled && capabilities.canView && linkedId)
      setActive(linkedId);
  }, [linkedId, companyId, capabilities?.enabled, capabilities?.canView]);
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setFilters((previous) =>
          previous.search === (search.trim() || undefined) &&
          previous.initialChannel === (channelFilter.trim() || undefined)
            ? previous
            : {
                ...previous,
                search: search.trim() || undefined,
                initialChannel: channelFilter.trim() || undefined,
                page: 1,
              },
        ),
      300,
    );
    return () => clearTimeout(timer);
  }, [search, channelFilter]);
  const refreshTypes = useCallback(async () => {
    if (
      !capabilities?.enabled ||
      (!capabilities.canView && !capabilities.canManageTypes)
    )
      return;
    const current = ++typesRequest.current;
    try {
      const catalogTypes = await listCommercialLeadTypes();
      if (current === typesRequest.current) {
        setTypes(catalogTypes);
        setCatalogError("");
      }
    } catch (failure) {
      if (current === typesRequest.current)
        setCatalogError(commercialLeadError(failure));
    }
  }, [capabilities]);
  useEffect(() => {
    void refreshTypes();
    return () => {
      ++typesRequest.current;
    };
  }, [refreshTypes]);
  const reload = useCallback(async () => {
    const current = ++listRequest.current;
    if (!capabilities?.enabled || !capabilities.canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await listCommercialLeads(filters);
      if (current !== listRequest.current) return;
      // The server owns company scope; discard an unexpected cross-company projection.
      if (data.items.some((lead) => lead.companyId !== companyId))
        throw new Error("La respuesta de Leads no corresponde a este negocio.");
      setResult(data);
      if ((filters.page ?? 1) > 1 && !data.items.length)
        setFilters((previous) => ({
          ...previous,
          page: Math.max(1, Math.ceil(data.total / (previous.limit ?? 25))),
        }));
    } catch (failure) {
      if (current === listRequest.current) {
        setResult(EMPTY);
        setError(commercialLeadError(failure));
      }
    } finally {
      if (current === listRequest.current) setLoading(false);
    }
  }, [capabilities, filters, companyId]);
  useEffect(() => {
    void reload();
    return () => {
      ++listRequest.current;
    };
  }, [reload, revision]);
  const changeFilter = (key: keyof LeadListParams, value: string) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value || undefined,
      page: 1,
    }));
    setResult(EMPTY);
  };
  const changeStatusFilter = (value: string) => {
    setFilters((previous) => ({
      ...previous,
      page: 1,
      status:
        value !== "OPEN" && value !== "CLOSED" && value !== "ALL"
          ? (value as LeadStatus)
          : undefined,
      statusGroup: value === "OPEN" || value === "CLOSED" ? value : undefined,
      followUp: ["CLOSED", "PERDIDO", "CONVERTIDO"].includes(value)
        ? undefined
        : previous.followUp,
    }));
    setResult(EMPTY);
  };
  const changeAssignmentFilter = (value: string) => {
    setFilters((previous) => ({
      ...previous,
      assignedSellerId: undefined,
      assignment: (value || undefined) as LeadListParams["assignment"],
      page: 1,
    }));
    setResult(EMPTY);
  };
  const changeFollowUpFilter = (value: string) => {
    const onlyOpen = value !== "";
    setFilters((previous) => ({
      ...previous,
      followUp: (value || undefined) as LeadListParams["followUp"],
      status: onlyOpen ? undefined : previous.status,
      statusGroup: onlyOpen ? "OPEN" : previous.statusGroup,
      page: 1,
    }));
    setResult(EMPTY);
  };
  const refresh = () => setRevision((value) => value + 1);
  useEffect(() => {
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<{ companyId?: string }>).detail;
      if (detail?.companyId === companyId) setRevision((value) => value + 1);
    };
    window.addEventListener("commercial-leads:changed", changed);
    return () =>
      window.removeEventListener("commercial-leads:changed", changed);
  }, [companyId]);
  const totalPages = Math.max(
    1,
    Math.ceil(result.total / (filters.limit ?? 25)),
  );
  if (accessLoading)
    return (
      <div className="p-6" role="status">
        Consultando acceso a Leads…
      </div>
    );
  if (!capabilities || !capabilities.enabled)
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold">Leads comerciales</h1>
        <p className="text-sm text-muted-foreground">
          {error ||
            "El módulo de Leads todavía no está habilitado para este negocio."}
        </p>
        {error ? (
          <Button
            variant="outline"
            onClick={() => setAccessRevision((value) => value + 1)}
          >
            Reintentar acceso
          </Button>
        ) : null}
        <Link className="text-sm underline" href="/ventas">
          Ir a ventas
        </Link>
      </div>
    );
  if (!capabilities.canView && !capabilities.canManageTypes)
    return (
      <div className="space-y-2 p-6">
        <h1 className="text-2xl font-semibold">Leads comerciales</h1>
        <p>No tienes permiso para consultar esta bandeja.</p>
      </div>
    );
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Users aria-hidden="true" className="h-6 w-6" />
            Leads comerciales
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Oportunidades de todos tus canales. La compra pasa a ventas cuando
            el vendedor la confirma; el prepago web aprobado entra como venta
            directa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {capabilities.canManageTypes ? (
            <Button variant="outline" onClick={() => setCatalog(true)}>
              <Settings2 aria-hidden="true" />
              Tipos de lead
            </Button>
          ) : null}
          {capabilities.canManage && capabilities.canView ? (
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              Nuevo Lead
            </Button>
          ) : null}
        </div>
      </header>
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}
      {catalogError ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 p-3 text-sm text-red-700"
        >
          {catalogError}
          <Button
            className="ml-2"
            size="sm"
            variant="outline"
            onClick={() => void refreshTypes()}
          >
            Reintentar catálogo
          </Button>
        </div>
      ) : null}
      {capabilities.canView ? (
        <>
          <section
            aria-label="Filtros de Leads"
            className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6"
          >
            <div className="sm:col-span-2 lg:col-span-2">
              <Label htmlFor="leads-search">Buscar contacto</Label>
              <Input
                id="leads-search"
                placeholder="Nombre, teléfono o correo"
                maxLength={100}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="leads-store-filter">Tienda</Label>
              <select
                id="leads-store-filter"
                className={control}
                value={filters.storeId ?? ""}
                onChange={(event) =>
                  changeFilter("storeId", event.target.value)
                }
              >
                <option value="">Todas las tiendas</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="leads-type-filter">Tipo de lead</Label>
              <select
                id="leads-type-filter"
                className={control}
                value={filters.typeCode ?? ""}
                onChange={(event) =>
                  changeFilter("typeCode", event.target.value)
                }
              >
                <option value="">Todos los tipos</option>
                {types.map((type) => (
                  <option key={type.code} value={type.code}>
                    {type.name}
                    {type.active ? "" : " (inactivo)"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="leads-status-filter">Estado comercial</Label>
              <select
                id="leads-status-filter"
                className={control}
                value={filters.status ?? filters.statusGroup ?? "ALL"}
                onChange={(event) => changeStatusFilter(event.target.value)}
              >
                <option value="OPEN">Abiertos</option>
                <option value="CLOSED">Cerrados</option>
                <option value="ALL">Todos los estados</option>
                {Object.entries(LEAD_STATUS_LABELS).map(([status, label]) => (
                  <option key={status} value={status}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                className="w-full"
                variant="outline"
                disabled={loading}
                onClick={refresh}
              >
                <RefreshCw aria-hidden="true" />
                Actualizar
              </Button>
            </div>
            <div>
              <Label htmlFor="leads-channel-filter">Canal de origen</Label>
              <Input
                id="leads-channel-filter"
                placeholder="WhatsApp, Instagram…"
                maxLength={100}
                value={channelFilter}
                onChange={(event) => setChannelFilter(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="leads-assignment-filter">Responsable</Label>
              <select
                id="leads-assignment-filter"
                className={control}
                value={filters.assignment ?? ""}
                onChange={(event) => changeAssignmentFilter(event.target.value)}
              >
                <option value="">Todos los responsables</option>
                <option value="MINE">Mis Leads</option>
                <option value="UNASSIGNED">Sin asignar</option>
              </select>
            </div>
            <div>
              <Label htmlFor="leads-follow-up-filter">Seguimiento</Label>
              <select
                id="leads-follow-up-filter"
                className={control}
                value={filters.followUp ?? ""}
                onChange={(event) => changeFollowUpFilter(event.target.value)}
              >
                <option value="">Todos los seguimientos</option>
                <option value="OVERDUE">Vencido (abiertos)</option>
                <option value="TODAY">Hoy (abiertos)</option>
                <option value="UPCOMING">Próximo (abiertos)</option>
                <option value="NONE">Sin fecha (abiertos)</option>
              </select>
            </div>
            <div>
              <Label htmlFor="leads-date-from">Recibido desde</Label>
              <Input
                id="leads-date-from"
                type="date"
                value={filters.fromDate ?? ""}
                max={filters.toDate}
                onChange={(event) =>
                  changeFilter("fromDate", event.target.value)
                }
              />
            </div>
            <div>
              <Label htmlFor="leads-date-to">Recibido hasta</Label>
              <Input
                id="leads-date-to"
                type="date"
                value={filters.toDate ?? ""}
                min={filters.fromDate}
                onChange={(event) => changeFilter("toDate", event.target.value)}
              />
            </div>
          </section>
          <section
            className="overflow-hidden rounded-xl border bg-card"
            aria-label="Bandeja de Leads"
          >
            <div className="flex items-center justify-between gap-2 border-b p-4">
              <h2 className="font-medium">
                {error ? (
                  "Bandeja pendiente de actualizar"
                ) : (
                  <>
                    {result.total}{" "}
                    {result.total === 1 ? "oportunidad" : "oportunidades"}
                  </>
                )}
              </h2>
              <p className="text-xs text-muted-foreground">
                Los importes estimados no son ventas ni cobros.
              </p>
            </div>
            {loading ? (
              <p className="p-6 text-sm" role="status">
                Cargando oportunidades…
              </p>
            ) : error ? (
              <p className="p-6 text-sm">
                No se pudo consultar la bandeja. Usa Actualizar para volver a
                cargarla.
              </p>
            ) : result.items.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">
                    Leads comerciales del negocio
                  </caption>
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="p-4">Contacto</th>
                      <th className="p-4">Tipo</th>
                      <th className="p-4">Estado</th>
                      <th className="p-4">Estimado</th>
                      <th className="p-4">Próxima acción</th>
                      <th className="p-4">Recibido</th>
                      <th className="p-4">
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((lead) => (
                      <tr
                        key={lead.id}
                        className="border-t align-top hover:bg-muted/20"
                      >
                        <td className="p-4">
                          <button
                            className="text-left font-medium underline-offset-4 hover:underline"
                            onClick={() => setActive(lead.id)}
                          >
                            {lead.contactName ||
                              lead.contactPhone ||
                              lead.contactEmail ||
                              "Contacto por completar"}
                          </button>
                          <p className="text-xs text-muted-foreground">
                            {lead.contactPhone ||
                              lead.contactEmail ||
                              "Sin teléfono o correo"}
                          </p>
                        </td>
                        <td className="p-4">
                          {lead.type?.name ??
                            types.find((type) => type.code === lead.typeCode)
                              ?.name ??
                            lead.typeCode}
                        </td>
                        <td className="p-4">
                          <span className="whitespace-nowrap rounded-full bg-muted px-2.5 py-1 text-xs">
                            {LEAD_STATUS_LABELS[lead.status]}
                          </span>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          {leadMoney(lead.estimatedAmount, lead.currency)}
                        </td>
                        <td className="p-4">
                          {lead.nextActionAt
                            ? leadDate(lead.nextActionAt)
                            : "Sin programar"}
                        </td>
                        <td className="p-4 text-xs">
                          {leadDate(lead.receivedAt)}
                        </td>
                        <td className="p-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Abrir Lead ${lead.contactName || lead.contactPhone || lead.id}`}
                            onClick={() => setActive(lead.id)}
                          >
                            Ver
                            <ArrowRight aria-hidden="true" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-2 p-8 text-center">
                <Users
                  aria-hidden="true"
                  className="mx-auto h-8 w-8 text-muted-foreground"
                />
                <h3 className="font-medium">No hay Leads para estos filtros</h3>
                <p className="text-sm text-muted-foreground">
                  Prueba otro periodo o tipo de lead.
                </p>
              </div>
            )}
            {!error ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
                <label className="flex items-center gap-2 text-sm">
                  Por página
                  <select
                    className="rounded-md border bg-background p-1"
                    aria-label="Leads por página"
                    value={filters.limit ?? 25}
                    onChange={(event) => {
                      setFilters((previous) => ({
                        ...previous,
                        limit: Number(event.target.value),
                        page: 1,
                      }));
                      setResult(EMPTY);
                    }}
                  >
                    {[25, 50, 100].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loading || (filters.page ?? 1) <= 1}
                    onClick={() =>
                      setFilters((previous) => ({
                        ...previous,
                        page: (previous.page ?? 1) - 1,
                      }))
                    }
                  >
                    Anterior
                  </Button>
                  <span className="text-sm">
                    Página {filters.page ?? 1} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loading || (filters.page ?? 1) >= totalPages}
                    onClick={() =>
                      setFilters((previous) => ({
                        ...previous,
                        page: (previous.page ?? 1) + 1,
                      }))
                    }
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        </>
      ) : (
        <p className="rounded-md border p-4 text-sm">
          Puedes administrar tipos; la lectura de contactos requiere permiso
          para ver Leads.
        </p>
      )}
      {creating ? (
        <Dialog open onOpenChange={setCreating}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nuevo Lead</DialogTitle>
              <DialogDescription>
                Registra el contacto y su origen. Puedes completar el pedido al
                confirmar su compra.
              </DialogDescription>
            </DialogHeader>
            {types.some((type) => type.active) ? (
              <LeadContactForm
                types={types}
                stores={stores}
                defaultStoreId={filters.storeId}
                onCancel={() => setCreating(false)}
                onSaved={(lead) => {
                  setCreating(false);
                  setActive(lead.id);
                  refresh();
                }}
              />
            ) : (
              <p className="text-sm">
                No hay tipos activos. Configura el catálogo antes de registrar
                un Lead.
              </p>
            )}
          </DialogContent>
        </Dialog>
      ) : null}
      {catalog ? (
        <Dialog open onOpenChange={setCatalog}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Tipos de lead</DialogTitle>
              <DialogDescription>
                Catálogo y campos propios de este negocio.
              </DialogDescription>
            </DialogHeader>
            <LeadTypeCatalog
              types={types}
              onChanged={() => void refreshTypes()}
            />
          </DialogContent>
        </Dialog>
      ) : null}
      {active && capabilities.canView ? (
        <LeadDetailPanel
          key={active}
          id={active}
          companyId={companyId}
          types={types}
          stores={stores}
          capabilities={capabilities}
          confirmationCapabilities={confirmation}
          onClose={() => setActive(null)}
          onChanged={refresh}
        />
      ) : null}
    </main>
  );
}
export default function CommercialLeadsWorkspace() {
  const { auth, loading, selectedStoreId } = useAuth();
  if (loading)
    return (
      <p className="p-6" role="status">
        Cargando sesión…
      </p>
    );
  if (!auth?.company?.id)
    return (
      <div className="space-y-2 p-6">
        <h1 className="text-2xl font-semibold">Leads comerciales</h1>
        <p>Selecciona un negocio para consultar sus Leads.</p>
      </div>
    );
  return (
    <ScopedWorkspace
      key={`${auth.user.id}:${auth.company.id}:${auth.user.role ?? ""}:${(auth.user.permissions ?? []).join(",")}`}
      companyId={auth.company.id}
      stores={auth.company.stores ?? []}
      selectedStoreId={selectedStoreId}
    />
  );
}
