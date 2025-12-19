import { Client } from "@/interfaces/ICliente";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { createClient, updateClient } from "@/api/clientes/route";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  cliente: Client | null;
  onClienteSaved: () => void;
}

type ClientFormState = {
  id?: string;
  fullName: string;
  phoneNumber: string;
  clientType: "TRADICIONAL" | "MAYORISTA";
  province: string;
  city: string;
  district: string;
  address: string;
  reference?: string;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
};

const empty: ClientFormState = {
  fullName: "",
  phoneNumber: "",
  clientType: "TRADICIONAL",
  province: "",
  city: "",
  district: "",
  address: "",
  reference: "",
  isActive: true,
};

export default function ClienteForm({ cliente, onClienteSaved }: Props) {
  function toState(c?: Client | null): ClientFormState {
    if (!c) return empty;

    return {
      id: c.id,
      fullName: c.fullName ?? "",
      phoneNumber: c.phoneNumber ?? "",
      clientType: c.clientType,
      province: c.province ?? "",
      city: c.city ?? "",
      district: c.district ?? "",
      address: c.address ?? "",
      reference: c.reference ?? "",
      latitude: c.latitude,
      longitude: c.longitude,
      isActive: c.isActive ?? true,
    };
  }

  const [state, setState] = useState<ClientFormState>(toState(cliente));

  const [loading, setLoading] = useState(false);
  const { auth } = useAuth();

  useEffect(() => {
    setState(toState(cliente));
  }, [cliente]);

  const validateForm = () =>
    state.fullName.trim() &&
    state.clientType &&
    state.province.trim() &&
    state.city.trim() &&
    state.district.trim() &&
    state.address.trim();

  const handleOnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.warning("Completa todos los campos obligatorios");
      return;
    }

    setLoading(true);
    try {
      if (state.id) {
        await updateClient(state.id, {
          ...state,
          id: state.id,
        });
        toast.success("Cliente actualizado correctamente");
      } else {
        const res = await createClient({
          ...state,
          companyId: auth!.company!.id,
        });
        console.log(res);

        toast.success("Cliente creado correctamente");
        setState(empty);
      }

      onClienteSaved();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar cliente");
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
        <Label htmlFor="fullname">Nombre Completo</Label>
        <Input
          id="fullname"
          value={state.fullName}
          onChange={(e) => setState({ ...state, fullName: e.target.value })}
          placeholder="John Snow"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phonenumber">Número de teléfono</Label>
        <Input
          id="phonenumber"
          value={state.phoneNumber}
          onChange={(e) => setState({ ...state, phoneNumber: e.target.value })}
          placeholder="Ej: 2615555555"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Tipo de cliente</Label>
        <Select
          value={state.clientType}
          onValueChange={(val) =>
            setState({
              ...state,
              clientType: val as "TRADICIONAL" | "MAYORISTA",
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Tipo de cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TRADICIONAL">Tradicional</SelectItem>
            <SelectItem value="MAYORISTA">Mayorista</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="province">Provincia</Label>
        <Input
          id="province"
          value={state.province}
          onChange={(e) => setState({ ...state, province: e.target.value })}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="city">Ciudad</Label>
        <Input
          id="city"
          value={state.city}
          onChange={(e) => setState({ ...state, city: e.target.value })}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="district">Distrito</Label>
        <Input
          id="district"
          value={state.district}
          onChange={(e) => setState({ ...state, district: e.target.value })}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="address">Dirección</Label>
        <Input
          id="address"
          value={state.address}
          onChange={(e) => setState({ ...state, address: e.target.value })}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5 col-span-full">
        <Label htmlFor="reference">Referencia</Label>
        <Textarea
          id="reference"
          placeholder="Referencia (opcional)"
          value={state.reference}
          onChange={(e) => setState({ ...state, reference: e.target.value })}
        />
      </div>

      <Button
        type="submit"
        className="col-span-full justify-self-end"
        disabled={loading}
      >
        {cliente?.id && cliente ? "Actualizar Cliente" : "Crear Cliente"}
      </Button>
    </form>
  );
}
