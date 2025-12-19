/* import { Provider } from "@/interfaces/IProvider";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableActions,
} from "@/components/ui/table";
import { Edit, Trash, Eye } from "lucide-react";

interface Props {
  providers: Provider[];
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onView: (id: string) => void;
}
export default function ProvidersTable({
  providers,
  onDelete,
  onEdit,
  onView,
}: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>RUC</TableHead>
          <TableHead>Razón Social</TableHead>
          <TableHead>Contacto</TableHead>
          <TableHead>Teléfono</TableHead>
          <TableHead>Celular</TableHead>
          <TableHead>Dirección</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {providers
          .filter((prov) => prov.is_active)
          .map((prov) => (
            <TableRow key={prov.id}>
              <TableCell>{prov.ruc}</TableCell>
              <TableCell>{prov.name}</TableCell>
              <TableCell>{prov.contact}</TableCell>
              <TableCell>{prov.phone_number}</TableCell>
              <TableCell>{prov.cell_phone}</TableCell>
              <TableCell>{prov.address}</TableCell>
              <TableCell>{prov.email}</TableCell>
              <TableActions>
                <Button
                  size="icon"
                  className="bg-lime"
                  onClick={() => onEdit(prov.id!)}
                >
                  <Edit />
                </Button>
                <Button
                  size="icon"
                  className="bg-red"
                  onClick={() => onDelete(prov.id!)}
                >
                  <Trash />
                </Button>
                <Button
                  size="icon"
                  className="bg-sky-blue"
                  onClick={() => onView(prov.id!)}
                >
                  <Eye />
                </Button>
              </TableActions>
            </TableRow>
          ))}
      </TableBody>
    </Table>
  );
}
 */
