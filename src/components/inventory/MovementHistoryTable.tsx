"use client";

import { useEffect, useState } from "react";
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

const ITEMS_PER_PAGE = 15;

interface MovementHistoryTableProps {
  companyId: string | undefined;
}

export function MovementHistoryTable({ companyId }: MovementHistoryTableProps) {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    if (!companyId) return;

    const loadMovements = async () => {
      setIsLoading(true);
      try {
        const response = await getMovementsByCompany(companyId, {
          page: currentPage,
          limit: ITEMS_PER_PAGE,
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

    loadMovements();
  }, [companyId, currentPage]);

  return (
    <div className="flex flex-col">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[180px]">Fecha y Hora</TableHead>
              <TableHead>Producto / SKU</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Referencia</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(ITEMS_PER_PAGE)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
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
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No se encontraron movimientos.
                </TableCell>
              </TableRow>
            ) : (
              movements.map((movement) => (
                <TableRow key={movement.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="text-sm">
                    {format(new Date(movement.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">
                        {movement.inventoryItem?.product?.name || "Producto desconocido"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        SKU: {movement.inventoryItem?.sku || "N/A"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-semibold",
                        (movement.type as string) === "IN" || (movement.type as string) === "RELEASED"
                          ? "border-green-200 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" 
                          : "border-red-200 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                      )}
                    >
                      {movement.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {(movement.type === "IN" || movement.type === "RELEASED") ? "+" : "-"}{movement.quantity}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{movement.userName || "Sistema"}</span>
                      <span className="text-[10px] text-muted-foreground">{movement.userEmail || ""}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">
                    {movement.referenceId || "N/A"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {movement.reason}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4">
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
