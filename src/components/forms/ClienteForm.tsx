import { Cliente } from "@/interfaces/ICliente";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface Props {
  cliente: Cliente | null;
  onClienteSaved: () => void;
}
export default function ClienteForm({ cliente, onClienteSaved }: Props) {
  return (
    <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className=" flex flex-col gap-1.5">
        <Label htmlFor="fullname">Nombre Completo</Label>
        <Input id="fullname" placeholder="John Snow" required />
      </div>
      <div className=" flex flex-col gap-1.5">
        <Label htmlFor="phonenumber">Numero de telefono</Label>
        <Input id="phonenumber" required />
      </div>

      <div className=" flex flex-col gap-1.5">
        <Select>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Tipo de cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TRADICIONAL">Tradiccional</SelectItem>
            <SelectItem value="MAYORISTA">Mayorista</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className=" flex flex-col gap-1.5">
        <Label htmlFor="province">Provincia</Label>
        <Input id="province" required />
      </div>
      <div className=" flex flex-col gap-1.5">
        <Label htmlFor="city">Ciudad</Label>
        <Input id="city" required />
      </div>

      <div className=" flex flex-col gap-1.5">
        <Label htmlFor="district">Distrito</Label>
        <Input id="district" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="address">Direccion</Label>
        <Input id="address" required />
      </div>
    </form>
  );
}
