import { useEffect, useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/pagination";
import { getMovementsByCompany, InventoryMovement } from "@/services/inventoryMovementService";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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

const TYPE_MAP: Record<string, { label: string; color: string }> = {
  IN: { label: "Ingreso", color: "green" },
  OUT: { label: "Egreso", color: "red" },
  RESERVED: { label: "Reserva", color: "blue" },
  RELEASED: { label: "Liberado", color: "orange" },
  COMMITTED: { label: "Confirmado", color: "purple" },
  ADJUSTMENT: { label: "Ajuste", color: "yellow" },
  TRANSFER: { label: "Transferencia", color: "cyan" },
};

const REASON_MAP: Record<string, string> = {
  MANUAL_ADJUSTMENT: "Ajuste manual de stock",
  MANUAL_STOCK_ADD: "Stock agregado manualmente",
  MANUAL_STOCK_REMOVE: "Stock quitado manualmente",
  ORDER_RESERVE: "Reserva por pedido",
  ORDER_CANCEL: "Cancelación de pedido",
  SALE: "Venta de productos",
  STOCK_ADJUSTMENT: "Ajuste de inventario",
  STOCK_ADDITION: "Ingreso de stock manualmente",
  STOCK_REDUCTION: "Egreso de stock manualmente",
  CREATE_ITEM: "Creación de producto",
  EXTERNAL_SYNC_CREATE: "Creación por sincronización externa",
  EXTERNAL_SYNC_ADJUST: "Ajuste por sincronización externa",
};

const REFERENCE_MAP: Record<string, string> = {
  MANUAL: "Manual",
  MANUAL_ADJUSTMENT: "Ajuste Manual",
  SYSTEM: "Sistema",
  STOCK_ADDITION: "Ingreso",
  STOCK_REDUCTION: "Egreso",
  CREATE_ITEM: "Sistema",
  EXTERNAL_SYNC: "Sincronización",
};

interface MovementHistoryTableProps {
  companyId: string | undefined;
}

export function MovementHistoryTable({ companyId }: MovementHistoryTableProps) {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  // Filter states
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [userEmailFilter, setUserEmailFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadMovements = async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      const response = await getMovementsByCompany(companyId, {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        type: typeFilter !== "ALL" ? typeFilter : undefined,
        userEmail: userEmailFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: search || undefined,
      });

      setMovements(response.data);
      setTotalPages(response.meta.totalPages);
      setTotalItems(response.meta.total);
    } catch (err) {
      console.error("Error loading movements:", err);
      toast.error("Error al cargar el historial de movimientos");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMovements();
  }, [companyId, currentPage, typeFilter, userEmailFilter, startDate, endDate]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadMovements();
  };

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("ALL");
    setUserEmailFilter("");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  const getLocalizedType = (type: string) => TYPE_MAP[type]?.label || type;
  const getLocalizedReason = (reason: string) => {
    if (REASON_MAP[reason]) return REASON_MAP[reason];
    
    // Handle dynamic reasons like PURCHASE - XXX
    if (reason.startsWith("PURCHASE - ")) return `Compra (${reason.replace("PURCHASE - ", "")})`;
    if (reason.startsWith("PURCHASE_EDIT_REVERT - ")) return `Reversión edición compra (${reason.replace("PURCHASE_EDIT_REVERT - ", "")})`;
    if (reason.startsWith("PURCHASE_EDIT - ")) return `Edición compra (${reason.replace("PURCHASE_EDIT - ", "")})`;
    if (reason.startsWith("PURCHASE_CANCELLED - ")) return `Compra cancelada (${reason.replace("PURCHASE_CANCELLED - ", "")})`;
    
    return reason;
  };
  const getLocalizedReference = (ref: string | null) => {
    if (!ref) return "-";
    return REFERENCE_MAP[ref] || ref;
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col space-y-1">
        <h3 className="text-lg font-semibold tracking-tight">Historial de Movimientos</h3>
        <p className="text-sm text-muted-foreground">Gestión de ingresos y egresos de stock</p>
      </div>

      <div className="bg-muted/40 p-4 rounded-lg border border-border/50">
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
          <div className="flex flex-col space-y-2">
            <Label htmlFor="search" className="text-xs font-semibold uppercase text-muted-foreground/70">Buscar</Label>
            <div className="relative group">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                id="search"
                placeholder="Nombre o SKU..."
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
                <SelectItem value="IN">Ingreso</SelectItem>
                <SelectItem value="OUT">Egreso</SelectItem>
                <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                <SelectItem value="RESERVED">Reserva</SelectItem>
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

      <div className="rounded-md border shadow-sm overflow-hidden min-h-[450px] flex flex-col bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[160px]">Fecha y Hora</TableHead>
              <TableHead>Producto / SKU</TableHead>
              <TableHead>Operación</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Referencia</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(10)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                </TableRow>
              ))
            ) : movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic">
                  No se encontraron movimientos con los filtros aplicados.
                </TableCell>
              </TableRow>
            ) : (
              movements.map((movement) => {
                const typeInfo = TYPE_MAP[movement.type] || { label: movement.type, color: "gray" };
                const isPositive = movement.type === "IN" || movement.type === "RELEASED";

                return (
                  <TableRow key={movement.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-xs font-medium">
                      {format(new Date(movement.created_at), "dd/MM/yy, HH:mm", { locale: es })}
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
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-bold text-[10px] px-1.5 h-5 uppercase",
                          typeInfo.color === "green" && "border-green-200 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
                          typeInfo.color === "red" && "border-red-200 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
                          typeInfo.color === "blue" && "border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
                          typeInfo.color === "yellow" && "border-yellow-200 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                        )}
                      >
                        {typeInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-bold text-sm",
                      isPositive ? "text-green-600" : "text-red-600"
                    )}>
                      {isPositive ? "+" : "-"}{movement.quantity}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium truncate max-w-[120px]">
                          {movement.userName || "Sistema"}
                        </span>
                        <span className="text-[9px] text-muted-foreground truncate max-w-[120px]">
                          {movement.userEmail || ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[100px]">
                      {getLocalizedReference(movement.referenceId)}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-muted-foreground italic">
                      {getLocalizedReason(movement.reason)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        {!isLoading && movements.length === 0 && (
          <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground italic">
            No se encontraron movimientos.
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between items-center">
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
      </div>
    </div>
  );
}
