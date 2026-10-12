"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function BusinessScopeBar() {
  const pathname = usePathname();
  const { auth, selectedStoreId, setSelectedStore } = useAuth();
  const { scope, setScope, canViewBusiness } = useBusinessScope();
  const stores = auth?.company?.stores ?? [];
  const companyCatalog = ["/clientes", "/compras", "/proveedores"].some((route) => pathname === route || pathname.startsWith(`${route}/`));
  if (!auth?.company) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-6 py-3">
      <div>
        <p className="text-sm font-semibold">{auth.company.name}</p>
        <p className="text-xs text-muted-foreground">{companyCatalog ? "Datos de todo el negocio" : scope === "business" ? "Todas las tiendas del negocio" : "Datos de la tienda seleccionada"}</p>
      </div>
      {!companyCatalog && <Select value={scope === "business" ? "business" : selectedStoreId ?? ""} onValueChange={(value) => {
        if (value === "business") setScope("business");
        else if (stores.some((store) => store.id === value)) {
          setSelectedStore(value);
          setScope("store");
        }
      }}>
        <SelectTrigger aria-label="Ver datos de" className="w-[250px]"><SelectValue placeholder="Seleccionar tienda" /></SelectTrigger>
        <SelectContent>
          {canViewBusiness && <SelectItem value="business">Todo el negocio</SelectItem>}
          {stores.map((store) => <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>)}
        </SelectContent>
      </Select>}
    </div>
  );
}
