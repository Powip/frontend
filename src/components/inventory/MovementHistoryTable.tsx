import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import type { BusinessInventory } from "@/services/inventoryCatalogService";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { fetchScopedInventoryMovements, filterInventoryMovements } from "@/services/inventoryMovementService";
import { resolveOrderNumbers } from "@/services/orderNumbersService";
import { describeMovement, formatPeruDateTime } from "./movementLabels";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, X, Calendar as CalendarIcon, Filter } from "lucide-react";

const ITEMS_PER_PAGE = 15;
// Columnas del mockup v6 (Historial): el vacío y el error ocupan todas.
const COLUMNS = 9;

/** Tipos que hoy escribe el backend (libro de stock de H1-B incluido), con el nombre del mockup. */
const MOVEMENT_TYPE_OPTIONS: Array<[string, string]> = [
  ["IN", "Ingreso"],
  ["OUT", "Egreso"],
  ["RESERVED", "Reserva"],
  ["RELEASED", "Liberación"],
  ["COMMITTED", "Venta entregada"],
  ["ADJUSTMENT", "Ajuste"],
  ["TRANSFER", "Traslado"],
  ["SALDO_INICIAL", "Saldo inicial"],
  ["ANULACION", "Anulación"],
];

interface MovementHistoryTableProps {
  companyId: string | undefined;
  scope?: "business" | "store";
  inventories?: BusinessInventory[];
  scopeReady?: boolean;
  scopeError?: Error | null;
  onRetryScope?: () => void;
  /** Texto con el que arranca el buscador (p. ej. el SKU al venir desde Stock). */
  initialSearch?: string;
  /** FEAT-24 H4: solo los movimientos de estos ítems de inventario (ficha del producto). */
  inventoryItemIds?: string[];
  /** FEAT-24 H4: título y bajada propios (la ficha dice «Historial (kardex)»). */
  title?: string;
  description?: string;
}

const NO_INVENTORIES: BusinessInventory[] = [];

export function MovementHistoryTable({ companyId, scope = "business", inventories = NO_INVENTORIES, scopeReady = true, scopeError, onRetryScope, initialSearch = "", inventoryItemIds, title, description }: MovementHistoryTableProps) {
  const { auth } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);

  // Filter states
  const [search, setSearch] = useState(initialSearch);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [inventoryFilter, setInventoryFilter] = useState<string>("ALL");
  const [userEmailFilter, setUserEmailFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const query = useQuery({
    queryKey: ["inventory-movement-history", companyId, auth?.user?.id, scope, scope === "store" ? inventories.map((inv) => inv.id).sort() : []],
    queryFn: ({ signal }) => fetchScopedInventoryMovements({ companyId: companyId ?? "", accessToken: auth?.accessToken ?? "", scope, inventories, signal }),
    enabled: Boolean(companyId && auth?.company?.id === companyId && auth?.accessToken && auth?.user?.id && (scope === "business" || scopeReady)) && !scopeError,
    retry: false,
  });
  const itemIdsKey = inventoryItemIds ? [...inventoryItemIds].sort().join(",") : null;
  const itemIdSet = useMemo(() => (itemIdsKey === null ? undefined : new Set(itemIdsKey ? itemIdsKey.split(",") : [])), [itemIdsKey]);
  const filtered = useMemo(() => filterInventoryMovements(query.data ?? [], { search, type: typeFilter !== "ALL" ? typeFilter : undefined, userEmail: userEmailFilter, startDate, endDate, inventoryId: inventoryFilter !== "ALL" ? inventoryFilter : undefined, inventoryItemIds: itemIdSet }), [inventoryFilter, query.data, search, typeFilter, userEmailFilter, startDate, endDate, itemIdSet]);
  const movements = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const error = scopeError || query.error;
  const isLoading = !error && (query.isFetching || (scope === "store" && !scopeReady));
  useEffect(() => { setCurrentPage(1); }, [search, typeFilter, inventoryFilter, userEmailFilter, startDate, endDate]);
  const handleSearch = (event: React.FormEvent) => { event.preventDefault(); setCurrentPage(1); };

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("ALL");
    setInventoryFilter("ALL");
    setUserEmailFilter("");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  const orderIds = useMemo(
    () => [...new Set(movements.map((movement) => describeMovement(movement).orderId).filter((id): id is string => !!id))].sort(),
    [movements],
  );
  const orderNumbers = useQuery({
    queryKey: ["inventory-movement-order-numbers", companyId, orderIds],
    queryFn: () => resolveOrderNumbers(orderIds),
    enabled: orderIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  const signed = (value: number | null) => (value === null ? "—" : `${value > 0 ? "+" : ""}${value}`);

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col space-y-1">
        <h3 className="text-lg font-semibold tracking-tight">{title ?? "Historial de Movimientos"}</h3>
        <p className="text-sm text-muted-foreground">{description ?? (scope === "business" ? "Todos los movimientos del negocio, incluidos registros históricos" : "Movimientos de los almacenes de la tienda seleccionada")}</p>
      </div>

      <div className="bg-muted/40 p-4 rounded-lg border border-border/50">
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-start">
          <div className="flex flex-col space-y-2">
            <Label htmlFor="search" className="text-xs font-semibold uppercase text-muted-foreground/70">Buscar</Label>
            <div className="relative group">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                id="search"
                placeholder="Producto, SKU o referencia (ORD-, COM-)…"
                className="pl-9 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col space-y-2">
            <Label htmlFor="type" className="text-xs font-semibold uppercase text-muted-foreground/70">Filtrar por tipos</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger id="type" className="h-9">
                <SelectValue placeholder="Tipo de operación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los tipos</SelectItem>
                {MOVEMENT_TYPE_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col space-y-2">
            <Label htmlFor="warehouse" className="text-xs font-semibold uppercase text-muted-foreground/70">Almacén</Label>
            <Select value={inventoryFilter} onValueChange={setInventoryFilter} disabled={inventories.length === 0}>
              <SelectTrigger id="warehouse" className="h-9">
                <SelectValue placeholder="Almacén" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos mis almacenes</SelectItem>
                {inventories.map((inv) => <SelectItem key={inv.id} value={inv.id}>{inv.name}{inv.storeName ? ` · ${inv.storeName}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col space-y-2 lg:col-span-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground/70">Rango de fechas</Label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Label className="absolute -top-4 left-0 text-[9px] text-muted-foreground uppercase opacity-0 group-hover:opacity-100 transition-opacity">Desde</Label>
                <Input
                  type="date"
                  title="Desde"
                  className="h-9 text-xs"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex-1 relative">
                <Label className="absolute -top-4 left-0 text-[9px] text-muted-foreground uppercase opacity-0 group-hover:opacity-100 transition-opacity">Hasta</Label>
                <Input
                  type="date"
                  title="Hasta"
                  className="h-9 text-xs"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col space-y-2 col-span-1">
            <Label className="text-xs font-semibold uppercase text-muted-foreground/0 select-none">Acciones</Label>
            <div className="flex gap-2">
              <Button type="submit" variant="default" size="sm" className="h-9 px-4 flex-1">
                Filtrar
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0" onClick={clearFilters} title="Limpiar filtros">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </form>
      </div>

      {error ? <div role="alert" className="rounded border border-destructive p-4">No se pudo cargar el historial. {error instanceof Error ? error.message : "Verifica el alcance y la sesión."} <Button variant="outline" onClick={() => { if (scopeError) onRetryScope?.(); else void query.refetch(); }}>Reintentar</Button></div> : null}
      <div className="rounded-md border shadow-sm overflow-hidden min-h-[450px] flex flex-col bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[160px]">Fecha y hora</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Producto / SKU</TableHead>
              <TableHead>Almacén</TableHead>
              <TableHead className="text-right">Físico</TableHead>
              <TableHead className="text-right">Reservado</TableHead>
              <TableHead>Referencia</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? <TableRow><TableCell colSpan={COLUMNS}>Historial no disponible.</TableCell></TableRow> : isLoading ? (
              [...Array(10)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                </TableRow>
              ))
            ) : movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS} className="h-32 text-center text-muted-foreground italic">
                  No se encontraron movimientos con los filtros aplicados.
                </TableCell>
              </TableRow>
            ) : (
              movements.map((movement) => {
                const view = describeMovement(movement);
                const reference = view.documentNumber ?? (view.orderId ? orderNumbers.data?.[view.orderId] ?? "Pedido" : "—");
                // Almacén del movimiento; en una tienda, sin él en la respuesta, el del almacén validado.
                const warehouse = movement.inventoryItem?.inventory?.name || movement.inventoryName || "—";

                return (
                  <TableRow key={movement.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-xs font-medium">{formatPeruDateTime(movement.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="max-w-[180px] whitespace-normal text-left">{view.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm line-clamp-1 max-w-[200px]">
                          {movement.inventoryItem?.product?.name || "Producto desconocido"}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">
                          {movement.inventoryItem?.sku || "SIN SKU"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{warehouse}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className={cn("font-bold text-sm", view.physicalDelta !== null && (view.physicalDelta >= 0 ? "text-green-600" : "text-red-600"))}>{signed(view.physicalDelta)}</span>
                        {view.physicalAfter !== null ? <span className="text-[10px] font-normal text-muted-foreground">saldo {view.physicalAfter}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-sm text-blue-700 dark:text-blue-400">{signed(view.reservedDelta)}</span>
                        {view.reservedAfter !== null ? <span className="text-[10px] text-muted-foreground">saldo {view.reservedAfter}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">{reference}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium truncate max-w-[120px]">
                          {movement.userName || movement.userEmail || "Sistema"}
                        </span>
                        {movement.userName && movement.userEmail ? (
                          <span className="text-[9px] text-muted-foreground truncate max-w-[120px]">
                            {movement.userEmail}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[220px] whitespace-normal break-words">{view.detail || "—"}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        {!error && !isLoading && movements.length === 0 && (
          <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground italic">
            No se encontraron movimientos.
          </div>
        )}
      </div>

      {!error && <div className="mt-4 flex justify-between items-center">
        <div className="text-xs text-muted-foreground">
          Mostrando <span className="font-medium">{movements.length}</span> de <span className="font-medium">{totalItems}</span> registros
        </div>
        {!isLoading && movements.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
            itemName="movimientos"
          />
        )}
      </div>}
    </div>
  );
}
