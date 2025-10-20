import { Button } from "@/src/components/ui/button";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableActions,
} from "@/src/components/ui/table";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";

import { Edit, Eye } from "lucide-react";

export default function ProductPedidoTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>SKU</TableHead>
          <TableHead>Descripción</TableHead>
          <TableHead>Color</TableHead>
          <TableHead>Talla</TableHead>
          <TableHead>Marca</TableHead>
          <TableHead>Entregados</TableHead>
          <TableHead>Pendientes</TableHead>
          <TableHead>SubTotal</TableHead>
          <TableHead>Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>PP25</TableCell>
          <TableCell>Pantalón Palazo</TableCell>
          <TableCell>Beige</TableCell>
          <TableCell>L-Large</TableCell>
          <TableCell>Aranni</TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="2" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TableCell>
          <TableCell>1/3</TableCell>
          <TableCell>3000.90</TableCell>
          <TableActions>
            <Button>
              <Eye />
            </Button>
            <Button>
              <Edit />
            </Button>
          </TableActions>
        </TableRow>
        <TableRow>
          <TableCell>RR01</TableCell>
          <TableCell>Remera Power</TableCell>
          <TableCell>Negro</TableCell>
          <TableCell>M-Medium</TableCell>
          <TableCell>Sport</TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="1" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TableCell>
          <TableCell>0/1</TableCell>
          <TableCell>1000.90</TableCell>
          <TableActions>
            <Button>
              <Eye />
            </Button>
            <Button>
              <Edit />
            </Button>
          </TableActions>
        </TableRow>
        <TableRow>
          <TableCell>CA085</TableCell>
          <TableCell>Camisa Algodón</TableCell>
          <TableCell>Blanco</TableCell>
          <TableCell>S-Small</TableCell>
          <TableCell>Burgenvilla</TableCell>
          <TableCell>
            <div className="flex items-center">
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="3" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TableCell>
          <TableCell>1/4</TableCell>
          <TableCell>8000.90</TableCell>
          <TableActions>
            <Button>
              <Eye />
            </Button>
            <Button>
              <Edit />
            </Button>
          </TableActions>
        </TableRow>
      </TableBody>
    </Table>
  );
}
