import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { useState } from "react";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { createWarehouse, type WarehouseType } from "@/services/warehousesService";
import { WAREHOUSE_TYPE_OPTIONS, warehouseErrorMessage } from "./warehouseUi";

interface Props {
  onClienteSaved: () => void;
}

export default function AlmacenForm({ onClienteSaved }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<WarehouseType>("PROPIO");
  const [loading, setLoading] = useState(false);
  const { auth, selectedStoreId } = useAuth();

  // El almacén es de la empresa; la tienda seleccionada queda como tienda de origen.
  const stores = auth?.company?.stores ?? [];
  const storeId = selectedStoreId ?? stores[0]?.id;
  const storeName = stores.find((store) => store.id === storeId)?.name;

  const handleOnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!storeId) {
      toast.error("La empresa no tiene una tienda asociada");
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.warning("El nombre es obligatorio");
      return;
    }

    setLoading(true);
    try {
      await createWarehouse({ name: trimmedName, storeId, type });

      toast.success("Almacén creado correctamente");
      onClienteSaved();
    } catch (err) {
      toast.error(warehouseErrorMessage(err, "No se pudo crear el almacén. Inténtalo de nuevo."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      className="grid grid-cols-1 md:grid-cols-2 gap-4"
      onSubmit={handleOnSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Nombre del almacén</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Almacén Central"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="warehouse-type">Tipo</Label>
        <select
          id="warehouse-type"
          value={type}
          onChange={(e) => setType(e.target.value as WarehouseType)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {WAREHOUSE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {storeName && (
        <p className="col-span-full text-xs text-muted-foreground">
          {`Tienda de origen: ${storeName}`}
        </p>
      )}

      <Button
        type="submit"
        className="col-span-full justify-self-end"
        disabled={loading}
      >
        Crear Almacén
      </Button>
    </form>
  );
}
