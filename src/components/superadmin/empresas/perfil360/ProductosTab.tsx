import { useProductosEmpresa } from "@/hooks/superadmin/useEmpresas";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyBlock, StatusBadge } from "@/components/superadmin/shared";
import { Boxes } from "lucide-react";

export function ProductosTab({ empresaId }: { empresaId: string }) {
  const { data, isLoading } = useProductosEmpresa(empresaId);

  if (!isLoading && !data.length) {
    return <EmptyBlock icon={Boxes} title="Sin catálogo" description="Este negocio aún no cargó su catálogo de productos." />;
  }

  return (
    <div>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Catálogo real (ms-products). Precio, stock y "top vendidos" todavía no están en el DTO del backend — ver docs/superadmin/empresas-endpoints.md.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Variantes</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-xs font-mono">{p.sku}</TableCell>
                <TableCell className="text-xs font-medium">{p.name}</TableCell>
                <TableCell className="text-xs">{p.hasVariants ? "Sí" : "No"}</TableCell>
                <TableCell>
                  <StatusBadge label={p.status ? "Activo" : "Inactivo"} tone={p.status ? "green" : "gray"} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
