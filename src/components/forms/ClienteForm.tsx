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
import ubigeos from "@/utils/json/ubigeos.json";

interface Props {
  cliente: Client | null;
  onClienteSaved: () => void;
}

type ClientFormState = {
  id?: string;
  fullName: string;
  phoneNumber: string;
  clientType: "TRADICIONAL" | "MAYORISTA";
  department: string;
  province: string;
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
  department: "",
  province: "",
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
      department: c.city ?? "",
      province: c.province ?? "",
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
    state.department.trim() &&
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
          city: state.department, // Mapear department a city para el backend
          id: state.id,
        } as any);
        toast.success("Cliente actualizado correctamente");
      } else {
        const res = await createClient({
          ...state,
          city: state.department, // Mapear department a city para el backend
          companyId: auth!.company!.id,
        } as any);


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
          placeholder="912345678"
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
        <Label>Departamento</Label>
        <Select
          value={state.department}
          onValueChange={(val) =>
            setState({
              ...state,
              department: val,
              province: "",
              district: "",
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar departamento" />
          </SelectTrigger>
          <SelectContent>
            {ubigeos[0].departments.map((d) => (
              <SelectItem key={d.name} value={d.name}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Provincia</Label>
        <Select
          disabled={!state.department}
          value={state.province}
          onValueChange={(val) =>
            setState({
              ...state,
              province: val,
              district: "",
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar provincia" />
          </SelectTrigger>
          <SelectContent>
            {(
              ubigeos[0].departments.find((d) => d.name === state.department)
                ?.provinces || []
            ).map((p) => (
              <SelectItem key={p.name} value={p.name}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Distrito</Label>
        <Select
          disabled={!state.province}
          value={state.district}
          onValueChange={(val) => setState({ ...state, district: val })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar distrito" />
          </SelectTrigger>
          <SelectContent>
            {(
              ubigeos[0].departments
                .find((d) => d.name === state.department)
                ?.provinces.find((p) => p.name === state.province)?.districts ||
              []
            ).map((dist) => (
              <SelectItem key={dist} value={dist}>
                {dist}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="address">Dirección exacta</Label>
        <Input
          id="address"
          value={state.address}
          onChange={(e) => setState({ ...state, address: e.target.value })}
          placeholder="Av. Las Magnolias 123"
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
