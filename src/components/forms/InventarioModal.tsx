import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { useState } from "react";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { createInventory } from "@/api/Inventarios/route";

interface Props {
  onClienteSaved: () => void;
}

export default function InventarioForm({ onClienteSaved }: Props) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { auth, refreshInventories } = useAuth();

  const handleOnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.company?.stores?.[0]?.id) {
      toast.error("La empresa no tiene una tienda asociada");
      return;
    }

    if (!name.trim()) {
      toast.warning("El nombre es obligatorio");
      return;
    }

    setLoading(true);
    try {
      await createInventory({
        name,
        store_id: auth?.company?.stores[0]?.id,
      });

      // Refrescar inventarios en el contexto global
      await refreshInventories();
      toast.success("Inventario creado correctamente");
      onClienteSaved();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar Inventario");
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
        <Label htmlFor="name">Nombre del inventario</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Inventario Ropa"
          required
        />
      </div>

      <Button
        type="submit"
        className="col-span-full justify-self-end"
        disabled={loading}
      >
        Crear Inventario
      </Button>
    </form>
  );
}
